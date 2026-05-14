// Aave V4 Spoke read-only ABI. Subset of ISpoke needed to render reserve params,
// liquidation config, and basic supply/debt totals.
//
// Sources:
//   - aave/aave-v4 src/spoke/interfaces/ISpoke.sol
//   - aave/aave-v4 src/spoke/libraries/ReserveFlagsMap.sol  (flags bit layout)

export const v4SpokeAbi = [
  {
    type: "function",
    name: "getReserveCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "getLiquidationConfig",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "targetHealthFactor", type: "uint128" },
          { name: "healthFactorForMaxBonus", type: "uint64" },
          { name: "liquidationBonusFactor", type: "uint16" },
        ],
      },
    ],
  },
  // Reserve struct: underlying, hub (IHubBase), assetId, decimals, collateralRisk,
  // flags (ReserveFlags = uint8 user-defined), dynamicConfigKey
  {
    type: "function",
    name: "getReserve",
    stateMutability: "view",
    inputs: [{ name: "reserveId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "underlying", type: "address" },
          { name: "hub", type: "address" },
          { name: "assetId", type: "uint16" },
          { name: "decimals", type: "uint8" },
          { name: "collateralRisk", type: "uint24" },
          { name: "flags", type: "uint8" },
          { name: "dynamicConfigKey", type: "uint32" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "getReserveConfig",
    stateMutability: "view",
    inputs: [{ name: "reserveId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "collateralRisk", type: "uint24" },
          { name: "paused", type: "bool" },
          { name: "frozen", type: "bool" },
          { name: "borrowable", type: "bool" },
          { name: "receiveSharesEnabled", type: "bool" },
        ],
      },
    ],
  },
  // collateralFactor (bps), maxLiquidationBonus (raw, 10_000 = 0% bonus), liquidationFee (bps)
  {
    type: "function",
    name: "getDynamicReserveConfig",
    stateMutability: "view",
    inputs: [
      { name: "reserveId", type: "uint256" },
      { name: "dynamicConfigKey", type: "uint32" },
    ],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "collateralFactor", type: "uint16" },
          { name: "maxLiquidationBonus", type: "uint32" },
          { name: "liquidationFee", type: "uint16" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "getReserveSuppliedAssets",
    stateMutability: "view",
    inputs: [{ name: "reserveId", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "getReserveTotalDebt",
    stateMutability: "view",
    inputs: [{ name: "reserveId", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

// ReserveFlags bit layout (ReserveFlagsMap.sol):
export const RESERVE_FLAG_PAUSED = 0x01;
export const RESERVE_FLAG_FROZEN = 0x02;
export const RESERVE_FLAG_BORROWABLE = 0x04;
export const RESERVE_FLAG_RECEIVE_SHARES = 0x08;
