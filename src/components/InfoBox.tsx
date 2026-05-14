import { useEffect, useState } from "react";
import type { Market } from "./MarketTabs";

const STORAGE_KEY = "aave-params-dashboard:info-open";

export function InfoBox({ market }: { market: Market }) {
  const [open, setOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, open ? "1" : "0");
  }, [open]);

  return (
    <section className="panel" style={{ marginBottom: 12 }}>
      <header
        className="panel-header"
        style={{ cursor: "pointer", userSelect: "none" }}
        onClick={() => setOpen((o) => !o)}
        title={open ? "collapse" : "expand"}
      >
        <span style={{ fontFamily: "inherit", fontSize: 12, marginRight: 4 }}>
          {open ? "[-]" : "[+]"}
        </span>
        <strong style={{ fontSize: 13 }}>
          # about — {market === "v3" ? "steward updates, bounds & cooldowns" : "Horizon RWA instance"}
        </strong>
      </header>
      {open && (market === "v3" ? <V3About /> : <HorizonAbout />)}
    </section>
  );
}

function V3About() {
  return (
    <div style={{ padding: "12px 14px", fontSize: 13, lineHeight: 1.55 }}>
      <p style={{ margin: "0 0 10px" }}>
        The Aave V3 <strong>RiskSteward</strong> is a permissioned contract that lets a Risk
        Council Safe move reserve risk parameters within pre-defined bounds — no governance vote
        needed. This tab shows current values, the steward's bounds, and per-asset
        cooldowns, all read live via Multicall3.
      </p>

      <h4 style={hStyle}>parameter families</h4>
      <ul style={ulStyle}>
        <li>
          <code>updateCaps</code> → <code>supplyCap</code>, <code>borrowCap</code> (whole
          tokens)
        </li>
        <li>
          <code>updateCollateralSide</code> → <code>ltv</code>, <code>liqThreshold</code>,{" "}
          <code>liqBonus</code>, <code>debtCeiling</code>
        </li>
        <li>
          <code>updateRates</code> → <code>optimalUsageRatio</code>,{" "}
          <code>baseVariableBorrowRate</code>, <code>variableRateSlope1</code>,{" "}
          <code>variableRateSlope2</code>
        </li>
        <li className="dim">
          eMode + LST/stable/pendle price caps exist on the steward but aren't asset-indexed —
          not shown here.
        </li>
      </ul>

      <h4 style={hStyle}>bounds — "max change in one call"</h4>
      <p style={{ margin: "0 0 6px" }}>
        Each param has a <code>maxPercentChange</code> (basis points, 10000 = 100%) in the
        steward's <code>RiskConfig</code>. Two regimes:
      </p>
      <ul style={ulStyle}>
        <li>
          <strong>relative</strong> (caps, debtCeiling): max delta ={" "}
          <code>current × maxPercentChange / 10_000</code>. Rendered <code>±X%</code>.
        </li>
        <li>
          <strong>absolute</strong> (rates, ltv, liqThreshold, liqBonus): max delta ={" "}
          <code>maxPercentChange</code> directly. Rendered <code>±Y bps</code>.
        </li>
        <li>
          <span className="badge muted">locked</span> ≡ <code>maxPercentChange == 0</code> — the
          steward refuses to move that param at all.
        </li>
      </ul>

      <h4 style={hStyle}>cooldowns — "min delay between two steward updates"</h4>
      <p style={{ margin: "0 0 6px" }}>
        Each <code>(asset, param)</code> tracks the last block timestamp when the steward
        changed it. The contract reverts if <code>now − lastUpdated &lt; minDelay</code>.
      </p>
      <ul style={ulStyle}>
        <li>
          <span className="badge ok">ready</span> — no cooldown blocks you. Either the delay
          elapsed, or the steward has <em>never</em> moved this param (
          <code>lastUpdated == 0</code>). Both render green; the latter case carries a tooltip.
        </li>
        <li>
          <span className="badge warn">Xd Yh</span> — still ticking; wait that long before
          submitting another steward call for this param.
        </li>
      </ul>
      <p style={{ margin: "6px 0 0" }} className="dim">
        Cooldowns only track <em>steward</em> updates. If governance changes a param via a
        direct Pool admin call, the steward's <code>lastUpdated</code> stays at zero and the
        change is invisible to the cooldown logic.
      </p>

      <h4 style={hStyle}>restricted assets</h4>
      <p style={{ margin: "0" }}>
        The steward maintains a per-asset restriction list — when{" "}
        <code>isAddressRestricted(asset)</code> is <code>true</code>, every update touching
        that asset reverts with <code>AssetIsRestricted</code> regardless of bounds or
        cooldowns. Restricted rows are tinted red and tagged{" "}
        <span className="badge err">restricted</span> in the asset cell. Treat any bounds or
        cooldowns shown on those rows as moot — the call won't go through. (eMode-category
        restrictions exist too via <code>isEModeCategoryRestricted</code>, but eMode params
        aren't asset-indexed and aren't shown here.)
      </p>

      <h4 style={hStyle}>legacy steward</h4>
      <p style={{ margin: "0" }}>
        Older deployments (currently <code>AaveV3EthereumEtherFi</code>) ship a smaller{" "}
        <code>getRiskConfig</code> (12 <code>RiskParamConfig</code>s — no eMode, no pendle). The
        dashboard probes both ABIs and renders identical bounds/cooldowns either way; the meta
        line tags it <em>legacy steward</em>.
      </p>

      <h4 style={hStyle}>data freshness</h4>
      <p style={{ margin: "0" }}>
        Every value is live from your RPC — no caching, no backend. Each chain ships with a
        CORS-friendly public default (mostly <code>*.drpc.org</code>); paste your own URL into
        a chain's input to override. Each fetch issues exactly{" "}
        <strong>3 Multicall3 round-trips per chain</strong> regardless of asset count. The{" "}
        <code>block #N</code> in the meta line is the chain head at Stage A; cooldown remaining
        is computed against that block's timestamp, not your browser clock.
      </p>
    </div>
  );
}

