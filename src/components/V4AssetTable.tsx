import { useState } from "react";
import type { V4ReserveRow, V4SpokeSnapshot } from "../lib/fetchV4";
import type { V4HubName } from "../chains";
import { explorerAddressUrl } from "../chains";
import { fmtAddr, fmtBps } from "../lib/format";
import { tokenLogoUrl } from "../lib/logos";
import { Logo } from "./Logo";

type SortKey = "supplied" | "debt";
type SortDir = "asc" | "desc";
type Sort = { key: SortKey; dir: SortDir } | null;

type HubFilter = "all" | V4HubName | "unknown";

const SORT_GETTERS: Record<SortKey, (r: V4ReserveRow) => bigint> = {
  supplied: (r) => r.suppliedAssets,
  debt: (r) => r.totalDebt,
};

function nextSort(current: Sort, key: SortKey): Sort {
  if (!current || current.key !== key) return { key, dir: "desc" };
  if (current.dir === "desc") return { key, dir: "asc" };
  return null;
}

function HubBadge({ name }: { name: V4HubName | "unknown" }) {
  const colors: Record<V4HubName | "unknown", { bg: string; fg: string; bd: string }> = {
    CORE: { bg: "#dfeacc", fg: "#3c5a16", bd: "#b6cfa0" },
    PLUS: { bg: "#e4dcef", fg: "#4a2a6f", bd: "#c2a8d4" },
    PRIME: { bg: "#dbe7f0", fg: "#1f4a6a", bd: "#a0c0d4" },
    unknown: { bg: "var(--muted-bg)", fg: "var(--muted-fg)", bd: "var(--border)" },
  };
  const c = colors[name];
  return (
    <span
      className="badge"
      style={{ background: c.bg, color: c.fg, borderColor: c.bd }}
      title={`reserve is routed through ${name}_HUB`}
    >
      {name}
    </span>
  );
}

function FlagBadges({ row }: { row: V4ReserveRow }) {
  const f = row.flags;
  const out: JSX.Element[] = [];
  if (f.paused) out.push(<span key="p" className="badge err" title="all actions paused on this reserve">paused</span>);
  if (f.frozen) out.push(<span key="f" className="badge warn" title="new supply/borrow disabled; repay/withdraw still allowed">frozen</span>);
  if (!f.borrowable) out.push(<span key="b" className="badge muted" title="reserve not borrowable">no-borrow</span>);
  if (!f.receiveSharesEnabled)
    out.push(
      <span key="rs" className="badge muted" title="liquidators cannot receive collateral shares — only underlying">no-shares</span>,
    );
  return out.length > 0 ? <span style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}>{out}</span> : null;
}

// Display CF in % from bps. Special-case 0 → "—" so the column doesn't look like
// every asset is locked when an isolated reserve actually has no collateral side.
function fmtCF(bps: bigint, hasDynamic: boolean): string {
  if (!hasDynamic) return "—";
  if (bps === 0n) return "0%";
  return fmtBps(bps);
}

// maxLiquidationBonus is stored as raw factor where 10_000 == 0% bonus. The over-par
// part is the bonus. Mirrors V3's liqBonus convention.
function fmtMaxLB(raw: bigint, hasDynamic: boolean): string {
  if (!hasDynamic) return "—";
  if (raw === 0n) return "—";
  const over = raw > 10_000n ? raw - 10_000n : 0n;
  return fmtBps(over);
}

