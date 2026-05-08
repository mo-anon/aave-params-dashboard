import { useEffect, useState } from "react";
import { DEPLOYMENTS } from "./chains";
import { ChainPanel } from "./components/ChainPanel";
import { ChainSelector } from "./components/ChainSelector";
import { InfoBox } from "./components/InfoBox";
import type { DisplayFlags } from "./components/AssetTable";

const RPC_KEY = "aave-params-dashboard:rpcs";
const SEL_KEY = "aave-params-dashboard:chain";
const FLAGS_KEY = "aave-params-dashboard:flags";

type RpcMap = Record<string, string>;

const DEFAULT_FLAGS: DisplayFlags = { showBounds: true, showCooldowns: true };

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [rpcs, setRpcs] = useState<RpcMap>(() => loadJSON<RpcMap>(RPC_KEY, {}));
  const [selectedChain, setSelectedChain] = useState<string | null>(() =>
    loadJSON<string | null>(SEL_KEY, null),
  );
  const [flags, setFlags] = useState<DisplayFlags>(() =>
    loadJSON<DisplayFlags>(FLAGS_KEY, DEFAULT_FLAGS),
  );

  useEffect(() => {
    localStorage.setItem(RPC_KEY, JSON.stringify(rpcs));
  }, [rpcs]);
  useEffect(() => {
    localStorage.setItem(SEL_KEY, JSON.stringify(selectedChain));
  }, [selectedChain]);
  useEffect(() => {
    localStorage.setItem(FLAGS_KEY, JSON.stringify(flags));
  }, [flags]);

  const setRpc = (name: string, url: string) =>
    setRpcs((prev) => ({ ...prev, [name]: url }));
  const resetRpc = (name: string) =>
    setRpcs((prev) => {
      // Drop the override so the public default takes over again.
      const next = { ...prev };
      delete next[name];
      return next;
    });

  const visible = selectedChain
    ? DEPLOYMENTS.filter((d) => d.name === selectedChain)
    : [];

  return (
    <main style={{ maxWidth: 1400, margin: "0 auto", padding: 20 }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>$ aave-v3-params --watch</h1>
        <p className="dim" style={{ margin: "6px 0 0", fontSize: 13 }}>
          # per-asset reserve parameters across Aave V3 deployments, with RiskSteward bound (max
          change per call) and per-asset cooldown countdowns. ships with public RPC defaults so
          you can fetch immediately; paste your own URL per chain to override. all reads are
          batched via Multicall3 — three round-trips per chain regardless of asset count.
        </p>
      </header>

      <InfoBox />

      <ChainSelector
        deployments={DEPLOYMENTS}
        selected={selectedChain}
        onSelect={setSelectedChain}
        flags={flags}
        onFlagsChange={setFlags}
      />

      {visible.length === 0 && (
        <div
          style={{
            border: "1px dashed var(--border-strong)",
            borderRadius: 2,
            padding: 20,
            textAlign: "center",
            fontSize: 13,
          }}
          className="dim"
        >
          # pick a chain above to start.
        </div>
      )}

      {visible.map((d) => {
        // Use ?? so an explicitly empty user override is preserved (clearing the
        // input doesn't snap back to the default). Reset button restores default.
        const hasOverride = d.name in rpcs;
        const rpcUrl = (hasOverride ? rpcs[d.name] : d.defaultRpc) ?? "";
        return (
          <ChainPanel
            key={d.name}
            deployment={d}
            rpcUrl={rpcUrl}
            hasOverride={hasOverride}
            onRpcChange={(url) => setRpc(d.name, url)}
            onResetRpc={() => resetRpc(d.name)}
            flags={flags}
          />
        );
      })}

      <footer className="dim" style={{ fontSize: 11, marginTop: 24 }}>
        # rpc urls and chain selection are stored in <code>localStorage</code> on this device only —
        they never leave the browser.
      </footer>
    </main>
  );
}

