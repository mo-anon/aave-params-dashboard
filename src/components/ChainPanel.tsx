import { useState } from "react";
import type { Deployment } from "../chains";
import { fetchChainSnapshot, type ChainSnapshot } from "../lib/fetchChain";
import { chainLogoUrl } from "../lib/logos";
import { RpcInput } from "./RpcInput";
import { AssetTable, type DisplayFlags } from "./AssetTable";
import { Logo } from "./Logo";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; snapshot: ChainSnapshot }
  | { kind: "error"; message: string };

type Props = {
  deployment: Deployment;
  rpcUrl: string;
  hasOverride: boolean;
  onRpcChange: (next: string) => void;
  onResetRpc: () => void;
  flags: DisplayFlags;
};

export function ChainPanel({
  deployment,
  rpcUrl,
  hasOverride,
  onRpcChange,
  onResetRpc,
  flags,
}: Props) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [open, setOpen] = useState(false);

  // App pre-fills the displayed value with deployment.defaultRpc when there's no
  // user override, so rpcUrl is always the URL we should fetch with.
  const fetchNow = async () => {
    const url = rpcUrl.trim();
    if (!url) {
      setStatus({ kind: "error", message: "Paste an RPC URL first." });
      return;
    }
    setStatus({ kind: "loading" });
    try {
      const snapshot = await fetchChainSnapshot(deployment, url);
      setStatus({ kind: "ready", snapshot });
      setOpen(true);
    } catch (e) {
      setStatus({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <section className="panel">
      <header className="panel-header" style={{ alignItems: "flex-start" }}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          style={{ background: "transparent", border: "none", padding: 0, fontSize: 12, marginTop: 2 }}
          title={open ? "collapse" : "expand"}
        >
          {open ? "[-]" : "[+]"}
        </button>
        <Logo src={chainLogoUrl(deployment.chainId)} alt={deployment.name} size={18} rounded />
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 240 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <strong>{deployment.name}</strong>
            <span className="dim" style={{ fontSize: 11 }}>
              chainId {deployment.chainId}
            </span>
          </div>
          <MetaLine status={status} />
        </div>
        <RpcInput value={rpcUrl} onChange={onRpcChange} />
        {hasOverride && deployment.defaultRpc && (
          <button
            type="button"
            onClick={onResetRpc}
            title={`reset to public default: ${deployment.defaultRpc}`}
          >
            ↺
          </button>
        )}
        <button type="button" onClick={fetchNow} disabled={status.kind === "loading"}>
          {status.kind === "loading" ? "…" : "fetch"}
        </button>
        <StatusBadge status={status} />
      </header>
      {open && status.kind === "ready" && (
        <AssetTable snapshot={status.snapshot} flags={flags} />
      )}
      {open && status.kind === "error" && (
        <div
          style={{
            padding: 10,
            color: "var(--err-fg)",
            background: "var(--err-bg)",
            fontFamily: "inherit",
            fontSize: 12,
          }}
        >
          {status.message}
        </div>
      )}
    </section>
  );
}

function MetaLine({ status }: { status: Status }) {
  if (status.kind !== "ready") return <span className="dim" style={{ fontSize: 11 }}>—</span>;
  const s = status.snapshot;
  const block = s.blockNumber !== null ? `block #${s.blockNumber.toString()}` : "block ?";
  const blockTime =
    s.blockTimestamp !== null ? new Date(s.blockTimestamp * 1000).toLocaleTimeString() : null;
  return (
    <span className="dim" style={{ fontSize: 11, display: "inline-flex", flexWrap: "wrap", gap: 6 }}>
      <span>{s.assets.length} assets</span>
      <span>·</span>
      <span title="multicall round-trips this fetch issued">{s.rpcCalls} RPC</span>
      <span>·</span>
      <span title={blockTime ? `block timestamp: ${blockTime}` : undefined}>{block}</span>
      <span>·</span>
      <span title="local fetch time">
        {new Date(s.fetchedAtMs).toLocaleTimeString()}
      </span>
      {s.isLegacySteward && (
        <>
          <span>·</span>
          <span title="12-RiskParamConfig shape (modern minus eMode and pendle)">
            legacy steward
          </span>
        </>
      )}
      {s.riskConfigError && (
        <>
          <span>·</span>
          <span style={{ color: "var(--err-fg)" }}>{s.riskConfigError}</span>
        </>
      )}
    </span>
  );
}

function StatusBadge({ status }: { status: Status }) {
  if (status.kind === "idle") return <span className="badge muted">idle</span>;
  if (status.kind === "loading") return <span className="badge warn">loading</span>;
  if (status.kind === "error") return <span className="badge err">error</span>;
  if (status.snapshot.riskConfigError)
    return <span className="badge err">no steward config</span>;
  if (status.snapshot.isLegacySteward)
    return <span className="badge ok" title="legacy 12-RiskParamConfig shape">ok · legacy</span>;
  return <span className="badge ok">ready</span>;
}
