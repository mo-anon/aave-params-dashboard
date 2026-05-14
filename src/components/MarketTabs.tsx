import aaveTokenRound from "../assets/aave-token-round.svg";
import aaveHorizon from "../assets/aave-horizon.svg";
import aaveV4 from "../assets/aave-v4.svg";

export type Market = "v3" | "horizon" | "v4";

type Props = {
  selected: Market;
  onSelect: (m: Market) => void;
  counts?: Partial<Record<Market, number>>;
};

const TABS: { id: Market; label: string; hint: string; iconSrc: string }[] = [
  {
    id: "v3",
    label: "AaveV3",
    hint: "permissionless Aave V3 instances across 17 chains, all driven by a RiskSteward",
    iconSrc: aaveTokenRound,
  },
  {
    id: "horizon",
    label: "Horizon",
    hint: "permissioned RWA instance on Ethereum (v3.3 fork). No RiskSteward — params change via PoolConfigurator under Aave Labs / Aave DAO roles.",
    iconSrc: aaveHorizon,
  },
  {
    id: "v4",
    label: "AaveV4",
    hint: "modular Hub/Spoke architecture: liquidity hubs (CORE / PLUS / PRIME) feed isolated risk surfaces (spokes). Governed via AccessManager — no RiskSteward.",
    iconSrc: aaveV4,
  },
];

export function MarketTabs({ selected, onSelect, counts }: Props) {
  return (
    <section
      className="panel"
      style={{ padding: 0, marginBottom: 12, overflow: "hidden" }}
    >
      <div
        role="tablist"
        aria-label="market"
        style={{
          display: "flex",
          borderBottom: "1px solid var(--border-strong)",
          background: "var(--bg-alt)",
        }}
      >
        {TABS.map((t) => {
          const on = selected === t.id;
          const count = counts?.[t.id];
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onSelect(t.id)}
              title={t.hint}
              style={{
                background: on ? "var(--bg)" : "transparent",
                border: "none",
                borderRight: "1px solid var(--border)",
                borderBottom: on ? "2px solid var(--accent)" : "2px solid transparent",
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 600,
                color: on ? "var(--fg)" : "var(--muted)",
                cursor: "pointer",
                marginBottom: -1,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <img
                src={t.iconSrc}
                alt=""
                width={18}
                height={18}
                style={{ display: "block" }}
              />
              <span># {t.label}</span>
              {count !== undefined && (
                <span
                  className="dim"
                  style={{ fontSize: 11, marginLeft: 2, fontWeight: 400 }}
                >
                  ({count})
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
