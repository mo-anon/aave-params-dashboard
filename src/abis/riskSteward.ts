// Mirrors the nested Config / Debounce shapes from
// risksteward-ci/src/interfaces/IRiskSteward.sol. Older steward deployments return
// a smaller getRiskConfig() payload; the multicall caller catches the decode failure
// and shows "older steward — bounds unavailable" on the panel.

const riskParamConfig = {
  type: "tuple",
  components: [
    { name: "minDelay", type: "uint40" },
    { name: "maxPercentChange", type: "uint256" },
  ],
} as const;

export const riskStewardAbi = [
  {
    type: "function",
    name: "getRiskConfig",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        type: "tuple",
        components: [
          {
            name: "collateralConfig",
            type: "tuple",
            components: [
              { ...riskParamConfig, name: "ltv" },
              { ...riskParamConfig, name: "liquidationThreshold" },
              { ...riskParamConfig, name: "liquidationBonus" },
              { ...riskParamConfig, name: "debtCeiling" },
            ],
          },
          {
            name: "eModeConfig",
            type: "tuple",
            components: [
              { ...riskParamConfig, name: "ltv" },
              { ...riskParamConfig, name: "liquidationThreshold" },
              { ...riskParamConfig, name: "liquidationBonus" },
            ],
          },
          {
            name: "rateConfig",
            type: "tuple",
            components: [
              { ...riskParamConfig, name: "baseVariableBorrowRate" },
              { ...riskParamConfig, name: "variableRateSlope1" },
              { ...riskParamConfig, name: "variableRateSlope2" },
              { ...riskParamConfig, name: "optimalUsageRatio" },
            ],
          },
          {
            name: "capConfig",
            type: "tuple",
            components: [
              { ...riskParamConfig, name: "supplyCap" },
              { ...riskParamConfig, name: "borrowCap" },
            ],
          },
          {
            name: "priceCapConfig",
            type: "tuple",
            components: [
              { ...riskParamConfig, name: "priceCapLst" },
              { ...riskParamConfig, name: "priceCapStable" },
              { ...riskParamConfig, name: "discountRatePendle" },
            ],
          },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "getTimelock",
    stateMutability: "view",
    inputs: [{ name: "asset", type: "address" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "supplyCapLastUpdated", type: "uint40" },
          { name: "borrowCapLastUpdated", type: "uint40" },
          { name: "ltvLastUpdated", type: "uint40" },
          { name: "liquidationBonusLastUpdated", type: "uint40" },
          { name: "liquidationThresholdLastUpdated", type: "uint40" },
          { name: "debtCeilingLastUpdated", type: "uint40" },
          { name: "baseVariableRateLastUpdated", type: "uint40" },
          { name: "variableRateSlope1LastUpdated", type: "uint40" },
          { name: "variableRateSlope2LastUpdated", type: "uint40" },
          { name: "optimalUsageRatioLastUpdated", type: "uint40" },
          { name: "priceCapLastUpdated", type: "uint40" },
        ],
      },
    ],
  },
  // True if the steward refuses ALL updates for this address (asset OR oracle).
  // When true, every per-param bound and cooldown is moot — the call reverts with
  // AssetIsRestricted/OracleIsRestricted regardless of how green the badges look.
  {
    type: "function",
    name: "isAddressRestricted",
    stateMutability: "view",
    inputs: [{ name: "contractAddress", type: "address" }],
    outputs: [{ type: "bool" }],
  },
] as const;

// Legacy shape for older RiskSteward deployments (e.g. AaveV3EthereumEtherFi). The
// flat layout has 12 RiskParamConfigs (vs 16 in the modern shape): the modern Config
// minus EmodeConfig (3) and minus discountRatePendle (1). Total ABI-encoded bytes
// for getRiskConfig: 12 * 64 = 768 (vs 1024 for modern). The Debounce struct is 10
// uint40 fields — drops priceCapLastUpdated. None of the dashboard's displayed
// columns need eMode or pendle data, so all 10 cells render fully on the legacy
// shape too.

export const riskStewardLegacyAbi = [
  {
    type: "function",
    name: "getRiskConfig",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        type: "tuple",
        components: [
          {
            name: "collateralConfig",
            type: "tuple",
            components: [
              { ...riskParamConfig, name: "ltv" },
              { ...riskParamConfig, name: "liquidationThreshold" },
              { ...riskParamConfig, name: "liquidationBonus" },
              { ...riskParamConfig, name: "debtCeiling" },
            ],
          },
          {
            name: "rateConfig",
            type: "tuple",
            components: [
              { ...riskParamConfig, name: "baseVariableBorrowRate" },
              { ...riskParamConfig, name: "variableRateSlope1" },
              { ...riskParamConfig, name: "variableRateSlope2" },
              { ...riskParamConfig, name: "optimalUsageRatio" },
            ],
          },
          {
            name: "capConfig",
            type: "tuple",
            components: [
              { ...riskParamConfig, name: "supplyCap" },
              { ...riskParamConfig, name: "borrowCap" },
            ],
          },
          {
            name: "priceCapConfig",
            type: "tuple",
            components: [
              { ...riskParamConfig, name: "priceCapLst" },
              { ...riskParamConfig, name: "priceCapStable" },
            ],
          },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "getTimelock",
    stateMutability: "view",
    inputs: [{ name: "asset", type: "address" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "supplyCapLastUpdated", type: "uint40" },
          { name: "borrowCapLastUpdated", type: "uint40" },
          { name: "ltvLastUpdated", type: "uint40" },
          { name: "liquidationBonusLastUpdated", type: "uint40" },
          { name: "liquidationThresholdLastUpdated", type: "uint40" },
          { name: "debtCeilingLastUpdated", type: "uint40" },
          { name: "baseVariableRateLastUpdated", type: "uint40" },
          { name: "variableRateSlope1LastUpdated", type: "uint40" },
          { name: "variableRateSlope2LastUpdated", type: "uint40" },
          { name: "optimalUsageRatioLastUpdated", type: "uint40" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "isAddressRestricted",
    stateMutability: "view",
    inputs: [{ name: "contractAddress", type: "address" }],
    outputs: [{ type: "bool" }],
  },
] as const;
