import type React from "react";

export function chip(active: boolean): React.CSSProperties {
  return {
    padding: "3px 8px",
    borderRadius: 4,
    border: "1px solid",
    borderColor: active ? "var(--accent-muted)" : "var(--border)",
    background: active ? "var(--chip-active-bg)" : "var(--chip-inactive-bg)",
    color: active ? "var(--accent)" : "var(--text-primary)",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: active ? 700 : 400,
  };
}
