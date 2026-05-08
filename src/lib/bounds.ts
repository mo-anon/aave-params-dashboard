// Bound math ported from risksteward-ci/src/PreflightCheck.sol:326.
//   relative: maxAbsDelta = current * maxPercentChange / 10_000
//   absolute: maxAbsDelta = maxPercentChange (already in bps)

const BPS_MAX = 10_000n;

export type Bound = {
  /** Absolute max change allowed in a single call, in the param's native units. */
  maxAbsDelta: bigint;
  /** Display string for the bound itself (e.g. "5%" relative, "50 bps" absolute). */
  display: string;
  /** True if the parameter is locked (maxPercentChange = 0). */
  locked: boolean;
};

export function relativeBound(current: bigint, maxPercentChangeBps: bigint): Bound {
  return {
    maxAbsDelta: (current * maxPercentChangeBps) / BPS_MAX,
    display: bpsToPct(maxPercentChangeBps),
    locked: maxPercentChangeBps === 0n,
  };
}

export function absoluteBound(maxPercentChangeBps: bigint): Bound {
  return {
    maxAbsDelta: maxPercentChangeBps,
    display: `${maxPercentChangeBps} bps`,
    locked: maxPercentChangeBps === 0n,
  };
}

export function bpsToPct(bps: bigint): string {
  const whole = bps / 100n;
  const frac = bps % 100n;
  if (frac === 0n) return `${whole}%`;
  return `${whole}.${frac.toString().padStart(2, "0")}%`;
}
