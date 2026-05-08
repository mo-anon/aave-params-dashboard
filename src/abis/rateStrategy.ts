// IDefaultInterestRateStrategyV2.getInterestRateDataBps — values are in bps
// (10000 = 100%). Same shape used by RiskSteward.updateRates input.
export const rateStrategyAbi = [
  {
    type: "function",
    name: "getInterestRateDataBps",
    stateMutability: "view",
    inputs: [{ name: "reserve", type: "address" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "optimalUsageRatio", type: "uint16" },
          { name: "baseVariableBorrowRate", type: "uint32" },
          { name: "variableRateSlope1", type: "uint32" },
          { name: "variableRateSlope2", type: "uint32" },
        ],
      },
    ],
  },
] as const;
