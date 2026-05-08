import { useEffect, useState } from "react";

const STORAGE_KEY = "aave-params-dashboard:info-open";

export function InfoBox() {
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
        <strong style={{ fontSize: 13 }}># about — how steward updates, bounds & cooldowns work</strong>
      </header>
      {open && (
        <div style={{ padding: "12px 14px", fontSize: 13, lineHeight: 1.55 }}>
          <p style={{ margin: "0 0 10px" }}>
            The Aave V3 <strong>RiskSteward</strong> is a permissioned contract that lets a Risk
            Council Safe move reserve risk parameters within pre-defined bounds — no governance vote
            needed. This dashboard shows current values, the steward's bounds, and per-asset
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
      )}
    </section>
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
