// Cooldown helpers ported from risksteward-ci/src/PreflightCheck.sol:276.
//
//   lastUpdated == 0       -> "n/a" (never moved by steward; cooldown irrelevant)
//   elapsed >= minDelay    -> ready
//   else                    -> remaining = minDelay - elapsed

export type Cooldown =
  | { state: "ready"; minDelaySeconds: number; neverMoved: boolean }
  | { state: "waiting"; remainingSeconds: number; minDelaySeconds: number };

// `lastUpdated == 0` means the steward has never moved this param for this asset.
// Operationally that's identical to "cooldown elapsed" (no wait gates the next move),
// so collapse both into `ready`. The `neverMoved` flag is preserved for tooltips.
export function computeCooldown(
  lastUpdated: number,
  minDelaySeconds: number,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Cooldown {
  if (lastUpdated === 0) {
    return { state: "ready", minDelaySeconds, neverMoved: true };
  }
  const elapsed = nowSeconds - lastUpdated;
  if (elapsed >= minDelaySeconds) {
    return { state: "ready", minDelaySeconds, neverMoved: false };
  }
  return { state: "waiting", remainingSeconds: minDelaySeconds - elapsed, minDelaySeconds };
}

export function formatDuration(s: number): string {
  if (s <= 0) return "0s";
  if (s >= 86400) {
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    return h > 0 ? `${d}d ${h}h` : `${d}d`;
  }
  if (s >= 3600) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  if (s >= 60) return `${Math.floor(s / 60)}m`;
  return `${s}s`;
}
