import { createPublicClient, hexToString, http, type Address, type PublicClient } from "viem";
import { poolHorizonAbi } from "../abis/pool";
import { rateStrategyAbi } from "../abis/rateStrategy";
import { erc20Abi, erc20Bytes32Abi } from "../abis/erc20";
import { multicall3Abi } from "../abis/multicall3";
import type { HorizonDeployment } from "../chains";
import { decodeReserveConfig, type ReserveConfig } from "./reserveConfig";

// Horizon is permissioned by asset *kind*. The pool itself is agnostic — kinds are
// derived from the reserve configuration:
//   - rwa: collateral-only RWA token (LT > 0 with borrowEnabled == false)
//   - borrowable: stablecoin / non-RWA listed only for borrowing (LT == 0 with borrowEnabled)
//   - other: any reserve that doesn't fit either pattern (none in production today)
export type HorizonAssetKind = "rwa" | "borrowable" | "other";

export type HorizonRateData = {
  optimalUsageRatio: bigint;
  baseVariableBorrowRate: bigint;
  variableRateSlope1: bigint;
  variableRateSlope2: bigint;
};

export type HorizonAssetRow = {
  address: Address;
  symbol: string;
  decimals: number;
  kind: HorizonAssetKind;
  config: ReserveConfig;
  rate: HorizonRateData | null;
  rateStrategyAddress: Address | null;
  aTokenAddress: Address | null;
  variableDebtTokenAddress: Address | null;
  /** v3.3 deficit (replaces deprecated stable borrow rate slot). USD-base-currency scaled. */
  deficit: bigint;
};

export type HorizonSnapshot = {
  deployment: HorizonDeployment;
  assets: HorizonAssetRow[];
  fetchedAtMs: number;
  rpcCalls: number;
  blockNumber: bigint | null;
  blockTimestamp: number | null;
};

const ZERO_ADDR = "0x0000000000000000000000000000000000000000" as const;

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

function classifyKind(c: ReserveConfig): HorizonAssetKind {
  // Per the Horizon overview doc: RWA collaterals have LT > 0 with borrowing disabled,
  // and the borrowable stable side has LT == 0 with borrowing enabled. Anything else
  // shows up as "other" so the table doesn't lie when configs evolve.
  if (c.liqThreshold > 0n && !c.borrowEnabled) return "rwa";
  if (c.liqThreshold === 0n && c.borrowEnabled) return "borrowable";
  return "other";
}

