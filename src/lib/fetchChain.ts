import { createPublicClient, hexToString, http, type Address, type PublicClient } from "viem";
import { poolAbi } from "../abis/pool";
import { riskStewardAbi, riskStewardLegacyAbi } from "../abis/riskSteward";
import { rateStrategyAbi } from "../abis/rateStrategy";
import { erc20Abi, erc20Bytes32Abi } from "../abis/erc20";
import { multicall3Abi } from "../abis/multicall3";
import type { Deployment } from "../chains";
import { decodeReserveConfig, type ReserveConfig } from "./reserveConfig";

// uint40 minDelay decodes to `number` in viem; uint256 maxPercentChange decodes to `bigint`.
export type RiskParam = { minDelay: number; maxPercentChange: bigint };
export type RiskConfig = {
  collateralConfig: { ltv: RiskParam; liquidationThreshold: RiskParam; liquidationBonus: RiskParam; debtCeiling: RiskParam };
  eModeConfig: { ltv: RiskParam; liquidationThreshold: RiskParam; liquidationBonus: RiskParam };
  rateConfig: { baseVariableBorrowRate: RiskParam; variableRateSlope1: RiskParam; variableRateSlope2: RiskParam; optimalUsageRatio: RiskParam };
  capConfig: { supplyCap: RiskParam; borrowCap: RiskParam };
  priceCapConfig: { priceCapLst: RiskParam; priceCapStable: RiskParam; discountRatePendle: RiskParam };
};

export type Timelock = {
  supplyCapLastUpdated: number;
  borrowCapLastUpdated: number;
  ltvLastUpdated: number;
  liquidationBonusLastUpdated: number;
  liquidationThresholdLastUpdated: number;
  debtCeilingLastUpdated: number;
  baseVariableRateLastUpdated: number;
  variableRateSlope1LastUpdated: number;
  variableRateSlope2LastUpdated: number;
  optimalUsageRatioLastUpdated: number;
  priceCapLastUpdated: number;
};

export type RateData = {
  optimalUsageRatio: bigint;
  baseVariableBorrowRate: bigint;
  variableRateSlope1: bigint;
  variableRateSlope2: bigint;
};

export type AssetRow = {
  address: Address;
  symbol: string;
  decimals: number;
  config: ReserveConfig;
  timelock: Timelock | null;
  rate: RateData | null;
  /** isAddressRestricted on the steward — when true, every steward update for this
   *  asset reverts regardless of bounds/cooldowns. */
  restricted: boolean;
};

export type ChainSnapshot = {
  deployment: Deployment;
  riskConfig: RiskConfig | null;
  riskConfigError: string | null;       // set only when both modern and legacy ABIs fail
  isLegacySteward: boolean;             // true for stewards using the 12-RiskParamConfig flat shape
  rateStrategyAddress: Address | null;
  assets: AssetRow[];
  fetchedAtMs: number;
  rpcCalls: number;                     // number of multicall round-trips actually issued
  blockNumber: bigint | null;           // block at which Stage A executed (per Multicall3.getBlockNumber)
  blockTimestamp: number | null;        // unix seconds — used as the "now" reference for cooldowns
};

const ZERO_ADDR = "0x0000000000000000000000000000000000000000" as const;

const buildClient = (rpcUrl: string, multicall3: Address): PublicClient =>
  createPublicClient({
    transport: http(rpcUrl, { timeout: 20_000 }),
    batch: { multicall: { batchSize: 1024, wait: 0 } },
    cacheTime: 0,
    // viem requires a chain to use multicall; we synthesize a minimal one so the
    // user-supplied RPC works even on chains viem doesn't ship presets for.
    chain: {
      id: 0, // overridden by RPC; we never sign txs
      name: "user-rpc",
      nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [rpcUrl] } },
      contracts: { multicall3: { address: multicall3 } },
    } as any,
  }) as PublicClient;

