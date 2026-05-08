import { useState } from "react";
import type { AssetRow, ChainSnapshot, RiskConfig, Timelock } from "../lib/fetchChain";
import { liqBonusOverPar } from "../lib/reserveConfig";
import { absoluteBound, relativeBound, type Bound } from "../lib/bounds";
import { computeCooldown, formatDuration } from "../lib/cooldown";
import { fmtAddr, fmtBps, fmtCap, fmtDebtCeiling } from "../lib/format";
import { tokenLogoUrl } from "../lib/logos";
import { explorerAddressUrl } from "../chains";
import { Logo } from "./Logo";

type CellInput = {
  current: string;        // formatted display value
  bound: Bound | null;    // null when bounds unavailable (older steward)
  cooldown: ReturnType<typeof computeCooldown> | null;
};

export type DisplayFlags = { showBounds: boolean; showCooldowns: boolean };

function Cell({ current, bound, cooldown, flags }: CellInput & { flags: DisplayFlags }) {
  return (
    <td>
      <div className="cell-stack">
        <span>{current}</span>
        {flags.showBounds && bound && !bound.locked && (
          <span className="sub">±{bound.display}</span>
        )}
        {flags.showBounds && bound && bound.locked && (
          <span className="sub badge muted">locked</span>
        )}
        {flags.showBounds && !bound && (
          <span
            className="sub"
            title="bound unavailable — this deployment uses an older RiskSteward whose getRiskConfig() returns a flat (pre-nested) shape that the dashboard cannot decode."
          >
            —
          </span>
        )}
        {flags.showCooldowns && cooldown && cooldown.state === "ready" && (
          <span
            className="badge ok"
            title={
              cooldown.neverMoved
                ? "lastUpdated == 0 — the steward has never moved this param on this asset. No cooldown blocks you."
                : `cooldown elapsed (min delay ${formatDuration(cooldown.minDelaySeconds)})`
            }
          >
            ready
          </span>
        )}
        {flags.showCooldowns && cooldown && cooldown.state === "waiting" && (
          <span
            className="badge warn"
            title={`min delay ${formatDuration(cooldown.minDelaySeconds)}`}
          >
            {formatDuration(cooldown.remainingSeconds)}
          </span>
        )}
      </div>
    </td>
  );
}

function makeCell(
  current: string,
  cfgBound: { minDelay: number; maxPercentChange: bigint } | undefined,
  isRelative: boolean,
  currentValue: bigint | null,
  lastUpdated: number | undefined,
  riskConfigAvailable: boolean,
  nowSeconds: number,
): CellInput {
  if (!riskConfigAvailable || !cfgBound) {
    return { current, bound: null, cooldown: null };
  }
  const bound = isRelative
    ? relativeBound(currentValue ?? 0n, cfgBound.maxPercentChange)
    : absoluteBound(cfgBound.maxPercentChange);
  const cooldown =
    lastUpdated !== undefined
      ? computeCooldown(lastUpdated, Number(cfgBound.minDelay), nowSeconds)
      : null;
  return { current, bound, cooldown };
}

function buildRow(
  asset: AssetRow,
  riskConfig: RiskConfig | null,
  nowSeconds: number,
): { key: string; cells: CellInput[]; symbol: string; address: string; restricted: boolean } {
  const c = asset.config;
  const tl: Timelock | null = asset.timelock;
  const rc = riskConfig;
  const haveRc = rc !== null;

  const supplyCap = makeCell(
    fmtCap(c.supplyCap),
    rc?.capConfig.supplyCap,
    /* relative */ true,
    c.supplyCap,
    tl?.supplyCapLastUpdated,
    haveRc,
    nowSeconds,
  );
  const borrowCap = makeCell(
    fmtCap(c.borrowCap),
    rc?.capConfig.borrowCap,
    true,
    c.borrowCap,
    tl?.borrowCapLastUpdated,
    haveRc,
    nowSeconds,
  );
  const ltv = makeCell(
    fmtBps(c.ltv),
    rc?.collateralConfig.ltv,
    /* absolute */ false,
    c.ltv,
    tl?.ltvLastUpdated,
    haveRc,
    nowSeconds,
  );
  const liqThr = makeCell(
    fmtBps(c.liqThreshold),
    rc?.collateralConfig.liquidationThreshold,
    false,
    c.liqThreshold,
    tl?.liquidationThresholdLastUpdated,
    haveRc,
    nowSeconds,
  );
  const liqBonusOver = liqBonusOverPar(c.liqBonus);
  const liqBonus = makeCell(
    liqBonusOver === 0n ? "—" : fmtBps(liqBonusOver),
    rc?.collateralConfig.liquidationBonus,
    false,
    liqBonusOver,
    tl?.liquidationBonusLastUpdated,
    haveRc,
    nowSeconds,
  );
  const debtCeiling = makeCell(
    fmtDebtCeiling(c.debtCeiling),
    rc?.collateralConfig.debtCeiling,
    true,
    c.debtCeiling,
    tl?.debtCeilingLastUpdated,
    haveRc,
    nowSeconds,
  );

  const r = asset.rate;
  const optU = makeCell(
    r ? fmtBps(r.optimalUsageRatio) : "—",
    rc?.rateConfig.optimalUsageRatio,
    false,
    r?.optimalUsageRatio ?? 0n,
    tl?.optimalUsageRatioLastUpdated,
    haveRc && r !== null,
    nowSeconds,
  );
  const baseVar = makeCell(
    r ? fmtBps(r.baseVariableBorrowRate) : "—",
    rc?.rateConfig.baseVariableBorrowRate,
    false,
    r?.baseVariableBorrowRate ?? 0n,
    tl?.baseVariableRateLastUpdated,
    haveRc && r !== null,
    nowSeconds,
  );
  const slope1 = makeCell(
    r ? fmtBps(r.variableRateSlope1) : "—",
    rc?.rateConfig.variableRateSlope1,
    false,
    r?.variableRateSlope1 ?? 0n,
    tl?.variableRateSlope1LastUpdated,
    haveRc && r !== null,
    nowSeconds,
  );
  const slope2 = makeCell(
    r ? fmtBps(r.variableRateSlope2) : "—",
    rc?.rateConfig.variableRateSlope2,
    false,
    r?.variableRateSlope2 ?? 0n,
    tl?.variableRateSlope2LastUpdated,
    haveRc && r !== null,
    nowSeconds,
  );

  return {
    key: asset.address,
    address: asset.address,
    symbol: asset.symbol,
    restricted: asset.restricted,
    cells: [supplyCap, borrowCap, ltv, liqThr, liqBonus, debtCeiling, optU, baseVar, slope1, slope2],
  };
}

