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
    color: tool === id ? "#80c0ff" : "#557",
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
          title="Road (R)"
        >
          ✏ Road
        </button>
        <button
          style={toolBtn("select")}
          onClick={() => {
            setTool("select");
            setBuildFrom(null);
          }}
          title="Select (S)"
        >
          ⬚ Select
        </button>
        <button
          style={toolBtn("delete")}
          onClick={() => {
            setTool("delete");
            setBuildFrom(null);
          }}
          title="Delete (D)"
        >
          ✂ Delete
        </button>
        <button
          style={toolBtn("crossing")}
          onClick={() => {
            setTool("crossing");
            setBuildFrom(null);
          }}
          title="Pedestrian crossing (X)"
        >
          ⇔ Crossing
        </button>
        <button
          style={toolBtn("bus_stop")}
          onClick={() => {
            setTool("bus_stop");
            setBuildFrom(null);
          }}
          title="Bus stop (B)"
        >
          ◼ Bus Stop
        </button>
        <button
          style={toolBtn("parking")}
          onClick={() => {
            setTool("parking");
            setBuildFrom(null);
          }}
          title="Parking (P)"
        >
          ◻ Parking
        </button>
        <button
          style={toolBtn("split")}
          onClick={() => {
            setTool("split");
            setBuildFrom(null);
          }}
          title="Add node to road (A)"
        >
          ⊕ Add node
        </button>
      </div>
      <div style={{ width: 1, height: 24, background: "#1e1e3e" }} />

      <span style={{ color: "#445", fontSize: 11, whiteSpace: "nowrap" }}>
        New road:
      </span>
      <button
        onClick={() => setDefLanesB(defOneWay ? 1 : 0)}
        style={chip(!defOneWay)}
      >
        {defOneWay ? "→ One-way" : "↔ Two-way"}
      </button>
      <span style={{ color: "#334", fontSize: 11 }}>→</span>
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
          <span style={{ color: "#334", fontSize: 11 }}>←</span>
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
      <span style={{ color: "#445", fontSize: 11 }}>Speed:</span>
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
      <span style={{ color: "#445", fontSize: 11 }}>Surface:</span>
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
        <span style={{ color: "#445", fontSize: 11 }}>Road size:</span>
        <input
          type="range"
          min={0.05}
          max={0.5}
          step={0.01}
          value={roadScale}
          onChange={(e) => setRoadScale(parseFloat(e.target.value))}
          style={{ width: 80, accentColor: "#4a80c0" }}
          title={`Display scale: ${roadScale.toFixed(2)}x`}
        />
        <span style={{ color: "#778", fontSize: 11, minWidth: 32 }}>
          {roadScale.toFixed(2)}×
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: "#445", fontSize: 11 }}>New:</span>
        <input
          type="range"
          min={0.05}
          max={2}
          step={0.05}
          value={defDisplayScale}
          onChange={(e) => setDefDisplayScale(parseFloat(e.target.value))}
          style={{ width: 60, accentColor: "#4a80c0" }}
          title={`Default size for new segments: ${defDisplayScale.toFixed(2)}×`}
        />
        <span style={{ color: "#556", fontSize: 10 }}>
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
        Clear
      </button>

      <div
        style={{
          marginLeft: "auto",
          display: "flex",
          gap: 12,
          color: "#334",
          fontSize: 11,
          alignItems: "center",
        }}
      >
        <span>
          {nodeCount} nodes · {segmentCount} roads
        </span>
        {intersectionCount > 0 && (
          <span style={{ color: "#ffa000" }}>
            ✕ {intersectionCount} intersection
            {intersectionCount > 1 ? "s" : ""}
          </span>
        )}
        {buildFrom && (
          <span style={{ color: "#5aafff" }}>
            Building — right-click or Esc to stop
          </span>
        )}
      </div>
    </div>
  );
}