function HorizonAbout() {
  return (
    <div style={{ padding: "12px 14px", fontSize: 13, lineHeight: 1.55 }}>
      <p style={{ margin: "0 0 10px" }}>
        <strong>Aave Horizon</strong> is a separate, licensed Aave instance — a fork of Aave v3.3 —
        built to onboard <em>permissioned real-world assets (RWAs)</em> as collateral against
        permissionless stablecoin borrowing. It runs only on Ethereum mainnet today, at pool{" "}
        <code>0xAe05Cd22…fb516bFe332C8</code>.
      </p>

      <h4 style={hStyle}>no RiskSteward — different governance model</h4>
      <p style={{ margin: "0 0 6px" }}>
        Unlike standard V3 instances, Horizon deliberately ships <strong>without</strong> a
        RiskSteward. Parameter changes happen via the normal{" "}
        <code>PoolConfigurator</code> path, controlled by a dual-role setup:
      </p>
      <ul style={ulStyle}>
        <li>
          <strong>Aave Labs</strong> holds the executive role (asset listings, RWA-specific
          configuration).
        </li>
        <li>
          <strong>Aave DAO</strong> holds the operational role (ongoing parameter steering).
        </li>
      </ul>
      <p style={{ margin: "6px 0 0" }} className="dim">
        Because there's no steward, there are no automated bounds (<code>maxPercentChange</code>)
        and no per-param cooldowns to display. The table just shows the current pool state.
      </p>

      <h4 style={hStyle}>two asset kinds</h4>
      <ul style={ulStyle}>
        <li>
          <strong>rwa</strong> — permissioned collateral tokens (e.g. jTRSY, USTB, USCC, USYC,
          VBILL, ACRED). LTV/LT &gt; 0, borrowing disabled at config level, and the corresponding{" "}
          <code>RwaAToken</code> is non-transferable by holders. Each RWA token enforces
          allowlisting at the ERC-20 layer.
        </li>
        <li>
          <strong>borrowable</strong> — permissionless stablecoins (e.g. USDC, GHO, RLUSD).
          LTV/LT = 0 so they can't be used as collateral; they sit in the pool to earn yield
          and be borrowed against RWA collateral.
        </li>
      </ul>

      <h4 style={hStyle}>RwaAToken transfer admin</h4>
      <p style={{ margin: "0" }}>
        RWA aTokens cannot be transferred by users themselves. The{" "}
        <code>ATOKEN_ADMIN</code> role (granted to a <code>RwaATokenManager</code> contract)
        can <em>forcibly</em> move them via <code>authorizedTransfer</code> — used to migrate
        positions when an Issuer needs to handle lost keys, sanctions enforcement, or other
        compliance events. Transfers still go through Aave's health-factor check.
      </p>

      <h4 style={hStyle}>v3.3 features visible here</h4>
      <ul style={ulStyle}>
        <li>
          <code>deficit</code> column — bad-debt deficit per reserve (replaces the deprecated
          stable borrow rate slot). Nonzero means a liquidation left the pool with unbacked
          debt and the deficit must be cleaned up via{" "}
          <code>eliminateReserveDeficit</code> by the registered Umbrella.
        </li>
        <li>
          New per-reserve close-factor / leftover thresholds also live in v3.3 but apply
          globally rather than per-reserve, so they aren't shown in this asset table.
        </li>
      </ul>

      <h4 style={hStyle}>data freshness</h4>
      <p style={{ margin: "0" }}>
        Live from your RPC — no caching, no backend. Three Multicall3 round-trips per fetch:
        (1) reserves list + chain meta, (2) per-asset config + reserveData + symbol/decimals +
        deficit, (3) per-asset rate data from each reserve's interest rate strategy.
      </p>
    </div>
  );
}

const hStyle: React.CSSProperties = {
  margin: "12px 0 6px",
  fontSize: 12,
  textTransform: "lowercase",
  letterSpacing: "0.4px",
  color: "var(--muted)",
  fontWeight: 600,
};

const ulStyle: React.CSSProperties = {
  margin: "0 0 0 0",
  paddingLeft: 18,
};
