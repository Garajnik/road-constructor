import { useState } from "react";

export function CollapsibleSection({
  label,
  children,
  defaultExpanded = false,
}: {
  label: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div style={{ marginBottom: 14 }}>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          width: "100%",
          padding: 0,
          marginBottom: expanded ? 6 : 0,
          background: "none",
          border: "none",
          color: "var(--text-faint)",
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span
          style={{
            display: "inline-block",
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.15s ease",
            lineHeight: 1,
          }}
        >
          ▶
        </span>
        {label}
      </button>
      {expanded && children}
    </div>
  );
}
