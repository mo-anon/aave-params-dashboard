import { useEffect, useState } from "react";
import { DEPLOYMENTS, HORIZON_DEPLOYMENTS, V4_DEPLOYMENTS } from "./chains";
import { ChainPanel } from "./components/ChainPanel";
import { ChainSelector } from "./components/ChainSelector";
import { HorizonChainPanel } from "./components/HorizonChainPanel";
import { V4SpokePanel } from "./components/V4SpokePanel";
import { V4SpokeSelector } from "./components/V4SpokeSelector";
import { InfoBox } from "./components/InfoBox";
import { MarketTabs, type Market } from "./components/MarketTabs";
import type { DisplayFlags } from "./components/AssetTable";

const RPC_KEY = "aave-params-dashboard:rpcs";
const SEL_KEY = "aave-params-dashboard:chain";
const FLAGS_KEY = "aave-params-dashboard:flags";
const MARKET_KEY = "aave-params-dashboard:market";
const V4_SPOKE_KEY = "aave-params-dashboard:v4-spoke";

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
  const [selectedV4Spoke, setSelectedV4Spoke] = useState<string | null>(() =>
    loadJSON<string | null>(V4_SPOKE_KEY, null),
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
  useEffect(() => {
    localStorage.setItem(MARKET_KEY, JSON.stringify(market));
  }, [market]);
  useEffect(() => {
    localStorage.setItem(V4_SPOKE_KEY, JSON.stringify(selectedV4Spoke));
  }, [selectedV4Spoke]);

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

  // V4 today is a single deployment (Ethereum). When more chains list V4 we can
  // promote this into a chain-level selector too.
  const v4Deployment = V4_DEPLOYMENTS[0] ?? null;
  const visibleV4Spoke =
    market === "v4" && v4Deployment && selectedV4Spoke
      ? v4Deployment.spokes.find((s) => s.name === selectedV4Spoke) ?? null
      : null;

  return (
    <main style={{ maxWidth: 1400, margin: "0 auto", padding: 20 }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>$ aave-params --watch</h1>
        <p className="dim" style={{ margin: "6px 0 0", fontSize: 13 }}>
          # per-asset reserve parameters across Aave deployments. AaveV3 tab shows the
          steward-driven instances (with bound + cooldown badges per param); Horizon tab
          shows the permissioned RWA instance (v3.3 fork, no steward); AaveV4 tab shows
          the hub/spoke deployment on Ethereum. All reads are batched via Multicall3 with
          sensible public RPC defaults — paste your own URL per chain to override.
        </p>
      </header>

      <MarketTabs
        selected={market}
        onSelect={setMarket}
        counts={{
          v3: DEPLOYMENTS.length,
          horizon: HORIZON_DEPLOYMENTS.length,
          v4: V4_DEPLOYMENTS.reduce((acc, d) => acc + d.spokes.length, 0),
        }}
      />

      <InfoBox market={market} />

      {market === "v3" && (
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
      )}

      {market === "horizon" && (
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

      {market === "v4" && v4Deployment && (
        <>
          <V4SpokeSelector
            deployment={v4Deployment}
            selectedSpokeName={selectedV4Spoke}
            onSelect={setSelectedV4Spoke}
          />

          {!visibleV4Spoke && (
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
              # pick a spoke above to start.
            </div>
          )}

          {visibleV4Spoke && (
            (() => {
              const rpcKey = `${v4Deployment.name}:${visibleV4Spoke.name}`;
              const hasOverride = rpcKey in rpcs;
              const rpcUrl = (hasOverride ? rpcs[rpcKey] : v4Deployment.defaultRpc) ?? "";
              return (
                <V4SpokePanel
                  deployment={v4Deployment}
                  spoke={visibleV4Spoke}
                  rpcUrl={rpcUrl}
                  hasOverride={hasOverride}
                  onRpcChange={(url) => setRpc(rpcKey, url)}
                  onResetRpc={() => resetRpc(rpcKey)}
                />
              );
            })()
          )}
        </>
      )}

      <footer className="dim" style={{ fontSize: 11, marginTop: 24 }}>
        # rpc urls, market, and selection are stored in <code>localStorage</code> on this
        device only — they never leave the browser.
      </footer>
    </main>
  );
}
