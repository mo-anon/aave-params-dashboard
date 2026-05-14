import { createPublicClient, hexToString, http, type Address, type PublicClient } from "viem";
import { v4SpokeAbi } from "../abis/v4Spoke";
import { erc20Abi, erc20Bytes32Abi } from "../abis/erc20";
import { multicall3Abi } from "../abis/multicall3";
import type { V4Deployment, V4HubName, V4Spoke } from "../chains";

export type V4ReserveFlags = {
  paused: boolean;
  frozen: boolean;
  borrowable: boolean;
  receiveSharesEnabled: boolean;
};

export type V4ReserveRow = {
  reserveId: number;
  underlying: Address;
  hubAddress: Address;
  /** Resolved name of the hub. "unknown" if the address isn't in the deployment's hub registry. */
  hubName: V4HubName | "unknown";
  assetId: number;
  decimals: number;
  symbol: string;
  collateralRisk: number;        // bps
  flags: V4ReserveFlags;
  dynamicConfigKey: number;
  /** Set when the dynamic config call succeeded. Null when the reserve has no active
   *  config (e.g. uninitialized or borrow-only reserves without collateral params). */
  dynamicConfig: {
    collateralFactor: bigint;   // bps
    maxLiquidationBonus: bigint; // raw — 10_000 == 0% bonus, value above 10_000 is the bonus over par
    liquidationFee: bigint;     // bps
  } | null;
  suppliedAssets: bigint;
  totalDebt: bigint;
};

export type V4LiquidationConfig = {
  targetHealthFactor: bigint;       // WAD (1e18)
  healthFactorForMaxBonus: bigint;  // WAD
  liquidationBonusFactor: bigint;   // bps
};

export type V4SpokeSnapshot = {
  deployment: V4Deployment;
  spoke: V4Spoke;
  liquidationConfig: V4LiquidationConfig | null;
  reserves: V4ReserveRow[];
  fetchedAtMs: number;
  rpcCalls: number;
  blockNumber: bigint | null;
  blockTimestamp: number | null;
};

const buildClient = (rpcUrl: string, multicall3: Address): PublicClient =>
  createPublicClient({
    transport: http(rpcUrl, { timeout: 20_000 }),
    batch: { multicall: { batchSize: 1024, wait: 0 } },
    cacheTime: 0,
    chain: {
      id: 0,
      name: "user-rpc",
      nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [rpcUrl] } },
      contracts: { multicall3: { address: multicall3 } },
    } as any,
  }) as PublicClient;

function decodeFlags(raw: number): V4ReserveFlags {
  return {
    paused: (raw & 0x01) !== 0,
    frozen: (raw & 0x02) !== 0,
    borrowable: (raw & 0x04) !== 0,
    receiveSharesEnabled: (raw & 0x08) !== 0,
  };
}

