// Multicall3 self-calls for chain meta. Same address as the aggregator we already
// hit, so these are free inner calls inside an existing multicall round-trip.
export const multicall3Abi = [
  {
    type: "function",
    name: "getBlockNumber",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "getCurrentBlockTimestamp",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;
