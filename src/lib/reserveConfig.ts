// Bit layout ported from
// lib/aave-address-book/lib/aave-v3-origin/src/contracts/protocol/libraries/configuration/ReserveConfiguration.sol
// All bps fields are 16-bit (mask 0xFFFF). Caps are 36-bit. DebtCeiling is 40-bit.

const MASK_16 = 0xffffn;
const MASK_36 = (1n << 36n) - 1n;
const MASK_40 = (1n << 40n) - 1n;
const MASK_8 = 0xffn;

export type ReserveConfig = {
  ltv: bigint;              // bps (10000 = 100%)
  liqThreshold: bigint;     // bps
  liqBonus: bigint;         // raw on-chain form (10000 + bonus). Display strips 10000.
  decimals: bigint;
  active: boolean;
  frozen: boolean;
  paused: boolean;
  borrowEnabled: boolean;
  borrowableInIsolation: boolean;
  siloed: boolean;
  flashloanable: boolean;
  reserveFactor: bigint;    // bps
  borrowCap: bigint;        // whole tokens (no decimals)
  supplyCap: bigint;        // whole tokens
  liqProtocolFee: bigint;   // bps
  debtCeiling: bigint;      // 8-decimal scaled (DEBT_CEILING_DECIMALS = 2)
};

export function decodeReserveConfig(data: bigint): ReserveConfig {
  return {
    ltv: data & MASK_16,
    liqThreshold: (data >> 16n) & MASK_16,
    liqBonus: (data >> 32n) & MASK_16,
    decimals: (data >> 48n) & MASK_8,
    active: ((data >> 56n) & 1n) === 1n,
    frozen: ((data >> 57n) & 1n) === 1n,
    borrowEnabled: ((data >> 58n) & 1n) === 1n,
    paused: ((data >> 60n) & 1n) === 1n,
    borrowableInIsolation: ((data >> 61n) & 1n) === 1n,
    siloed: ((data >> 62n) & 1n) === 1n,
    flashloanable: ((data >> 63n) & 1n) === 1n,
    reserveFactor: (data >> 64n) & MASK_16,
    borrowCap: (data >> 80n) & MASK_36,
    supplyCap: (data >> 116n) & MASK_36,
    liqProtocolFee: (data >> 152n) & MASK_16,
    debtCeiling: (data >> 212n) & MASK_40,
  };
}

/** Strip the 100_00 base from on-chain liqBonus to get the over-par bps form
 *  RiskSteward expects (e.g. 10270 -> 270 = 2.70%). Returns 0 if 0 (asset has no bonus set). */
export function liqBonusOverPar(raw: bigint): bigint {
  if (raw === 0n) return 0n;
  return raw > 10_000n ? raw - 10_000n : raw;
}