export async function fetchV4SpokeSnapshot(
  deployment: V4Deployment,
  spoke: V4Spoke,
  rpcUrl: string,
): Promise<V4SpokeSnapshot> {
  const client = buildClient(rpcUrl, deployment.multicall3);
  let rpcCalls = 0;

  // ── Stage A: reserve count, spoke-wide liquidation config, chain meta ──
  const stageA = await client.multicall({
    allowFailure: true,
    contracts: [
      { address: spoke.address, abi: v4SpokeAbi, functionName: "getReserveCount" },
      { address: spoke.address, abi: v4SpokeAbi, functionName: "getLiquidationConfig" },
      { address: deployment.multicall3, abi: multicall3Abi, functionName: "getBlockNumber" },
      {
        address: deployment.multicall3,
        abi: multicall3Abi,
        functionName: "getCurrentBlockTimestamp",
      },
    ],
  });
  rpcCalls++;

  const reserveCountResult = stageA[0];
  const liqConfigResult = stageA[1];
  const blockNumberResult = stageA[2];
  const blockTimestampResult = stageA[3];

  const blockNumber =
    blockNumberResult.status === "success" ? (blockNumberResult.result as bigint) : null;
  const blockTimestamp =
    blockTimestampResult.status === "success"
      ? Number(blockTimestampResult.result as bigint)
      : null;

  if (reserveCountResult.status !== "success") {
    const err = reserveCountResult.error as { shortMessage?: string; message?: string };
    throw new Error(`getReserveCount failed: ${err.shortMessage ?? err.message ?? "unknown"}`);
  }
  const reserveCount = Number(reserveCountResult.result as bigint);

  const liquidationConfig: V4LiquidationConfig | null =
    liqConfigResult.status === "success"
      ? normalizeLiquidationConfig(liqConfigResult.result as Record<string, bigint | number>)
      : null;

  if (reserveCount === 0) {
    return {
      deployment,
      spoke,
      liquidationConfig,
      reserves: [],
      fetchedAtMs: Date.now(),
      rpcCalls,
      blockNumber,
      blockTimestamp,
    };
  }

  // ── Stage B: per-reserve getReserve + getReserveConfig + supplied + totalDebt ──
  // We need getReserve first to learn each reserve's underlying address and dynKey,
  // so erc20 metadata and dynamic config are deferred to Stage C.
  const reserveIds = Array.from({ length: reserveCount }, (_, i) => BigInt(i));
  const stageBContracts = reserveIds.flatMap((id) => [
    { address: spoke.address, abi: v4SpokeAbi, functionName: "getReserve", args: [id] } as const,
    { address: spoke.address, abi: v4SpokeAbi, functionName: "getReserveConfig", args: [id] } as const,
    { address: spoke.address, abi: v4SpokeAbi, functionName: "getReserveSuppliedAssets", args: [id] } as const,
    { address: spoke.address, abi: v4SpokeAbi, functionName: "getReserveTotalDebt", args: [id] } as const,
  ]);
  const stageB = await client.multicall({ allowFailure: true, contracts: stageBContracts });
  rpcCalls++;

  type ReserveTuple = {
    underlying: Address;
    hub: Address;
    assetId: number;
    decimals: number;
    collateralRisk: number;
    flags: number;
    dynamicConfigKey: number;
  };
  type ReserveConfigTuple = {
    collateralRisk: number;
    paused: boolean;
    frozen: boolean;
    borrowable: boolean;
    receiveSharesEnabled: boolean;
  };

  // Decode stage B and assemble the per-reserve scaffold.
  const STRIDE_B = 4;
  const partial: (V4ReserveRow & { _hasReserve: boolean })[] = reserveIds.map((_, i) => {
    const rRes = stageB[i * STRIDE_B];
    const cfgRes = stageB[i * STRIDE_B + 1];
    const supRes = stageB[i * STRIDE_B + 2];
    const debtRes = stageB[i * STRIDE_B + 3];

    const reserve =
      rRes && rRes.status === "success" ? (rRes.result as ReserveTuple) : null;
    const cfg =
      cfgRes && cfgRes.status === "success" ? (cfgRes.result as ReserveConfigTuple) : null;

    const hubAddress = (reserve?.hub ?? "0x0000000000000000000000000000000000000000") as Address;
    const hubName = resolveHubName(hubAddress, deployment.hubs);

    // Pull flags from reserve.flags; if missing, fall back to ReserveConfig bools.
    const flagBits =
      reserve != null
        ? reserve.flags
        : (cfg?.paused ? 1 : 0) |
          (cfg?.frozen ? 2 : 0) |
          (cfg?.borrowable ? 4 : 0) |
          (cfg?.receiveSharesEnabled ? 8 : 0);

    return {
      reserveId: i,
      underlying: (reserve?.underlying ?? "0x0000000000000000000000000000000000000000") as Address,
      hubAddress,
      hubName,
      assetId: reserve?.assetId ?? 0,
      decimals: reserve?.decimals ?? 18,
      symbol: "?",
      collateralRisk: Number(cfg?.collateralRisk ?? reserve?.collateralRisk ?? 0),
      flags: decodeFlags(flagBits),
      dynamicConfigKey: reserve?.dynamicConfigKey ?? 0,
      dynamicConfig: null,
      suppliedAssets:
        supRes && supRes.status === "success" ? BigInt(supRes.result as bigint | number) : 0n,
      totalDebt:
        debtRes && debtRes.status === "success" ? BigInt(debtRes.result as bigint | number) : 0n,
      _hasReserve: reserve != null,
    };
  });

  // ── Stage C: dynamic config + erc20 metadata ──
  // Skip reserves where stage B couldn't read the reserve (no underlying / dyn key).
  const stageCContracts = partial.flatMap((row) => {
    if (!row._hasReserve) {
      return [] as const;
    }
    return [
      {
        address: spoke.address,
        abi: v4SpokeAbi,
        functionName: "getDynamicReserveConfig",
        args: [BigInt(row.reserveId), row.dynamicConfigKey],
      } as const,
      { address: row.underlying, abi: erc20Abi, functionName: "symbol" } as const,
      { address: row.underlying, abi: erc20Bytes32Abi, functionName: "symbol" } as const,
    ];
  });

  let stageC: { status: "success" | "failure"; result?: unknown; error?: { shortMessage?: string } }[] = [];
  if (stageCContracts.length > 0) {
    stageC = (await client.multicall({
      allowFailure: true,
      contracts: stageCContracts,
    })) as typeof stageC;
    rpcCalls++;
  }

  type DynCfgTuple = {
    collateralFactor: number;
    maxLiquidationBonus: number;
    liquidationFee: number;
  };

  let cursor = 0;
  const reserves: V4ReserveRow[] = partial.map((row) => {
    if (!row._hasReserve) {
      const { _hasReserve, ...rest } = row;
      return rest;
    }
    const dynRes = stageC[cursor++];
    const symRes = stageC[cursor++];
    const symBytes32Res = stageC[cursor++];

    const dyn = dynRes && dynRes.status === "success" ? (dynRes.result as DynCfgTuple) : null;

    const { _hasReserve, ...rest } = row;
    return {
      ...rest,
      symbol: resolveSymbol(symRes, symBytes32Res),
      dynamicConfig: dyn
        ? {
            collateralFactor: BigInt(dyn.collateralFactor),
            maxLiquidationBonus: BigInt(dyn.maxLiquidationBonus),
            liquidationFee: BigInt(dyn.liquidationFee),
          }
        : null,
    };
  });

  return {
    deployment,
    spoke,
    liquidationConfig,
    reserves,
    fetchedAtMs: Date.now(),
    rpcCalls,
    blockNumber,
    blockTimestamp,
  };
}

