import { bpsToPct } from "./bounds";

/** bps (10000 = 100%) -> "X.YY%". */
export const fmtBps = (b: bigint): string => bpsToPct(b);

/** Whole-token cap -> "1.5K" / "12.3M" / "500K". Caps are stored as whole tokens (no decimals). */
export function fmtCap(c: bigint): string {
  if (c === 0n) return "0";
  if (c >= 1_000_000_000n) return `${(Number(c) / 1e9).toFixed(2)}B`;
  if (c >= 1_000_000n) return `${(Number(c) / 1e6).toFixed(2)}M`;
  if (c >= 1_000n) return `${(Number(c) / 1e3).toFixed(2)}K`;
  return c.toString();
}

/** Debt ceiling is stored 8-decimal scaled with DEBT_CEILING_DECIMALS = 2 -> divide by 100 for USD. */
export function fmtDebtCeiling(c: bigint): string {
  if (c === 0n) return "—";
  const usd = c / 100n;
  return fmtCap(usd) + " $";
}

export const fmtAddr = (a: string): string => `${a.slice(0, 6)}…${a.slice(-4)}`;