export async function fetchChainSnapshot(
  deployment: Deployment,
  rpcUrl: string,
): Promise<ChainSnapshot> {
  const client = buildClient(rpcUrl, deployment.multicall3);
  let rpcCalls = 0;

  // ── Stage A: reserves list + risk config (try both shapes) + rate-strategy address ──
  // Modern stewards return a 16-RiskParamConfig nested struct; older stewards
  // (AaveV3EthereumEtherFi) return a 12-RiskParamConfig flat-ish struct (no eMode,
  // no pendle). We call both and pick whichever decodes — same round-trip count.
  const stageA = await client.multicall({
    allowFailure: true,
    contracts: [
      { address: deployment.pool, abi: poolAbi, functionName: "getReservesList" },
      { address: deployment.riskSteward, abi: riskStewardAbi, functionName: "getRiskConfig" },
      {
        address: deployment.riskSteward,
        abi: riskStewardLegacyAbi,
        functionName: "getRiskConfig",
      },
      { address: deployment.pool, abi: poolAbi, functionName: "RESERVE_INTEREST_RATE_STRATEGY" },
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
  const modernRiskConfigResult = stageA[1];
  const legacyRiskConfigResult = stageA[2];
  const rateStrategyResult = stageA[3];
  const blockNumberResult = stageA[4];
  const blockTimestampResult = stageA[5];

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

  let riskConfig: RiskConfig | null = null;
  let isLegacySteward = false;
  let riskConfigError: string | null = null;

  if (modernRiskConfigResult.status === "success") {
    riskConfig = modernRiskConfigResult.result as RiskConfig;
  } else if (legacyRiskConfigResult.status === "success") {
    riskConfig = liftLegacyRiskConfig(legacyRiskConfigResult.result as LegacyRiskConfig);
    isLegacySteward = true;
  } else {
    riskConfigError = "getRiskConfig failed against both modern and legacy ABIs";
  }

  const rateStrategyAddress =
    rateStrategyResult.status === "success"
      ? (rateStrategyResult.result as Address)
      : null;

  if (reserves.length === 0) {
    return {
      deployment,
      riskConfig,
      riskConfigError,
      isLegacySteward,
      rateStrategyAddress,
      assets: [],
      fetchedAtMs: Date.now(),
      rpcCalls,
      blockNumber,
      blockTimestamp,
    };
  }

  // ── Stage B: per-asset config + timelock + symbol + decimals ──
  // viem's batch.multicall coalesces these into one Multicall3 call. The timelock
  // ABI is picked based on which getRiskConfig shape decoded.
  const timelockAbi = isLegacySteward ? riskStewardLegacyAbi : riskStewardAbi;
  const stageBContracts = reserves.flatMap((asset) => [
    { address: deployment.pool, abi: poolAbi, functionName: "getConfiguration", args: [asset] } as const,
    { address: deployment.riskSteward, abi: timelockAbi, functionName: "getTimelock", args: [asset] } as const,
    { address: asset, abi: erc20Abi, functionName: "symbol" } as const,
    { address: asset, abi: erc20Abi, functionName: "decimals" } as const,
    { address: asset, abi: erc20Bytes32Abi, functionName: "symbol" } as const,
    {
      address: deployment.riskSteward,
      abi: timelockAbi,
      functionName: "isAddressRestricted",
      args: [asset],
    } as const,
  ]);
  const stageB = await client.multicall({ allowFailure: true, contracts: stageBContracts });
  rpcCalls++;

  // ── Stage C: rate data per asset (only if we have a rate strategy) ──
  let stageC: { status: "success" | "failure"; result?: unknown; error?: { shortMessage?: string } }[] = [];
  if (rateStrategyAddress && rateStrategyAddress !== ZERO_ADDR) {
    const stageCContracts = reserves.map(
      (asset) =>
        ({
          address: rateStrategyAddress,
          abi: rateStrategyAbi,
          functionName: "getInterestRateDataBps",
          args: [asset],
        }) as const,
    );
    stageC = (await client.multicall({
      allowFailure: true,
      contracts: stageCContracts,
    })) as typeof stageC;
    rpcCalls++;
  }

  const STAGE_B_STRIDE = 6;
  const assets: AssetRow[] = reserves.map((address, i) => {
    const cfgRes = stageB[i * STAGE_B_STRIDE];
    const tlRes = stageB[i * STAGE_B_STRIDE + 1];
    const symRes = stageB[i * STAGE_B_STRIDE + 2];
    const decRes = stageB[i * STAGE_B_STRIDE + 3];
    const symBytes32Res = stageB[i * STAGE_B_STRIDE + 4];
    const restrictedRes = stageB[i * STAGE_B_STRIDE + 5];
    const rateRes = stageC[i];

    const cfgOk = cfgRes && cfgRes.status === "success";
    const data = cfgOk ? (cfgRes.result as { data: bigint }).data : 0n;

    return {
      address,
      symbol: resolveSymbol(symRes, symBytes32Res),
      decimals: decRes && decRes.status === "success" ? Number(decRes.result as number) : 18,
      config: decodeReserveConfig(data),
      timelock:
        tlRes && tlRes.status === "success"
          ? normalizeTimelock(tlRes.result as Record<string, bigint | number>)
          : null,
      rate:
        rateRes && rateRes.status === "success"
          ? normalizeRateData(rateRes.result as Record<string, bigint | number>)
          : null,
      restricted:
        restrictedRes && restrictedRes.status === "success"
          ? Boolean(restrictedRes.result)
          : false,
    };
  });

  return {
    deployment,
    riskConfig,
    riskConfigError,
    isLegacySteward,
    rateStrategyAddress,
    assets,
    fetchedAtMs: Date.now(),
    rpcCalls,
    blockNumber,
    blockTimestamp,
  };
}

function normalizeTimelock(raw: Record<string, bigint | number>): Timelock {
  const n = (k: string) => Number(raw[k] ?? 0);
  return {
    supplyCapLastUpdated: n("supplyCapLastUpdated"),
    borrowCapLastUpdated: n("borrowCapLastUpdated"),
    ltvLastUpdated: n("ltvLastUpdated"),
    liquidationBonusLastUpdated: n("liquidationBonusLastUpdated"),
    liquidationThresholdLastUpdated: n("liquidationThresholdLastUpdated"),
    debtCeilingLastUpdated: n("debtCeilingLastUpdated"),
    baseVariableRateLastUpdated: n("baseVariableRateLastUpdated"),
    variableRateSlope1LastUpdated: n("variableRateSlope1LastUpdated"),
    variableRateSlope2LastUpdated: n("variableRateSlope2LastUpdated"),
    optimalUsageRatioLastUpdated: n("optimalUsageRatioLastUpdated"),
    priceCapLastUpdated: n("priceCapLastUpdated"),
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
      // Strip null padding (hexToString with size already trims, but be defensive).
      const clean = decoded.replace(/\0+$/, "").trim();
      if (clean) return clean;
    } catch {
      // fall through
    }
  }
  return "?";
}

function normalizeRateData(raw: Record<string, bigint | number>): RateData {
  const b = (k: string) => BigInt(raw[k] ?? 0);
  return {
    optimalUsageRatio: b("optimalUsageRatio"),
    baseVariableBorrowRate: b("baseVariableBorrowRate"),
    variableRateSlope1: b("variableRateSlope1"),
    variableRateSlope2: b("variableRateSlope2"),
  };
}

// Legacy steward Config has 12 RiskParamConfigs (modern minus EmodeConfig and
// minus discountRatePendle). Lift it into the same RiskConfig shape, zero-filling
// the missing branches — none of the dashboard's columns read those branches.
type LegacyRiskConfig = {
  collateralConfig: RiskConfig["collateralConfig"];
  rateConfig: RiskConfig["rateConfig"];
  capConfig: RiskConfig["capConfig"];
  priceCapConfig: { priceCapLst: RiskParam; priceCapStable: RiskParam };
};

const ZERO_PARAM: RiskParam = { minDelay: 0, maxPercentChange: 0n };

function liftLegacyRiskConfig(legacy: LegacyRiskConfig): RiskConfig {
  return {
    collateralConfig: legacy.collateralConfig,
    eModeConfig: { ltv: ZERO_PARAM, liquidationThreshold: ZERO_PARAM, liquidationBonus: ZERO_PARAM },
    rateConfig: legacy.rateConfig,
    capConfig: legacy.capConfig,
    priceCapConfig: {
      priceCapLst: legacy.priceCapConfig.priceCapLst,
      priceCapStable: legacy.priceCapConfig.priceCapStable,
      discountRatePendle: ZERO_PARAM,
    },
  };
}