function resolveHubName(
  address: Address,
  hubs: { name: V4HubName; address: `0x${string}` }[],
): V4HubName | "unknown" {
  const target = address.toLowerCase();
  for (const h of hubs) {
    if (h.address.toLowerCase() === target) return h.name;
  }
  return "unknown";
}

type CallResult = { status: "success" | "failure"; result?: unknown; error?: unknown };

function resolveSymbol(stringRes: CallResult | undefined, bytes32Res: CallResult | undefined): string {
  if (stringRes && stringRes.status === "success") {
    const s = stringRes.result as string;
    if (s) return s;
  }
  if (bytes32Res && bytes32Res.status === "success") {
    const hex = bytes32Res.result as `0x${string}`;
    try {
      const decoded = hexToString(hex, { size: 32 });
      const clean = decoded.replace(/\0+$/, "").trim();
      if (clean) return clean;
    } catch {
      // fall through
    }
  }
  return "?";
}

function normalizeLiquidationConfig(raw: Record<string, bigint | number>): V4LiquidationConfig {
  return {
    targetHealthFactor: BigInt(raw.targetHealthFactor ?? 0),
    healthFactorForMaxBonus: BigInt(raw.healthFactorForMaxBonus ?? 0),
    liquidationBonusFactor: BigInt(raw.liquidationBonusFactor ?? 0),
  };
}
