import { useState } from "react";

type Props = {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
};

export function RpcInput({ value, onChange, placeholder }: Props) {
  const [reveal, setReveal] = useState(true);
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flex: 1 }}>
      <input
        style={{ flex: 1, fontFamily: "ui-monospace, monospace" }}
        type={reveal ? "text" : "password"}
        spellCheck={false}
        autoComplete="off"
        value={value}
        placeholder={placeholder ?? "https://…/v2/<API_KEY>"}
        onChange={(e) => onChange(e.target.value)}
      />
      <button type="button" onClick={() => setReveal((r) => !r)} title="toggle visibility">
        {reveal ? "hide" : "show"}
      </button>
    </div>
  );
}