// Token amount with `decimals`; "—" if zero. Compact suffix for readability.
function fmtTokenAmount(raw: bigint, decimals: number): string {
  if (raw === 0n) return "—";
  // Scale down to a Number with full precision lost — fine for display.
  const divisor = 10n ** BigInt(decimals);
  const whole = raw / divisor;
  const fracRaw = raw % divisor;
  // 4 decimal digits for sub-1 amounts
  if (whole === 0n) {
    const microNum = Number(fracRaw) / Number(divisor);
    return microNum.toPrecision(2);
  }
  const num = Number(whole) + Number(fracRaw) / Number(divisor);
  if (num >= 1_000_000_000) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1_000_000) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1e3).toFixed(2)}K`;
  return num.toFixed(2);
}

function fmtWAD(raw: bigint): string {
  // WAD = 1e18. Show 3 decimal digits as that's the meaningful precision for HF/factor.
  if (raw === 0n) return "0";
  const whole = raw / 10n ** 18n;
  const frac = raw % 10n ** 18n;
  const fracStr = (Number(frac) / 1e18).toFixed(3).slice(1); // strip leading "0"
  return `${whole}${fracStr}`;
}

export function V4AssetTable({ snapshot }: { snapshot: V4SpokeSnapshot }) {
  const [sort, setSort] = useState<Sort>(null);
  const [hubFilter, setHubFilter] = useState<HubFilter>("all");

  if (snapshot.reserves.length === 0) {
    return <div style={{ padding: 12, color: "#8b949e" }}>No reserves listed.</div>;
  }

  const filtered =
    hubFilter === "all" ? snapshot.reserves : snapshot.reserves.filter((r) => r.hubName === hubFilter);
  const ordered = sort
    ? [...filtered].sort((a, b) => {
        const av = SORT_GETTERS[sort.key](a);
        const bv = SORT_GETTERS[sort.key](b);
        const sign = sort.dir === "asc" ? 1 : -1;
        if (av === bv) return 0;
        return av < bv ? -sign : sign;
      })
    : filtered;

  const hubCounts = snapshot.reserves.reduce(
    (acc, r) => {
      acc[r.hubName] = (acc[r.hubName] ?? 0) + 1;
      return acc;
    },
    {} as Record<V4HubName | "unknown", number>,
  );

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

  const lc = snapshot.liquidationConfig;

  return (
    <>
      <div
        style={{
          padding: "8px 10px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          gap: 12,
          alignItems: "center",
          fontSize: 12,
          flexWrap: "wrap",
        }}
      >
        <span className="dim"># hub</span>
        <FilterButton on={hubFilter === "all"} onClick={() => setHubFilter("all")}>
          all ({snapshot.reserves.length})
        </FilterButton>
        {(["CORE", "PLUS", "PRIME"] as V4HubName[]).map(
          (hub) =>
            (hubCounts[hub] ?? 0) > 0 && (
              <FilterButton
                key={hub}
                on={hubFilter === hub}
                onClick={() => setHubFilter(hub)}
              >
                {hub} ({hubCounts[hub]})
              </FilterButton>
            ),
        )}
        {(hubCounts.unknown ?? 0) > 0 && (
          <FilterButton on={hubFilter === "unknown"} onClick={() => setHubFilter("unknown")}>
            unknown ({hubCounts.unknown})
          </FilterButton>
        )}

        {lc && (
          <span
            className="dim"
            style={{ marginLeft: "auto", display: "inline-flex", gap: 10, fontSize: 11 }}
            title="spoke-wide liquidation parameters"
          >
            <span>targetHF: <code>{fmtWAD(lc.targetHealthFactor)}</code></span>
            <span>hf_for_maxBonus: <code>{fmtWAD(lc.healthFactorForMaxBonus)}</code></span>
            <span>liqBonusFactor: <code>{fmtBps(lc.liquidationBonusFactor)}</code></span>
          </span>
        )}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Asset</th>
              <th>hub</th>
              <th>CF</th>
              <th>maxLB</th>
              <th>liqFee</th>
              <th>collatRisk</th>
              <SortableTh k="supplied" label="supplied" />
              <SortableTh k="debt" label="totalDebt" />
              <th>state</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((row) => {
              const url = explorerAddressUrl(snapshot.deployment, row.underlying);
              const dc = row.dynamicConfig;
              return (
                <tr key={row.reserveId}>
                  <td title={row.underlying}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <Logo
                        src={tokenLogoUrl(snapshot.deployment.chainId, row.underlying)}
                        alt={row.symbol}
                        size={16}
                        rounded
                      />
                      <strong>{row.symbol}</strong>
                      <span className="dim" style={{ fontSize: 10 }}>r{row.reserveId}</span>
                      {url ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="dim"
                          style={{ fontSize: 10, textDecoration: "underline dotted" }}
                          title={`open ${row.underlying} on explorer`}
                        >
                          {fmtAddr(row.underlying)}
                        </a>
                      ) : (
                        <span className="dim" style={{ fontSize: 10 }}>
                          {fmtAddr(row.underlying)}
                        </span>
                      )}
                    </span>
                  </td>
                  <td><HubBadge name={row.hubName} /></td>
                  <td>{fmtCF(dc?.collateralFactor ?? 0n, dc !== null)}</td>
                  <td>{fmtMaxLB(dc?.maxLiquidationBonus ?? 0n, dc !== null)}</td>
                  <td>{dc ? fmtBps(dc.liquidationFee) : "—"}</td>
                  <td>{row.collateralRisk === 0 ? <span className="dim">0</span> : fmtBps(BigInt(row.collateralRisk))}</td>
                  <td>{fmtTokenAmount(row.suppliedAssets, row.decimals)}</td>
                  <td>{fmtTokenAmount(row.totalDebt, row.decimals)}</td>
                  <td><FlagBadges row={row} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function FilterButton({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontSize: 12,
        padding: "2px 10px",
        borderRadius: 2,
        background: on ? "var(--accent)" : "var(--bg-alt)",
        color: on ? "var(--accent-fg)" : "var(--fg)",
        borderColor: on ? "var(--accent)" : "var(--border)",
      }}
    >
      {children}
    </button>
  );
}