export async function fetchHorizonSnapshot(
  deployment: HorizonDeployment,
  rpcUrl: string,
): Promise<HorizonSnapshot> {
  const client = buildClient(rpcUrl, deployment.multicall3);
  let rpcCalls = 0;

  // ── Stage A: reserves list + chain meta ──
  const stageA = await client.multicall({
    allowFailure: true,
    contracts: [
      { address: deployment.pool, abi: poolHorizonAbi, functionName: "getReservesList" },
      { address: deployment.multicall3, abi: multicall3Abi, functionName: "getBlockNumber" },
      {
        address: deployment.multicall3,
        abi: multicall3Abi,
        functionName: "getCurrentBlockTimestamp",
      },
    ],
  });
  rpcCalls++;

  const reservesResult = stageA[0];
  const blockNumberResult = stageA[1];
  const blockTimestampResult = stageA[2];

  const blockNumber =
    blockNumberResult.status === "success" ? (blockNumberResult.result as bigint) : null;
  const blockTimestamp =
    blockTimestampResult.status === "success"
      ? Number(blockTimestampResult.result as bigint)
      : null;

  if (reservesResult.status !== "success") {
    const err = reservesResult.error as { shortMessage?: string; message?: string };
    throw new Error(`getReservesList failed: ${err.shortMessage ?? err.message ?? "unknown"}`);
  }
  const reserves = reservesResult.result as readonly Address[];

  if (reserves.length === 0) {
    return {
      deployment,
      assets: [],
      fetchedAtMs: Date.now(),
      rpcCalls,
      blockNumber,
      blockTimestamp,
    };
  }

  // ── Stage B: per-asset config + reserveData + symbol/decimals + deficit ──
  // The rate strategy is read out of getReserveData (Horizon's Pool doesn't expose
  // the v3.2-style immutable `RESERVE_INTEREST_RATE_STRATEGY()` getter — it reverts).
  const stageBContracts = reserves.flatMap((asset) => [
    { address: deployment.pool, abi: poolHorizonAbi, functionName: "getConfiguration", args: [asset] } as const,
    { address: deployment.pool, abi: poolHorizonAbi, functionName: "getReserveData", args: [asset] } as const,
    { address: asset, abi: erc20Abi, functionName: "symbol" } as const,
    { address: asset, abi: erc20Abi, functionName: "decimals" } as const,
    { address: asset, abi: erc20Bytes32Abi, functionName: "symbol" } as const,
    { address: deployment.pool, abi: poolHorizonAbi, functionName: "getReserveDeficit", args: [asset] } as const,
  ]);
  const stageB = await client.multicall({ allowFailure: true, contracts: stageBContracts });
  rpcCalls++;

  const STRIDE = 6;
  type ReserveDataTuple = {
    interestRateStrategyAddress: Address;
    aTokenAddress: Address;
    variableDebtTokenAddress: Address;
  };

  // Collect per-asset rate strategy addresses; in production they all point at the
  // same DefaultReserveInterestRateStrategyV2 instance, but we read per-asset to stay
  // honest if Horizon ever splits strategies.
  const rateStrategies: (Address | null)[] = reserves.map((_, i) => {
    const rdRes = stageB[i * STRIDE + 1];
    if (!rdRes || rdRes.status !== "success") return null;
    const rd = rdRes.result as ReserveDataTuple;
    const s = rd.interestRateStrategyAddress;
    return s && s !== ZERO_ADDR ? s : null;
  });

  // ── Stage C: rate data per asset on its own strategy ──
  let stageC: { status: "success" | "failure"; result?: unknown; error?: { shortMessage?: string } }[] = [];
  const haveAnyStrategy = rateStrategies.some((s) => s !== null);
  if (haveAnyStrategy) {
    const stageCContracts = reserves.map((asset, i) => {
      const strat = rateStrategies[i];
      // viem won't accept null for `address`; aim a no-op at the multicall3 so the slot
      // returns `failure` and we drop the rate. Cheaper than dynamically resizing the call set.
      const target = strat ?? deployment.multicall3;
      return {
        address: target,
        abi: rateStrategyAbi,
        functionName: "getInterestRateDataBps",
        args: [asset],
      } as const;
    });
    stageC = (await client.multicall({
      allowFailure: true,
      contracts: stageCContracts,
    })) as typeof stageC;
    rpcCalls++;
  }

  const assets: HorizonAssetRow[] = reserves.map((address, i) => {
    const cfgRes = stageB[i * STRIDE];
    const rdRes = stageB[i * STRIDE + 1];
    const symRes = stageB[i * STRIDE + 2];
    const decRes = stageB[i * STRIDE + 3];
    const symBytes32Res = stageB[i * STRIDE + 4];
    const deficitRes = stageB[i * STRIDE + 5];
    const rateRes = stageC[i];

    const cfgData =
      cfgRes && cfgRes.status === "success" ? (cfgRes.result as { data: bigint }).data : 0n;
    const config = decodeReserveConfig(cfgData);

    const rd =
      rdRes && rdRes.status === "success"
        ? (rdRes.result as ReserveDataTuple)
        : null;
    const aToken = rd?.aTokenAddress ?? null;
    const vToken = rd?.variableDebtTokenAddress ?? null;
    const strat = rateStrategies[i];

    return {
      address,
      symbol: resolveSymbol(symRes, symBytes32Res),
      decimals: decRes && decRes.status === "success" ? Number(decRes.result as number) : 18,
      kind: classifyKind(config),
      config,
      aTokenAddress: aToken && aToken !== ZERO_ADDR ? aToken : null,
      variableDebtTokenAddress: vToken && vToken !== ZERO_ADDR ? vToken : null,
      rateStrategyAddress: strat,
      rate:
        rateRes && rateRes.status === "success"
          ? normalizeRateData(rateRes.result as Record<string, bigint | number>)
          : null,
      deficit:
        deficitRes && deficitRes.status === "success"
          ? BigInt(deficitRes.result as bigint | number)
          : 0n,
    };
  });

  return {
    deployment,
    assets,
    fetchedAtMs: Date.now(),
    rpcCalls,
    blockNumber,
    blockTimestamp,
  };
}

type CallResult =
  | { status: "success"; result: unknown }
  | { status: "failure"; error: unknown };

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

function normalizeRateData(raw: Record<string, bigint | number>): HorizonRateData {
  const b = (k: string) => BigInt(raw[k] ?? 0);
  return {
    optimalUsageRatio: b("optimalUsageRatio"),
    baseVariableBorrowRate: b("baseVariableBorrowRate"),
    variableRateSlope1: b("variableRateSlope1"),
    variableRateSlope2: b("variableRateSlope2"),
  };
}
