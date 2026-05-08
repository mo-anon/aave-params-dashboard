export const erc20Abi = [
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
] as const;

// MKR (and a few other early Ethereum tokens) declares symbol/name as bytes32 instead
// of string. The standard `string` decode silently fails, so we always fire a parallel
// bytes32 read and use whichever returns a non-empty value.
export const erc20Bytes32Abi = [
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bytes32" }],
  },
] as const;
