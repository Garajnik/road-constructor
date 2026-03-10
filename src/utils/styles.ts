import type React from "react";

export function chip(active: boolean): React.CSSProperties {
  return {
    padding: "3px 8px",
    borderRadius: 4,
    border: "1px solid",
    borderColor: active ? "#4a80c0" : "#222240",
    background: active ? "#1a304a" : "#0d0d1a",
    color: active ? "#80c0ff" : "#445",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: active ? 700 : 400,
  };
}
