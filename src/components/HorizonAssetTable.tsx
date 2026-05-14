import { useState } from "react";
import type { HorizonAssetKind, HorizonAssetRow, HorizonSnapshot } from "../lib/fetchHorizon";
import { liqBonusOverPar } from "../lib/reserveConfig";
import { fmtAddr, fmtBps, fmtCap, fmtDebtCeiling } from "../lib/format";
import { tokenLogoUrl } from "../lib/logos";
import { explorerAddressUrl } from "../chains";
import { Logo } from "./Logo";

type KindFilter = "all" | HorizonAssetKind;

type SortKey = "supplyCap" | "borrowCap";
type SortDir = "asc" | "desc";
type Sort = { key: SortKey; dir: SortDir } | null;

const SORT_GETTERS: Record<SortKey, (a: HorizonAssetRow) => bigint> = {
  supplyCap: (a) => a.config.supplyCap,
  borrowCap: (a) => a.config.borrowCap,
};

function nextSort(current: Sort, key: SortKey): Sort {
  if (!current || current.key !== key) return { key, dir: "desc" };
  if (current.dir === "desc") return { key, dir: "asc" };
  return null;
}

function sortAssets(assets: HorizonAssetRow[], sort: Sort): HorizonAssetRow[] {
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

function KindBadge({ kind }: { kind: HorizonAssetKind }) {
  if (kind === "rwa")
    return (
      <span
        className="badge"
        style={{
          background: "#e6dcef",
          color: "#4a2a6f",
          borderColor: "#c2a8d4",
        }}
        title="permissioned RWA — collateral-only. Cannot be borrowed; aToken is non-transferable by holder."
      >
        rwa
      </span>
    );
  if (kind === "borrowable")
    return (
      <span
        className="badge"
        style={{
          background: "#dbe7f0",
          color: "#1f4a6a",
          borderColor: "#a0c0d4",
        }}
        title="permissionless borrowable — supplied to earn yield, borrowed against RWA collateral. LT == 0, so not usable as collateral itself."
      >
        borrow
      </span>
    );
  return (
    <span className="badge muted" title="reserve config doesn't match either standard Horizon pattern">
      other
    </span>
  );
}

function StateBadges({ row }: { row: HorizonAssetRow }) {
  const c = row.config;
  const out: JSX.Element[] = [];
  if (!c.active) out.push(<span key="ina" className="badge err" title="reserve.active == false">inactive</span>);
  if (c.paused) out.push(<span key="pau" className="badge err" title="all user actions paused">paused</span>);
  if (c.frozen) out.push(<span key="fro" className="badge warn" title="supply/borrow disabled; repay/withdraw allowed">frozen</span>);
  return out.length > 0 ? <span style={{ display: "inline-flex", gap: 4 }}>{out}</span> : null;
}

function pickValue(value: string, applicable: boolean, why?: string): JSX.Element {
  return applicable ? (
    <span>{value}</span>
  ) : (
    <span className="dim" title={why}>—</span>
  );
}

export function HorizonAssetTable({ snapshot }: { snapshot: HorizonSnapshot }) {
  const [sort, setSort] = useState<Sort>(null);
  const [filter, setFilter] = useState<KindFilter>("all");
  if (snapshot.assets.length === 0) {
    return <div style={{ padding: 12, color: "#8b949e" }}>No reserves listed.</div>;
  }

  const filtered =
    filter === "all" ? snapshot.assets : snapshot.assets.filter((a) => a.kind === filter);
  const ordered = sortAssets(filtered, sort);

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

  const counts = snapshot.assets.reduce(
    (acc, a) => {
      acc[a.kind] = (acc[a.kind] ?? 0) + 1;
      return acc;
    },
    {} as Record<HorizonAssetKind, number>,
  );

  return (
    <>
      <div
        style={{
          padding: "8px 10px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          gap: 6,
          alignItems: "center",
          fontSize: 12,
          flexWrap: "wrap",
        }}
      >
        <span className="dim"># filter</span>
        <KindFilterButton on={filter === "all"} onClick={() => setFilter("all")}>
          all ({snapshot.assets.length})
        </KindFilterButton>
        <KindFilterButton on={filter === "rwa"} onClick={() => setFilter("rwa")}>
          rwa ({counts.rwa ?? 0})
        </KindFilterButton>
        <KindFilterButton on={filter === "borrowable"} onClick={() => setFilter("borrowable")}>
          borrowable ({counts.borrowable ?? 0})
        </KindFilterButton>
        {(counts.other ?? 0) > 0 && (
          <KindFilterButton on={filter === "other"} onClick={() => setFilter("other")}>
            other ({counts.other})
          </KindFilterButton>
        )}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Asset</th>
              <th>kind</th>
              <SortableTh k="supplyCap" label="supplyCap" />
              <SortableTh k="borrowCap" label="borrowCap" />
              <th>LTV</th>
              <th>liqThr</th>
              <th>liqBonus</th>
              <th>debtCeil</th>
              <th>RF</th>
              <th>optU</th>
              <th>baseVar</th>
              <th>slope1</th>
              <th>slope2</th>
              <th>state</th>
              <th>deficit</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((row) => {
              const explorerUrl = explorerAddressUrl(snapshot.deployment, row.address);
              const c = row.config;
              const r = row.rate;
              const isRwa = row.kind === "rwa";
              const isBorrow = row.kind === "borrowable";
              const liqBonusOver = liqBonusOverPar(c.liqBonus);

              return (
                <tr key={row.address}>
                  <td title={row.address}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <Logo
                        src={tokenLogoUrl(snapshot.deployment.chainId, row.address)}
                        alt={row.symbol}
                        size={16}
                        rounded
                      />
                      <strong>{row.symbol}</strong>
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
                  <td><KindBadge kind={row.kind} /></td>
                  <td>{fmtCap(c.supplyCap)}</td>
                  <td>
                    {pickValue(
                      fmtCap(c.borrowCap),
                      isBorrow || c.borrowEnabled,
                      "borrowing disabled at config level — cap is unused",
                    )}
                  </td>
                  <td>{pickValue(fmtBps(c.ltv), isRwa || c.ltv > 0n, "LTV == 0 → not collateral")}</td>
                  <td>
                    {pickValue(
                      fmtBps(c.liqThreshold),
                      isRwa || c.liqThreshold > 0n,
                      "liqThreshold == 0 → cannot be used as collateral",
                    )}
                  </td>
                  <td>
                    {pickValue(
                      liqBonusOver === 0n ? "—" : fmtBps(liqBonusOver),
                      isRwa || liqBonusOver > 0n,
                    )}
                  </td>
                  <td>{fmtDebtCeiling(c.debtCeiling)}</td>
                  <td>{fmtBps(c.reserveFactor)}</td>
                  <td>{r ? fmtBps(r.optimalUsageRatio) : "—"}</td>
                  <td>{r ? fmtBps(r.baseVariableBorrowRate) : "—"}</td>
                  <td>{r ? fmtBps(r.variableRateSlope1) : "—"}</td>
                  <td>{r ? fmtBps(r.variableRateSlope2) : "—"}</td>
                  <td><StateBadges row={row} /></td>
                  <td title={row.deficit === 0n ? "no bad-debt deficit on this reserve" : `${row.deficit.toString()} (base currency 8-decimal)`}>
                    {row.deficit === 0n ? <span className="dim">0</span> : row.deficit.toString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function KindFilterButton({
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
