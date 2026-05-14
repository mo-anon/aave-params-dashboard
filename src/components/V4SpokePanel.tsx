import { useState } from "react";
import type { V4Deployment, V4Spoke } from "../chains";
import { fetchV4SpokeSnapshot, type V4SpokeSnapshot } from "../lib/fetchV4";
import { chainLogoUrl } from "../lib/logos";
import { RpcInput } from "./RpcInput";
import { V4AssetTable } from "./V4AssetTable";
import { Logo } from "./Logo";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; snapshot: V4SpokeSnapshot }
  | { kind: "error"; message: string };

type Props = {
  deployment: V4Deployment;
  spoke: V4Spoke;
  rpcUrl: string;
  hasOverride: boolean;
  onRpcChange: (next: string) => void;
  onResetRpc: () => void;
};

export function V4SpokePanel({
  deployment,
  spoke,
  rpcUrl,
  hasOverride,
  onRpcChange,
  onResetRpc,
}: Props) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [open, setOpen] = useState(false);

  const fetchNow = async () => {
    const url = rpcUrl.trim();
    if (!url) {
      setStatus({ kind: "error", message: "Paste an RPC URL first." });
      return;
    }
    setStatus({ kind: "loading" });
    try {
      const snapshot = await fetchV4SpokeSnapshot(deployment, spoke, url);
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
            <strong>{spoke.label}</strong>
            <span className="dim" style={{ fontSize: 11 }}>{spoke.name}</span>
            <span
              className="badge muted"
              title="V4 has no RiskSteward — params change via the spoke's ConfigPositionManager / SpokeConfigurator under the AccessManager."
            >
              no steward
            </span>
          </div>
          <MetaLine status={status} spoke={spoke} />
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
      {open && status.kind === "ready" && <V4AssetTable snapshot={status.snapshot} />}
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

function MetaLine({ status, spoke }: { status: Status; spoke: V4Spoke }) {
  if (status.kind !== "ready")
    return (
      <span className="dim" style={{ fontSize: 11 }}>
        primary hub: <code>{spoke.primaryHub}</code>
      </span>
    );
  const s = status.snapshot;
  const block = s.blockNumber !== null ? `block #${s.blockNumber.toString()}` : "block ?";
  const blockTime =
    s.blockTimestamp !== null ? new Date(s.blockTimestamp * 1000).toLocaleTimeString() : null;
  return (
    <span className="dim" style={{ fontSize: 11, display: "inline-flex", flexWrap: "wrap", gap: 6 }}>
      <span>primary hub: <code>{spoke.primaryHub}</code></span>
      <span>·</span>
      <span>{s.reserves.length} reserves</span>
      <span>·</span>
      <span title="multicall round-trips this fetch issued">{s.rpcCalls} RPC</span>
      <span>·</span>
      <span title={blockTime ? `block timestamp: ${blockTime}` : undefined}>{block}</span>
      <span>·</span>
      <span title="local fetch time">{new Date(s.fetchedAtMs).toLocaleTimeString()}</span>
    </span>
  );
}

function StatusBadge({ status }: { status: Status }) {
  if (status.kind === "idle") return <span className="badge muted">idle</span>;
  if (status.kind === "loading") return <span className="badge warn">loading</span>;
  if (status.kind === "error") return <span className="badge err">error</span>;
  return <span className="badge ok">ready</span>;
}
