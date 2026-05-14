import type { V4Deployment, V4Spoke, V4HubName } from "../chains";

type Props = {
  deployment: V4Deployment;
  selectedSpokeName: string | null;
  onSelect: (name: string | null) => void;
};

// Group spokes by their primary hub for a clearer overview. The on-chain `hub`
// field on each reserve is the ground truth for which hub supplies that reserve —
// shown in the table — but the spoke groups are still useful navigation.
function groupByHub(spokes: V4Spoke[]): Record<V4HubName, V4Spoke[]> {
  return spokes.reduce(
    (acc, s) => {
      acc[s.primaryHub].push(s);
      return acc;
    },
    { CORE: [], PLUS: [], PRIME: [] } as Record<V4HubName, V4Spoke[]>,
  );
}

const HUB_HINT: Record<V4HubName, string> = {
  CORE: "Core liquidity hub — broadly accessible reserves",
  PLUS: "Plus hub — risk-isolated higher-yield strategies (e.g. Ethena)",
  PRIME: "Prime hub — bluechip-only conservative listings",
};

export function V4SpokeSelector({ deployment, selectedSpokeName, onSelect }: Props) {
  const groups = groupByHub(deployment.spokes);

  return (
    <section className="panel" style={{ padding: 12, marginBottom: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          marginBottom: 10,
          flexWrap: "wrap",
        }}
      >
        <strong style={{ fontSize: 13 }}># spoke</strong>
        <span className="dim" style={{ fontSize: 12 }}>
          {selectedSpokeName
            ? deployment.spokes.find((s) => s.name === selectedSpokeName)?.label ??
              selectedSpokeName
            : "(none)"}
        </span>
        <span className="dim" style={{ fontSize: 11, marginLeft: 4 }}>
          spokes are isolated risk surfaces; reserves inside a spoke may route through
          different hubs (CORE / PLUS / PRIME)
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={() => onSelect(null)}
            disabled={selectedSpokeName === null}
          >
            clear
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {(["CORE", "PLUS", "PRIME"] as V4HubName[]).map((hub) => {
          const list = groups[hub];
          if (list.length === 0) return null;
          return (
            <div key={hub} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <span
                className="badge muted"
                title={HUB_HINT[hub]}
                style={{ minWidth: 52, textAlign: "center", padding: "2px 6px" }}
              >
                {hub}
              </span>
              <div role="radiogroup" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {list.map((s) => {
                  const isOn = selectedSpokeName === s.name;
                  return (
                    <button
                      key={s.name}
                      type="button"
                      role="radio"
                      aria-checked={isOn}
                      onClick={() => onSelect(isOn ? null : s.name)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 12,
                        padding: "2px 10px",
                        borderRadius: 2,
                        background: isOn ? "var(--accent)" : "var(--bg-alt)",
                        color: isOn ? "var(--accent-fg)" : "var(--fg)",
                        borderColor: isOn ? "var(--accent)" : "var(--border)",
                      }}
                      title={s.address}
                    >
                      <span aria-hidden>{isOn ? "(o)" : "( )"}</span>
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
