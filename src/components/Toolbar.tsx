import type { Tool, SurfaceType } from "../types";
import { SURFACE, SURFACE_KEYS } from "../constants";
import { chip } from "../utils/styles";

interface ToolbarProps {
  theme: "dark" | "light";
  setTheme: (t: "dark" | "light") => void;
  tool: Tool;
  setTool: (t: Tool) => void;
  defLanesF: number;
  setDefLanesF: (v: number) => void;
  defLanesB: number;
  setDefLanesB: (v: number) => void;
  defSpeed: number;
  setDefSpeed: (v: number) => void;
  defSurface: SurfaceType;
  setDefSurface: (v: SurfaceType) => void;
  roadScale: number;
  setRoadScale: (v: number) => void;
  defDisplayScale: number;
  setDefDisplayScale: (v: number) => void;
  nodeCount: number;
  segmentCount: number;
  intersectionCount: number;
  buildFrom: boolean;
  onClear: () => void;
  setBuildFrom: (v: null) => void;
}

export function Toolbar({
  theme,
  setTheme,
  tool,
  setTool,
  defLanesF,
  setDefLanesF,
  defLanesB,
  setDefLanesB,
  defSpeed,
  setDefSpeed,
  defSurface,
  setDefSurface,
  roadScale,
  setRoadScale,
  defDisplayScale,
  setDefDisplayScale,
  nodeCount,
  segmentCount,
  intersectionCount,
  buildFrom,
  onClear,
  setBuildFrom,
}: ToolbarProps) {
  const defOneWay = defLanesB === 0;

  const toolBtn = (id: Tool): React.CSSProperties => ({
    padding: "4px 13px",
    borderRadius: 5,
    border: "1px solid",
    borderColor: tool === id ? "var(--accent-muted)" : "var(--border)",
    background: tool === id ? "var(--chip-active-bg)" : "var(--chip-inactive-bg)",
    color: tool === id ? "var(--accent)" : "var(--text-primary)",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: tool === id ? 700 : 400,
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 14px",
        background: "var(--toolbar-bg)",
        borderBottom: "1px solid var(--border)",
        flexShrink: 0,
        flexWrap: "wrap",
      }}
    >
      <button
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        style={{
          padding: "4px 10px",
          borderRadius: 5,
          border: "1px solid var(--border)",
          background: "var(--chip-inactive-bg)",
          color: "var(--text-primary)",
          cursor: "pointer",
          fontSize: 13,
        }}
        title={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
      >
        {theme === "dark" ? "☀" : "☾"}
      </button>
      <div style={{ width: 1, height: 24, background: "var(--border)" }} />
      <div style={{ display: "flex", gap: 4 }}>
        <button
          style={toolBtn("road")}
          onClick={() => {
            setTool("road");
            setBuildFrom(null);
          }}
          title="Дорога (R)"
        >
          ✏ Дорога
        </button>
        <button
          style={toolBtn("select")}
          onClick={() => {
            setTool("select");
            setBuildFrom(null);
          }}
          title="Выбрать (S)"
        >
          ⬚ Выбрать
        </button>
        <button
          style={toolBtn("delete")}
          onClick={() => {
            setTool("delete");
            setBuildFrom(null);
          }}
          title="Удалить (D)"
        >
          ✂ Удалить
        </button>
      </div>
      <div style={{ width: 1, height: 24, background: "var(--border)" }} />

      <span style={{ color: "var(--text-primary)", fontSize: 11, whiteSpace: "nowrap" }}>
        Новая дорога:
      </span>
      <button
        onClick={() => setDefLanesB(defOneWay ? 1 : 0)}
        style={chip(!defOneWay)}
      >
        {defOneWay ? "→ Односторонняя" : "↔ Двусторонняя"}
      </button>
      <span style={{ color: "var(--text-primary)", fontSize: 11 }}>→</span>
      {[1, 2, 3, 4].map((n) => (
        <button
          key={n}
          onClick={() => setDefLanesF(n)}
          style={{
            ...chip(defLanesF === n),
            minWidth: 24,
            padding: "3px 6px",
          }}
        >
          {n}
        </button>
      ))}
      {!defOneWay && (
        <>
          <span style={{ color: "var(--text-primary)", fontSize: 11 }}>←</span>
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              onClick={() => setDefLanesB(n)}
              style={{
                ...chip(defLanesB === n),
                minWidth: 24,
                padding: "3px 6px",
              }}
            >
              {n}
            </button>
          ))}
        </>
      )}

      <div style={{ width: 1, height: 24, background: "var(--border)" }} />
      <span style={{ color: "var(--text-primary)", fontSize: 11 }}>Скорость:</span>
      {[30, 50, 70, 90, 110].map((s) => (
        <button
          key={s}
          onClick={() => setDefSpeed(s)}
          style={{ ...chip(defSpeed === s), padding: "3px 6px" }}
        >
          {s}
        </button>
      ))}

      <div style={{ width: 1, height: 24, background: "var(--border)" }} />
      <span style={{ color: "var(--text-primary)", fontSize: 11 }}>Покрытие:</span>
      {SURFACE_KEYS.map((k) => (
        <button
          key={k}
          onClick={() => setDefSurface(k)}
          style={{ ...chip(defSurface === k), padding: "3px 7px" }}
        >
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: 2,
              background: SURFACE[k].dot,
              marginRight: 4,
              verticalAlign: "middle",
            }}
          />
          {SURFACE[k].label}
        </button>
      ))}

      <div style={{ width: 1, height: 24, background: "var(--border)" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "var(--text-primary)", fontSize: 11 }}>Размер дорог:</span>
        <input
          type="range"
          min={0.05}
          max={0.5}
          step={0.01}
          value={roadScale}
          onChange={(e) => setRoadScale(parseFloat(e.target.value))}
          style={{ width: 80, accentColor: "var(--accent-muted)" }}
          title={`Масштаб отображения: ${roadScale.toFixed(2)}x`}
        />
        <span style={{ color: "var(--text-primary)", fontSize: 11, minWidth: 32 }}>
          {roadScale.toFixed(2)}×
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: "var(--text-primary)", fontSize: 11 }}>Новая:</span>
        <input
          type="range"
          min={0.05}
          max={2}
          step={0.05}
          value={defDisplayScale}
          onChange={(e) => setDefDisplayScale(parseFloat(e.target.value))}
          style={{ width: 60, accentColor: "var(--accent-muted)" }}
          title={`Размер для новых участков: ${defDisplayScale.toFixed(2)}×`}
        />
        <span style={{ color: "var(--text-primary)", fontSize: 10 }}>
          {defDisplayScale.toFixed(2)}×
        </span>
      </div>

      <div style={{ width: 1, height: 24, background: "var(--border)" }} />
      <button
        onClick={onClear}
        style={{
          padding: "4px 12px",
          borderRadius: 5,
          border: "1px solid var(--clear-btn-border)",
          background: "var(--clear-btn-bg)",
          color: "var(--clear-btn-color)",
          cursor: "pointer",
          fontSize: 13,
        }}
      >
        Очистить
      </button>

      <div
        style={{
          marginLeft: "auto",
          display: "flex",
          gap: 12,
          color: "var(--text-primary)",
          fontSize: 11,
          alignItems: "center",
        }}
      >
        <span>
          {nodeCount} узлов · {segmentCount} дорог
        </span>
        {intersectionCount > 0 && (
          <span style={{ color: "#ffa000" }}>
            ✕ {intersectionCount}{" "}
            {intersectionCount === 1
              ? "пересечение"
              : intersectionCount < 5
                ? "пересечения"
                : "пересечений"}
          </span>
        )}
        {buildFrom && (
          <span style={{ color: "#5aafff" }}>
            Построение — ПКМ или Esc для отмены
          </span>
        )}
      </div>
    </div>
  );
}
