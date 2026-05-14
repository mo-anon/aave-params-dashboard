import { useEffect, useState } from "react";
import { DEPLOYMENTS, HORIZON_DEPLOYMENTS } from "./chains";
import { ChainPanel } from "./components/ChainPanel";
import { ChainSelector } from "./components/ChainSelector";
import { HorizonChainPanel } from "./components/HorizonChainPanel";
import { InfoBox } from "./components/InfoBox";
import { MarketTabs, type Market } from "./components/MarketTabs";
import type { DisplayFlags } from "./components/AssetTable";

const RPC_KEY = "aave-params-dashboard:rpcs";
const SEL_KEY = "aave-params-dashboard:chain";
const FLAGS_KEY = "aave-params-dashboard:flags";
const MARKET_KEY = "aave-params-dashboard:market";

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
  const [market, setMarket] = useState<Market>(() => loadJSON<Market>(MARKET_KEY, "v3"));

  useEffect(() => {
    localStorage.setItem(RPC_KEY, JSON.stringify(rpcs));
  }, [rpcs]);
  useEffect(() => {
    localStorage.setItem(SEL_KEY, JSON.stringify(selectedChain));
  }, [selectedChain]);
  useEffect(() => {
    localStorage.setItem(FLAGS_KEY, JSON.stringify(flags));
  }, [flags]);
  useEffect(() => {
    localStorage.setItem(MARKET_KEY, JSON.stringify(market));
  }, [market]);

  const setRpc = (name: string, url: string) =>
    setRpcs((prev) => ({ ...prev, [name]: url }));
  const resetRpc = (name: string) =>
    setRpcs((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });

  const visibleV3 =
    market === "v3" && selectedChain
      ? DEPLOYMENTS.filter((d) => d.name === selectedChain)
      : [];

  return (
    <main style={{ maxWidth: 1400, margin: "0 auto", padding: 20 }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>$ aave-params --watch</h1>
        <p className="dim" style={{ margin: "6px 0 0", fontSize: 13 }}>
          # per-asset reserve parameters across Aave deployments. AaveV3 tab shows the
          steward-driven instances (with bound + cooldown badges per param); Horizon tab shows
          the permissioned RWA instance (v3.3 fork, no steward). All reads are batched via
          Multicall3 with sensible public RPC defaults — paste your own URL per chain to
          override.
        </p>
      </header>

      <MarketTabs
        selected={market}
        onSelect={setMarket}
        counts={{ v3: DEPLOYMENTS.length, horizon: HORIZON_DEPLOYMENTS.length }}
      />

      <InfoBox market={market} />

      {market === "v3" ? (
        <>
          <ChainSelector
            deployments={DEPLOYMENTS}
            selected={selectedChain}
            onSelect={setSelectedChain}
            flags={flags}
            onFlagsChange={setFlags}
          />

          {visibleV3.length === 0 && (
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

          {visibleV3.map((d) => {
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
        </>
      ) : (
        <>
          {HORIZON_DEPLOYMENTS.map((d) => {
            const hasOverride = d.name in rpcs;
            const rpcUrl = (hasOverride ? rpcs[d.name] : d.defaultRpc) ?? "";
            return (
              <HorizonChainPanel
                key={d.name}
                deployment={d}
                rpcUrl={rpcUrl}
                hasOverride={hasOverride}
                onRpcChange={(url) => setRpc(d.name, url)}
                onResetRpc={() => resetRpc(d.name)}
              />
            );
          })}
        </>
      )}

      <footer className="dim" style={{ fontSize: 11, marginTop: 24 }}>
        # rpc urls, market, and chain selection are stored in <code>localStorage</code> on this
        device only — they never leave the browser.
      </footer>
    </main>
  );
}
