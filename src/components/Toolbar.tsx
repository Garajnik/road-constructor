import type { Tool, SurfaceType } from "../types";
import { SURFACE, SURFACE_KEYS } from "../constants";
import { chip } from "../utils/styles";

interface ToolbarProps {
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
    borderColor: tool === id ? "#4a80c0" : "#1e1e3e",
    background: tool === id ? "#1a304a" : "#1a1a2e",
    color: tool === id ? "#80c0ff" : "#fff",
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
        background: "#12122a",
        borderBottom: "1px solid #1e1e3e",
        flexShrink: 0,
        flexWrap: "wrap",
      }}
    >
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
      <div style={{ width: 1, height: 24, background: "#1e1e3e" }} />

      <span style={{ color: "#fff", fontSize: 11, whiteSpace: "nowrap" }}>
        Новая дорога:
      </span>
      <button
        onClick={() => setDefLanesB(defOneWay ? 1 : 0)}
        style={chip(!defOneWay)}
      >
        {defOneWay ? "→ Односторонняя" : "↔ Двусторонняя"}
      </button>
      <span style={{ color: "#fff", fontSize: 11 }}>→</span>
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
          <span style={{ color: "#fff", fontSize: 11 }}>←</span>
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

      <div style={{ width: 1, height: 24, background: "#1e1e3e" }} />
      <span style={{ color: "#fff", fontSize: 11 }}>Скорость:</span>
      {[30, 50, 70, 90, 110].map((s) => (
        <button
          key={s}
          onClick={() => setDefSpeed(s)}
          style={{ ...chip(defSpeed === s), padding: "3px 6px" }}
        >
          {s}
        </button>
      ))}

      <div style={{ width: 1, height: 24, background: "#1e1e3e" }} />
      <span style={{ color: "#fff", fontSize: 11 }}>Покрытие:</span>
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

      <div style={{ width: 1, height: 24, background: "#1e1e3e" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "#fff", fontSize: 11 }}>Размер дорог:</span>
        <input
          type="range"
          min={0.05}
          max={0.5}
          step={0.01}
          value={roadScale}
          onChange={(e) => setRoadScale(parseFloat(e.target.value))}
          style={{ width: 80, accentColor: "#4a80c0" }}
          title={`Масштаб отображения: ${roadScale.toFixed(2)}x`}
        />
        <span style={{ color: "#fff", fontSize: 11, minWidth: 32 }}>
          {roadScale.toFixed(2)}×
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: "#fff", fontSize: 11 }}>Новая:</span>
        <input
          type="range"
          min={0.05}
          max={2}
          step={0.05}
          value={defDisplayScale}
          onChange={(e) => setDefDisplayScale(parseFloat(e.target.value))}
          style={{ width: 60, accentColor: "#4a80c0" }}
          title={`Размер для новых участков: ${defDisplayScale.toFixed(2)}×`}
        />
        <span style={{ color: "#fff", fontSize: 10 }}>
          {defDisplayScale.toFixed(2)}×
        </span>
      </div>

      <div style={{ width: 1, height: 24, background: "#1e1e3e" }} />
      <button
        onClick={onClear}
        style={{
          padding: "4px 12px",
          borderRadius: 5,
          border: "1px solid #3a1a1a",
          background: "#1a0d0d",
          color: "#a05050",
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
          color: "#fff",
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