type SortKey = "supplyCap" | "borrowCap";
type SortDir = "asc" | "desc";
type Sort = { key: SortKey; dir: SortDir } | null;

const SORT_GETTERS: Record<SortKey, (a: AssetRow) => bigint> = {
  supplyCap: (a) => a.config.supplyCap,
  borrowCap: (a) => a.config.borrowCap,
};

function nextSort(current: Sort, key: SortKey): Sort {
  // Cycle: (none) → desc → asc → (none).
  if (!current || current.key !== key) return { key, dir: "desc" };
  if (current.dir === "desc") return { key, dir: "asc" };
  return null;
}

function sortAssets(assets: AssetRow[], sort: Sort): AssetRow[] {
  if (!sort) return assets;
  const get = SORT_GETTERS[sort.key];
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...assets].sort((a, b) => {
    const av = get(a);
    const bv = get(b);
    if (av === bv) return 0;
    return av < bv ? -sign : sign;
  });
}

export function AssetTable({
  snapshot,
  flags,
}: {
  snapshot: ChainSnapshot;
  flags: DisplayFlags;
}) {
  const [sort, setSort] = useState<Sort>(null);
  if (snapshot.assets.length === 0) {
    return <div style={{ padding: 12, color: "#8b949e" }}>No reserves listed.</div>;
  }
  const nowSeconds = snapshot.blockTimestamp ?? Math.floor(Date.now() / 1000);
  const orderedAssets = sortAssets(snapshot.assets, sort);
  const rows = orderedAssets.map((a) => buildRow(a, snapshot.riskConfig, nowSeconds));

  const SortableTh = ({ k, label }: { k: SortKey; label: string }) => {
    const active = sort?.key === k;
    const arrow = active ? (sort!.dir === "desc" ? "▼" : "▲") : "";
    return (
      <th
        onClick={() => setSort((cur) => nextSort(cur, k))}
        style={{
          cursor: "pointer",
          userSelect: "none",
          color: active ? "var(--fg)" : undefined,
        }}
        title={`sort by ${label} (click cycles desc → asc → off)`}
      >
        {label} <span style={{ fontSize: 9 }}>{arrow || (active ? "" : "↕")}</span>
      </th>
    );
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <table>
        <thead>
          <tr>
            <th>Asset</th>
            <SortableTh k="supplyCap" label="supplyCap" />
            <SortableTh k="borrowCap" label="borrowCap" />
            <th>LTV</th>
            <th>liqThr</th>
            <th>liqBonus</th>
            <th>debtCeil</th>
            <th>optU</th>
            <th>baseVar</th>
            <th>slope1</th>
            <th>slope2</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const explorerUrl = explorerAddressUrl(snapshot.deployment, row.address);
            return (
              <tr
                key={row.key}
                style={
                  row.restricted ? { background: "var(--err-bg)", opacity: 0.85 } : undefined
                }
                title={
                  row.restricted
                    ? "RiskSteward.isAddressRestricted == true — every steward update for this asset reverts. Bounds & cooldowns shown are moot."
                    : undefined
                }
              >
                <td title={row.address}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <Logo
                      src={tokenLogoUrl(snapshot.deployment.chainId, row.address)}
                      alt={row.symbol}
                      size={16}
                      rounded
                    />
                    <strong>{row.symbol}</strong>
                    {row.restricted && (
                      <span
                        className="badge err"
                        title="RiskSteward.isAddressRestricted == true — every steward update for this asset reverts. Bounds & cooldowns shown are moot."
                      >
                        restricted
                      </span>
                    )}
                    {explorerUrl ? (
                      <a
                        href={explorerUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="dim"
                        style={{ fontSize: 10, textDecoration: "underline dotted" }}
                        title={`open ${row.address} on explorer`}
                      >
                        {fmtAddr(row.address)}
                      </a>
                    ) : (
                      <span className="dim" style={{ fontSize: 10 }}>{fmtAddr(row.address)}</span>
                    )}
                  </span>
                </td>
                {row.cells.map((cell, idx) => (
                  <Cell key={idx} {...cell} flags={flags} />
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
