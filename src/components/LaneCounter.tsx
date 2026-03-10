import { SectionLabel } from "./SectionLabel";

export function LaneCounter({
  label,
  value,
  min = 1,
  max = 6,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <SectionLabel>{label}</SectionLabel>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          style={{
            width: 26,
            height: 26,
            borderRadius: 4,
            border: "1px solid #222240",
            background: "#0d0d1a",
            color: "#80c0ff",
            cursor: "pointer",
            fontSize: 18,
            lineHeight: 1,
            fontWeight: 700,
          }}
        >
          −
        </button>
        <span
          style={{
            color: "#80c0ff",
            fontWeight: 700,
            fontSize: 18,
            minWidth: 18,
            textAlign: "center",
          }}
        >
          {value}
        </span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          style={{
            width: 26,
            height: 26,
            borderRadius: 4,
            border: "1px solid #222240",
            background: "#0d0d1a",
            color: "#80c0ff",
            cursor: "pointer",
            fontSize: 18,
            lineHeight: 1,
            fontWeight: 700,
          }}
        >
          +
        </button>
        <div style={{ display: "flex", gap: 3, marginLeft: 4 }}>
          {Array.from({ length: value }, (_, i) => (
            <div
              key={i}
              style={{
                width: 7,
                height: 18,
                borderRadius: 2,
                background: "#2a5a9a",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
