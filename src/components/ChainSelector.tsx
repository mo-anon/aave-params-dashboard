import type { Deployment } from "../chains";
import { chainLogoUrl } from "../lib/logos";
import { Logo } from "./Logo";
import type { DisplayFlags } from "./AssetTable";

type Props = {
  deployments: Deployment[];
  selected: string | null;
  onSelect: (name: string | null) => void;
  flags: DisplayFlags;
  onFlagsChange: (next: DisplayFlags) => void;
};

export function ChainSelector({
  deployments,
  selected,
  onSelect,
  flags,
  onFlagsChange,
}: Props) {
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
        <strong style={{ fontSize: 13 }}># chain</strong>
        <span className="dim" style={{ fontSize: 12 }}>
          {selected ? prettyName(selected) : "(none)"}
        </span>
        <span className="dim" style={{ fontSize: 12 }}>|</span>
        <strong style={{ fontSize: 13 }}># show</strong>
        <FlagToggle
          label="bounds"
          on={flags.showBounds}
          onClick={() => onFlagsChange({ ...flags, showBounds: !flags.showBounds })}
          title="±max change in one call (relative or absolute)"
        />
        <FlagToggle
          label="cooldowns"
          on={flags.showCooldowns}
          onClick={() => onFlagsChange({ ...flags, showCooldowns: !flags.showCooldowns })}
          title="per-asset cooldown badge (ready / remaining)"
        />
        <span className="dim" style={{ fontSize: 11, marginLeft: 4 }}>
          legend: <span className="badge ok">ready</span>{" "}
          <span className="badge warn">cooldown remaining</span>{" "}
          <span className="badge muted">locked</span>{" "}
          <span className="badge err">restricted</span>
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button type="button" onClick={() => onSelect(null)} disabled={selected === null}>
            clear
          </button>
        </div>
      </div>
      <div role="radiogroup" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {deployments.map((d) => {
          const isOn = selected === d.name;
          return (
            <button
              key={d.name}
              type="button"
              role="radio"
              aria-checked={isOn}
              onClick={() => onSelect(isOn ? null : d.name)}
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
              title={`chainId ${d.chainId}`}
            >
              <span aria-hidden>{isOn ? "(o)" : "( )"}</span>
              <Logo src={chainLogoUrl(d.chainId)} alt={d.name} size={14} rounded />
              {prettyName(d.name)}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function FlagToggle({
  label,
  on,
  onClick,
  title,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        fontSize: 12,
        padding: "2px 10px",
        borderRadius: 2,
        background: on ? "var(--accent)" : "var(--bg-alt)",
        color: on ? "var(--accent-fg)" : "var(--fg)",
        borderColor: on ? "var(--accent)" : "var(--border)",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <span aria-hidden>{on ? "[x]" : "[ ]"}</span>
      {label}
    </button>
  );
}

function prettyName(name: string): string {
  return name.replace(/^AaveV3/, "");
}
