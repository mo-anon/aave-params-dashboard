export const poolAbi = [
  {
    type: "function",
    name: "getReservesList",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address[]" }],
  },
  {
    type: "function",
    name: "getConfiguration",
    stateMutability: "view",
    inputs: [{ name: "asset", type: "address" }],
    outputs: [
      {
        type: "tuple",
        components: [{ name: "data", type: "uint256" }],
      },
    ],
  },
  {
    type: "function",
    name: "RESERVE_INTEREST_RATE_STRATEGY",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
] as const;

// v3.3 pool extras Horizon uses. RESERVE_INTEREST_RATE_STRATEGY reverts on the
// Horizon pool — each asset carries its own strategy slot inside `getReserveData`
// (index 11), so the Horizon fetcher reads that instead.
//   - getReserveData (v3.3 struct, 15 fields incl. deficit-replacing __deprecatedStableBorrowRate)
//   - getReserveDeficit (new in v3.3)
export const poolHorizonAbi = [
  {
    type: "function",
    name: "getReservesList",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address[]" }],
  },
  {
    type: "function",
    name: "getConfiguration",
    stateMutability: "view",
    inputs: [{ name: "asset", type: "address" }],
    outputs: [
      {
        type: "tuple",
        components: [{ name: "data", type: "uint256" }],
      },
    ],
  },
  {
    type: "function",
    name: "getReserveData",
    stateMutability: "view",
    inputs: [{ name: "asset", type: "address" }],
    outputs: [
      {
        type: "tuple",
        components: [
          {
            name: "configuration",
            type: "tuple",
            components: [{ name: "data", type: "uint256" }],
          },
          { name: "liquidityIndex", type: "uint128" },
          { name: "currentLiquidityRate", type: "uint128" },
          { name: "variableBorrowIndex", type: "uint128" },
          { name: "currentVariableBorrowRate", type: "uint128" },
          { name: "deprecatedStableBorrowRate", type: "uint128" },
          { name: "lastUpdateTimestamp", type: "uint40" },
          { name: "id", type: "uint16" },
          { name: "aTokenAddress", type: "address" },
          { name: "stableDebtTokenAddress", type: "address" },
          { name: "variableDebtTokenAddress", type: "address" },
          { name: "interestRateStrategyAddress", type: "address" },
          { name: "accruedToTreasury", type: "uint128" },
          { name: "unbacked", type: "uint128" },
          { name: "isolationModeTotalDebt", type: "uint128" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "getReserveDeficit",
    stateMutability: "view",
    inputs: [{ name: "asset", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;
