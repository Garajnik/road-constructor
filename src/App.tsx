import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
} from "react";
import L from "leaflet";

// ── Constants ──────────────────────────────────────────────────────────────────
const LANE_WIDTH = 22;
const MIN_SEGMENT_LENGTH = 20;
const HANDLE_OFFSET = 13;
const HANDLE_RADIUS = 9;
const SNAP_EXTRA = 4;
const MAP_CENTER: [number, number] = [56.0153, 92.8932];
const MAP_ZOOM = 13;

/** Combined scale from zoom and user slider. Roads scale with map zoom, × userScale. */
function getScale(zoom: number, userScale: number): number {
  return Math.pow(2, (zoom - MAP_ZOOM) / 2) * userScale;
}

// ── Types ──────────────────────────────────────────────────────────────────────
type Tool = "road" | "select" | "delete" | "crossing";
type SurfaceType = "asphalt" | "concrete" | "gravel" | "dirt";

type CoefficientType =
  | "speed_limit"
  | "road_condition"
  | "road_slope"
  | "turning_radius"
  | "pedestrian_crossing"
  | "parking"
  | "bus_stop"
  | "maneuver"
  | "lane_width";

interface RoadCoefficient {
  id: string;
  type: CoefficientType;
  value: number;
}

const COEFF_TYPES: CoefficientType[] = [
  "speed_limit",
  "road_condition",
  "road_slope",
  "turning_radius",
  "pedestrian_crossing",
  "parking",
  "bus_stop",
  "maneuver",
  "lane_width",
];

const COEFF: Record<
  CoefficientType,
  {
    label: string;
    symbol: string;
    color: string;
    unit: string;
    min: number;
    max: number;
    step: number;
    default: number;
  }
> = {
  speed_limit: {
    label: "Speed Limit",
    symbol: "S",
    color: "#e05050",
    unit: "km/h",
    min: 5,
    max: 200,
    step: 5,
    default: 60,
  },
  road_condition: {
    label: "Road Condition",
    symbol: "C",
    color: "#e09030",
    unit: "%",
    min: 0,
    max: 100,
    step: 5,
    default: 80,
  },
  road_slope: {
    label: "Road Slope",
    symbol: "/",
    color: "#8a6a40",
    unit: "°",
    min: -15,
    max: 15,
    step: 0.5,
    default: 0,
  },
  turning_radius: {
    label: "Turning Radius",
    symbol: "R",
    color: "#5080c0",
    unit: "m",
    min: 5,
    max: 500,
    step: 5,
    default: 50,
  },
  pedestrian_crossing: {
    label: "Ped. Crossing",
    symbol: "X",
    color: "#e0c030",
    unit: "",
    min: 0,
    max: 1,
    step: 1,
    default: 1,
  },
  parking: {
    label: "Parking",
    symbol: "P",
    color: "#40a0c0",
    unit: "spots",
    min: 0,
    max: 100,
    step: 1,
    default: 10,
  },
  bus_stop: {
    label: "Bus Stop",
    symbol: "B",
    color: "#40a060",
    unit: "",
    min: 0,
    max: 1,
    step: 1,
    default: 1,
  },
  maneuver: {
    label: "Maneuver",
    symbol: "M",
    color: "#9060c0",
    unit: "",
    min: 0,
    max: 1,
    step: 0.1,
    default: 0.5,
  },
  lane_width: {
    label: "Lane Width",
    symbol: "W",
    color: "#40a0a0",
    unit: "m",
    min: 2,
    max: 5,
    step: 0.1,
    default: 3.5,
  },
};

interface Vec2 {
  x: number;
  y: number;
}
interface RoadNode {
  id: string;
  lat: number;
  lng: number;
}
interface ScreenNode {
  id: string;
  x: number;
  y: number;
}
interface PedestrianCrossing {
  id: string;
  t: number; // 0..1 position along segment from fromId to toId
}

interface RoadSegment {
  id: string;
  fromId: string;
  toId: string;
  lanesForward: number;
  lanesBackward: number;
  speedLimit: number;
  surface: SurfaceType;
  /** Per-segment display scale (0.05–2). Default 1. */
  displayScale?: number;
  /** Obstacles/coefficients affecting vehicle behavior on this segment. */
  coefficients?: RoadCoefficient[];
  /** Pedestrian crossings at positions along this segment. */
  pedestrianCrossings?: PedestrianCrossing[];
}
interface HoveredHandle {
  nodeId: string;
  idx: number;
}
interface EditPanelState {
  segId: string;
  x: number;
  y: number;
}

// ── ID generator ───────────────────────────────────────────────────────────────
let _id = 0;
const uid = () => `n${++_id}`;

// ── Coordinate conversion ──────────────────────────────────────────────────────
function toScreen(map: L.Map, node: RoadNode): ScreenNode {
  const pt = map.latLngToContainerPoint([node.lat, node.lng]);
  return { id: node.id, x: pt.x, y: pt.y };
}

function toGeo(map: L.Map, pos: Vec2): { lat: number; lng: number } {
  const ll = map.containerPointToLatLng(L.point(pos.x, pos.y));
  return { lat: ll.lat, lng: ll.lng };
}

// ── Geometry helpers ───────────────────────────────────────────────────────────
function totalLanes(seg: RoadSegment) {
  return seg.lanesForward + seg.lanesBackward;
}
function roadWidth(seg: RoadSegment, scale: number) {
  const segScale = seg.displayScale ?? 1;
  return totalLanes(seg) * LANE_WIDTH * scale * segScale;
}
function dist(a: Vec2, b: Vec2) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return dist(p, a);
  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2),
  );
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy });
}

/** Project point onto segment, return t in [0,1] and distance. */
function projectToSegment(
  p: Vec2,
  a: Vec2,
  b: Vec2,
): { t: number; dist: number } {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return { t: 0, dist: dist(p, a) };
  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2),
  );
  const proj = { x: a.x + t * dx, y: a.y + t * dy };
  return { t, dist: dist(p, proj) };
}

function nodeSegments(segs: RoadSegment[], nodeId: string) {
  return segs.filter((s) => s.fromId === nodeId || s.toId === nodeId);
}

function alreadyConnected(segs: RoadSegment[], a: string, b: string) {
  return segs.some(
    (s) => (s.fromId === a && s.toId === b) || (s.fromId === b && s.toId === a),
  );
}

function nodeHalfSize(
  nodeId: string,
  segs: RoadSegment[],
  scale: number,
): number {
  const conn = nodeSegments(segs, nodeId);
  if (conn.length === 0) return LANE_WIDTH * scale;
  return Math.max(...conn.map((s) => roadWidth(s, scale))) / 2 + 4 * scale;
}

function handlePos(node: Vec2, hs: number, idx: number, scale: number): Vec2 {
  const d = hs + HANDLE_OFFSET * scale;
  if (idx === 0) return { x: node.x, y: node.y - d };
  if (idx === 1) return { x: node.x + d, y: node.y };
  if (idx === 2) return { x: node.x, y: node.y + d };
  return { x: node.x - d, y: node.y };
}

function nearestNodeSq(
  nodes: ScreenNode[],
  segs: RoadSegment[],
  p: Vec2,
  scale: number,
  exclude?: string,
): ScreenNode | null {
  let best: ScreenNode | null = null,
    bestD = Infinity;
  for (const n of nodes) {
    if (n.id === exclude) continue;
    const hs = nodeHalfSize(n.id, segs, scale);
    const snap = hs + SNAP_EXTRA * scale;
    const d = dist(n, p);
    if (d < snap && d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}

function nearestSegment(
  nodeMap: Map<string, ScreenNode>,
  segs: RoadSegment[],
  p: Vec2,
  fallback: number,
  scale: number,
): RoadSegment | null {
  let best: RoadSegment | null = null,
    bestD = Infinity;
  for (const s of segs) {
    const a = nodeMap.get(s.fromId),
      b = nodeMap.get(s.toId);
    if (!a || !b) continue;
    const d = distToSegment(p, a, b);
    if (d < Math.max(roadWidth(s, scale) / 2, fallback * scale) && d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

/** Find if click is on a pedestrian crossing (for delete). */
function nearestCrossing(
  nodeMap: Map<string, ScreenNode>,
  segs: RoadSegment[],
  p: Vec2,
  scale: number,
): { seg: RoadSegment; crossing: PedestrianCrossing } | null {
  let best: { seg: RoadSegment; crossing: PedestrianCrossing } | null = null;
  let bestD = Infinity;
  for (const s of segs) {
    const crossings = s.pedestrianCrossings;
    if (!crossings?.length) continue;
    const a = nodeMap.get(s.fromId),
      b = nodeMap.get(s.toId);
    if (!a || !b) continue;
    const rw = roadWidth(s, scale);
    const hitRadius = rw * 0.7;

    for (const cross of crossings) {
      const cx = a.x + cross.t * (b.x - a.x);
      const cy = a.y + cross.t * (b.y - a.y);
      const d = dist(p, { x: cx, y: cy });
      if (d < hitRadius && d < bestD) {
        bestD = d;
        best = { seg: s, crossing: cross };
      }
    }
  }
  return best;
}

/** Find nearest segment and return projection parameter t (0..1). */
function nearestSegmentWithT(
  nodeMap: Map<string, ScreenNode>,
  segs: RoadSegment[],
  p: Vec2,
  fallback: number,
  scale: number,
): { seg: RoadSegment; t: number } | null {
  let best: { seg: RoadSegment; t: number } | null = null,
    bestD = Infinity;
  for (const s of segs) {
    const a = nodeMap.get(s.fromId),
      b = nodeMap.get(s.toId);
    if (!a || !b) continue;
    const { t, dist: d } = projectToSegment(p, a, b);
    if (d < Math.max(roadWidth(s, scale) / 2, fallback * scale) && d < bestD) {
      bestD = d;
      best = { seg: s, t };
    }
  }
  return best;
}

// ── Surface config ─────────────────────────────────────────────────────────────
const SURFACE: Record<
  SurfaceType,
  { color: string; border: string; label: string; dot: string }
> = {
  asphalt: {
    color: "#454545",
    border: "#1e1e1e",
    label: "Asphalt",
    dot: "#666",
  },
  concrete: {
    color: "#686868",
    border: "#3a3a3a",
    label: "Concrete",
    dot: "#999",
  },
  gravel: {
    color: "#6a5a40",
    border: "#3a2e1e",
    label: "Gravel",
    dot: "#8a7a50",
  },
  dirt: { color: "#8a6a40", border: "#5a3e1e", label: "Dirt", dot: "#b09060" },
};
const SURFACE_KEYS: SurfaceType[] = ["asphalt", "concrete", "gravel", "dirt"];
const SPEED_PRESETS = [20, 30, 50, 70, 90, 110, 130];

// ── UI helpers ─────────────────────────────────────────────────────────────────
function chip(active: boolean): React.CSSProperties {
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        color: "#556",
        fontSize: 11,
        marginBottom: 6,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
      }}
    >
      {children}
    </div>
  );
}

function LaneCounter({
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

// ── Road Edit Panel ────────────────────────────────────────────────────────────
function RoadEditPanel({
  seg,
  panelX,
  panelY,
  onChange,
  onClose,
}: {
  seg: RoadSegment;
  panelX: number;
  panelY: number;
  onChange: (s: RoadSegment) => void;
  onClose: () => void;
}) {
  const PW = 272;
  const left = Math.min(panelX + 8, window.innerWidth - PW - 12);
  const top = Math.min(panelY - 10, window.innerHeight - 510);
  const oneWay = seg.lanesBackward === 0;

  return (
    <div
      style={{
        position: "fixed",
        left,
        top,
        zIndex: 200,
        width: PW,
        maxHeight: "calc(100vh - 40px)",
        overflowY: "auto" as const,
        background: "#111128",
        border: "1px solid #252550",
        borderRadius: 10,
        padding: "14px 16px",
        color: "#bbc",
        fontSize: 13,
        boxShadow: "0 8px 40px rgba(0,0,0,0.8)",
        userSelect: "none",
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
          borderBottom: "1px solid #1e1e40",
          paddingBottom: 10,
        }}
      >
        <span style={{ fontWeight: 700, color: "#eef", fontSize: 14 }}>
          Road Properties
        </span>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "#556",
            cursor: "pointer",
            fontSize: 20,
            lineHeight: 1,
            padding: 0,
          }}
        >
          ✕
        </button>
      </div>

      <SectionLabel>Speed Limit (km/h)</SectionLabel>
      <div
        style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 14 }}
      >
        {SPEED_PRESETS.map((s) => (
          <button
            key={s}
            onClick={() => onChange({ ...seg, speedLimit: s })}
            style={chip(seg.speedLimit === s)}
          >
            {s}
          </button>
        ))}
      </div>

      <SectionLabel>Surface Type</SectionLabel>
      <div
        style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 14 }}
      >
        {SURFACE_KEYS.map((k) => (
          <button
            key={k}
            onClick={() => onChange({ ...seg, surface: k })}
            style={chip(seg.surface === k)}
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
      </div>

      <SectionLabel>Traffic Flow</SectionLabel>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        <button
          onClick={() => onChange({ ...seg, lanesBackward: 0 })}
          style={chip(oneWay)}
        >
          → One-way
        </button>
        <button
          onClick={() =>
            onChange({ ...seg, lanesBackward: Math.max(1, seg.lanesBackward) })
          }
          style={chip(!oneWay)}
        >
          ↔ Two-way
        </button>
      </div>

      <LaneCounter
        label={oneWay ? "Number of Lanes" : "Lanes → (forward)"}
        value={seg.lanesForward}
        onChange={(v) => onChange({ ...seg, lanesForward: v })}
      />
      {!oneWay && (
        <LaneCounter
          label="Lanes ← (backward)"
          value={seg.lanesBackward}
          onChange={(v) => onChange({ ...seg, lanesBackward: v })}
        />
      )}

      <SectionLabel>Segment Size</SectionLabel>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 14,
        }}
      >
        <input
          type="range"
          min={0.05}
          max={2}
          step={0.05}
          value={seg.displayScale ?? 1}
          onChange={(e) =>
            onChange({ ...seg, displayScale: parseFloat(e.target.value) })
          }
          style={{ flex: 1, accentColor: "#4a80c0" }}
        />
        <span style={{ color: "#80c0ff", fontWeight: 700, minWidth: 36 }}>
          {(seg.displayScale ?? 1).toFixed(2)}×
        </span>
      </div>

      <SectionLabel>Pedestrian Crossings</SectionLabel>
      <div style={{ marginBottom: 14 }}>
        {(seg.pedestrianCrossings ?? []).map((c) => (
          <div
            key={c.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 4,
              padding: "4px 6px",
              background: "#0a0a18",
              borderRadius: 4,
              border: "1px solid #1a1a30",
            }}
          >
            <span style={{ color: "#e0c030", fontSize: 12 }}>⇔</span>
            <span style={{ color: "#99a", fontSize: 11 }}>
              {(c.t * 100).toFixed(0)}% along road
            </span>
            <button
              onClick={() =>
                onChange({
                  ...seg,
                  pedestrianCrossings: (seg.pedestrianCrossings ?? []).filter(
                    (cc) => cc.id !== c.id,
                  ),
                })
              }
              style={{
                marginLeft: "auto",
                background: "none",
                border: "none",
                color: "#a05050",
                cursor: "pointer",
                fontSize: 14,
                padding: "0 4px",
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        ))}
        <button
          onClick={() =>
            onChange({
              ...seg,
              pedestrianCrossings: [
                ...(seg.pedestrianCrossings ?? []),
                { id: uid(), t: 0.5 },
              ],
            })
          }
          style={{
            width: "100%",
            background: "#0d0d1a",
            border: "1px dashed #333350",
            borderRadius: 4,
            color: "#667",
            padding: "6px 8px",
            fontSize: 11,
            cursor: "pointer",
            marginTop: 4,
          }}
        >
          + Add crossing at center
        </button>
      </div>

      <SectionLabel>Coefficients</SectionLabel>
      <div style={{ marginBottom: 6 }}>
        {(seg.coefficients ?? []).map((c) => {
          const cfg = COEFF[c.type];
          const isBinary = cfg.max === 1 && cfg.min === 0 && cfg.step === 1;
          return (
            <div
              key={c.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 5,
                padding: "5px 7px",
                background: "#0a0a18",
                borderRadius: 5,
                border: "1px solid #1a1a30",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: cfg.color,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  color: "#99a",
                  fontSize: 12,
                  flex: 1,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {cfg.label}
              </span>
              {!isBinary && (
                <>
                  <input
                    type="number"
                    min={cfg.min}
                    max={cfg.max}
                    step={cfg.step}
                    value={c.value}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (isNaN(v)) return;
                      const clamped = Math.min(cfg.max, Math.max(cfg.min, v));
                      onChange({
                        ...seg,
                        coefficients: (seg.coefficients ?? []).map((cc) =>
                          cc.id === c.id ? { ...cc, value: clamped } : cc,
                        ),
                      });
                    }}
                    style={{
                      width: 52,
                      background: "#0d0d1a",
                      border: "1px solid #222240",
                      borderRadius: 3,
                      color: "#80c0ff",
                      padding: "2px 4px",
                      fontSize: 12,
                      textAlign: "right",
                    }}
                  />
                  {cfg.unit && (
                    <span style={{ color: "#556", fontSize: 11, minWidth: 20 }}>
                      {cfg.unit}
                    </span>
                  )}
                </>
              )}
              <button
                onClick={() =>
                  onChange({
                    ...seg,
                    coefficients: (seg.coefficients ?? []).filter(
                      (cc) => cc.id !== c.id,
                    ),
                  })
                }
                style={{
                  background: "none",
                  border: "none",
                  color: "#a05050",
                  cursor: "pointer",
                  fontSize: 16,
                  padding: "0 2px",
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
          );
        })}
        {(seg.coefficients ?? []).length < COEFF_TYPES.length && (
          <select
            value=""
            onChange={(e) => {
              const type = e.target.value as CoefficientType;
              if (!type) return;
              const cfg = COEFF[type];
              onChange({
                ...seg,
                coefficients: [
                  ...(seg.coefficients ?? []),
                  { id: uid(), type, value: cfg.default },
                ],
              });
            }}
            style={{
              width: "100%",
              background: "#0d0d1a",
              border: "1px solid #222240",
              borderRadius: 4,
              color: "#80c0ff",
              padding: "5px 8px",
              fontSize: 12,
              cursor: "pointer",
              marginTop: 4,
            }}
          >
            <option value="">+ Add coefficient...</option>
            {COEFF_TYPES.filter(
              (t) => !(seg.coefficients ?? []).some((c) => c.type === t),
            ).map((t) => (
              <option key={t} value={t}>
                {COEFF[t].label}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}

// ── Canvas drawing ─────────────────────────────────────────────────────────────
function drawArrow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  angle: number,
  size = 12,
) {
  const fx = Math.cos(angle),
    fy = Math.sin(angle);
  const lx = -Math.sin(angle),
    ly = Math.cos(angle);
  const h = size * 0.5,
    w = size * 0.35;
  ctx.beginPath();
  ctx.moveTo(cx - fx * h, cy - fy * h);
  ctx.lineTo(cx + fx * h, cy + fy * h);
  ctx.moveTo(cx + fx * h, cy + fy * h);
  ctx.lineTo(cx + fx * h - fx * w + lx * w, cy + fy * h - fy * w + ly * w);
  ctx.moveTo(cx + fx * h, cy + fy * h);
  ctx.lineTo(cx + fx * h - fx * w - lx * w, cy + fy * h - fy * w - ly * w);
  ctx.stroke();
}

function render(
  ctx: CanvasRenderingContext2D,
  nodes: ScreenNode[],
  segments: RoadSegment[],
  selectedId: string | null,
  hoveredNodeId: string | null,
  hoveredSegId: string | null,
  hoveredHandle: HoveredHandle | null,
  tool: Tool,
  buildFrom: ScreenNode | null,
  mouse: Vec2 | null,
  scale: number,
  dropTargetSegId: string | null,
) {
  const W = ctx.canvas.width,
    H = ctx.canvas.height;
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const hsMap = new Map<string, number>();
  for (const n of nodes) hsMap.set(n.id, nodeHalfSize(n.id, segments, scale));

  ctx.clearRect(0, 0, W, H);

  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";

  // ── Road bodies (trimmed to intersection box edges) ──
  for (const seg of segments) {
    const a = nodeMap.get(seg.fromId),
      b = nodeMap.get(seg.toId);
    if (!a || !b) continue;
    const rw = roadWidth(seg, scale);
    const { color, border } = SURFACE[seg.surface];
    const isSel = seg.id === selectedId;
    const isHov = seg.id === hoveredSegId;

    const segLen = dist(a, b);
    if (segLen < 2) continue;
    const ux = (b.x - a.x) / segLen,
      uy = (b.y - a.y) / segLen;
    const hsA = hsMap.get(seg.fromId) ?? 0;
    const hsB = hsMap.get(seg.toId) ?? 0;
    const drawnLen = segLen - hsA - hsB;
    if (drawnLen < 4) continue;

    const sx = a.x + ux * hsA,
      sy = a.y + uy * hsA;
    const ex = b.x - ux * hsB,
      ey = b.y - uy * hsB;

    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.strokeStyle = isSel ? "#1e4a90" : isHov ? "#2a2a40" : border;
    ctx.lineWidth = rw + 6 * scale;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.strokeStyle = isSel ? "#2a5080" : color;
    ctx.lineWidth = rw;
    ctx.stroke();
  }

  // ── Square intersection boxes ──
  for (const node of nodes) {
    const hs = hsMap.get(node.id) ?? LANE_WIDTH * scale;
    const isSel = node.id === selectedId;
    const isHov = node.id === hoveredNodeId;
    const isHandleHov = hoveredHandle?.nodeId === node.id;
    const segs = nodeSegments(segments, node.id);
    const isIntersection = segs.length >= 3;

    const dominant =
      segs.length > 0
        ? segs.reduce((a, b) => (totalLanes(a) >= totalLanes(b) ? a : b))
        : null;
    const { color, border } = dominant
      ? SURFACE[dominant.surface]
      : SURFACE.asphalt;

    const pad = 10 * scale;
    if (isIntersection) {
      ctx.fillStyle = "rgba(255,160,0,0.08)";
      ctx.fillRect(
        node.x - hs - pad,
        node.y - hs - pad,
        (hs + pad) * 2,
        (hs + pad) * 2,
      );
    }

    const borderPad = 3 * scale;
    ctx.fillStyle = isSel ? "#1e4a90" : border;
    ctx.fillRect(
      node.x - hs - borderPad,
      node.y - hs - borderPad,
      (hs + borderPad) * 2,
      (hs + borderPad) * 2,
    );

    ctx.fillStyle = isSel ? "#2a5080" : color;
    ctx.fillRect(node.x - hs, node.y - hs, hs * 2, hs * 2);

    if (isSel || isHov || isHandleHov) {
      ctx.strokeStyle = isSel ? "#80c0ff" : isIntersection ? "#ffb400" : "#aaa";
      ctx.lineWidth = (isHov || isHandleHov ? 1.5 : 2) * scale;
      ctx.strokeRect(
        node.x - hs - 0.5,
        node.y - hs - 0.5,
        hs * 2 + 1,
        hs * 2 + 1,
      );
    }

    if (isIntersection) {
      ctx.fillStyle = "rgba(255,160,0,0.7)";
      ctx.font = `bold ${Math.max(9, Math.min(12, hs - 4 * scale))}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("✕", node.x, node.y);
    }
  }

  // ── Lane markings + arrows ──
  ctx.lineCap = "butt";
  const lw = LANE_WIDTH * scale;
  for (const seg of segments) {
    const a = nodeMap.get(seg.fromId),
      b = nodeMap.get(seg.toId);
    if (!a || !b) continue;

    const nF = seg.lanesForward,
      nB = seg.lanesBackward;
    const rw = (nF + nB) * lw;
    const segLen = dist(a, b);
    if (segLen < 2) continue;
    const ux = (b.x - a.x) / segLen,
      uy = (b.y - a.y) / segLen;
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const px = -uy,
      py = ux;

    const hsA = hsMap.get(seg.fromId) ?? 0;
    const hsB = hsMap.get(seg.toId) ?? 0;
    const margin = 4 * scale;
    const sx = a.x + ux * (hsA + margin),
      sy = a.y + uy * (hsA + margin);
    const ex = b.x - ux * (hsB + margin),
      ey = b.y - uy * (hsB + margin);
    if (dist({ x: sx, y: sy }, { x: ex, y: ey }) < 16 * scale) continue;

    const cOff = ((nF - nB) / 2) * lw;

    ctx.setLineDash([]);
    ctx.strokeStyle = "rgba(255,255,255,0.65)";
    ctx.lineWidth = 2 * scale;
    for (const side of [-1, 1]) {
      const off = (side * rw) / 2;
      ctx.beginPath();
      ctx.moveTo(sx + px * off, sy + py * off);
      ctx.lineTo(ex + px * off, ey + py * off);
      ctx.stroke();
    }

    ctx.setLineDash([10 * scale, 10 * scale]);
    ctx.strokeStyle = "rgba(255,255,255,0.38)";
    ctx.lineWidth = 1.5 * scale;
    for (let i = 1; i < nF; i++) {
      const off = cOff - i * lw;
      ctx.beginPath();
      ctx.moveTo(sx + px * off, sy + py * off);
      ctx.lineTo(ex + px * off, ey + py * off);
      ctx.stroke();
    }
    for (let i = 1; i < nB; i++) {
      const off = cOff + i * lw;
      ctx.beginPath();
      ctx.moveTo(sx + px * off, sy + py * off);
      ctx.lineTo(ex + px * off, ey + py * off);
      ctx.stroke();
    }

    if (nB > 0) {
      ctx.setLineDash([14 * scale, 7 * scale]);
      ctx.strokeStyle = "rgba(255,200,40,0.85)";
      ctx.lineWidth = 2.5 * scale;
      ctx.beginPath();
      ctx.moveTo(sx + px * cOff, sy + py * cOff);
      ctx.lineTo(ex + px * cOff, ey + py * cOff);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    ctx.lineCap = "round";
    ctx.lineWidth = 1.5 * scale;
    const drawnLen = dist({ x: sx, y: sy }, { x: ex, y: ey });
    const step = 80 * scale;
    for (let d = step; d < drawnLen - 10 * scale; d += step) {
      const t = d / drawnLen;
      const bx = sx + (ex - sx) * t,
        by = sy + (ey - sy) * t;
      ctx.strokeStyle = "rgba(255,255,255,0.32)";
      for (let i = 0; i < nF; i++) {
        drawArrow(
          ctx,
          bx + px * (cOff - (i + 0.5) * lw),
          by + py * (cOff - (i + 0.5) * lw),
          angle,
          12 * scale,
        );
      }
      if (nB > 0) {
        ctx.strokeStyle = "rgba(255,255,255,0.25)";
        for (let i = 0; i < nB; i++) {
          drawArrow(
            ctx,
            bx + px * (cOff + (i + 0.5) * lw),
            by + py * (cOff + (i + 0.5) * lw),
            angle + Math.PI,
            12 * scale,
          );
        }
      }
    }
    ctx.lineCap = "butt";

    const midX = (sx + ex) / 2,
      midY = (sy + ey) / 2;
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.font = `bold ${Math.max(8, Math.round(10 * scale))}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      nB > 0 ? `${nF}↔${nB}  ${seg.speedLimit}` : `${nF}→  ${seg.speedLimit}`,
      midX,
      midY,
    );
  }
  ctx.setLineDash([]);

  // ── Pedestrian crossings (zebra stripes) ──
  const NUM_STRIPES = 6;
  for (const seg of segments) {
    const crossings = seg.pedestrianCrossings;
    if (!crossings || crossings.length === 0) continue;
    const a = nodeMap.get(seg.fromId),
      b = nodeMap.get(seg.toId);
    if (!a || !b) continue;
    const segLen = dist(a, b);
    if (segLen < 2) continue;
    const hsA = hsMap.get(seg.fromId) ?? 0;
    const hsB = hsMap.get(seg.toId) ?? 0;
    const tMin = hsA / segLen;
    const tMax = 1 - hsB / segLen;
    const rw = roadWidth(seg, scale);
    const stripeWidth = Math.max(2, rw / 4);

    for (const cross of crossings) {
      const t = Math.max(0, Math.min(1, cross.t));
      if (t < tMin + 0.02 || t > tMax - 0.02) continue;
      const cx = a.x + t * (b.x - a.x);
      const cy = a.y + t * (b.y - a.y);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.atan2(b.y - a.y, b.x - a.x));
      for (let i = 0; i < NUM_STRIPES; i++) {
        const x0 = -((NUM_STRIPES * stripeWidth) / 2) + i * stripeWidth;
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.fillRect(x0, -rw / 2, stripeWidth, rw);
      }
      ctx.restore();
    }
  }

  // ── Coefficient markers ──
  for (const seg of segments) {
    const coeffs = seg.coefficients;
    if (!coeffs || coeffs.length === 0) continue;
    const a = nodeMap.get(seg.fromId),
      b = nodeMap.get(seg.toId);
    if (!a || !b) continue;
    const segLen = dist(a, b);
    if (segLen < 2) continue;
    const ux = (b.x - a.x) / segLen,
      uy = (b.y - a.y) / segLen;
    const px = -uy,
      py = ux;
    const hsA = hsMap.get(seg.fromId) ?? 0;
    const hsB = hsMap.get(seg.toId) ?? 0;
    const margin = 8 * scale;
    const sx = a.x + ux * (hsA + margin),
      sy = a.y + uy * (hsA + margin);
    const ex = b.x - ux * (hsB + margin),
      ey = b.y - uy * (hsB + margin);
    const drawnLen = dist({ x: sx, y: sy }, { x: ex, y: ey });
    if (drawnLen < 30 * scale) continue;

    const rw = roadWidth(seg, scale);
    const r = Math.max(6, 8 * scale);
    const n = coeffs.length;

    for (let ci = 0; ci < n; ci++) {
      const c = coeffs[ci];
      const cfg = COEFF[c.type];
      const t = n === 1 ? 0.5 : 0.15 + (0.7 * ci) / (n - 1);
      const baseX = sx + (ex - sx) * t;
      const baseY = sy + (ey - sy) * t;
      const offset = rw / 2 + r + 3 * scale;
      const mx = baseX + px * offset;
      const my = baseY + py * offset;

      // Connecting line from road edge to marker
      ctx.beginPath();
      ctx.moveTo(baseX + px * (rw / 2), baseY + py * (rw / 2));
      ctx.lineTo(mx, my);
      ctx.strokeStyle = cfg.color + "50";
      ctx.lineWidth = 1 * scale;
      ctx.stroke();

      // Circle background
      ctx.beginPath();
      ctx.arc(mx, my, r, 0, Math.PI * 2);
      ctx.fillStyle = cfg.color;
      ctx.fill();
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1.2 * scale;
      ctx.stroke();

      // Symbol
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${Math.max(7, Math.round(9 * scale))}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(cfg.symbol, mx, my);

      // Value label below marker (if zoom is sufficient)
      if (scale >= 0.7) {
        const isBinary = cfg.max === 1 && cfg.min === 0 && cfg.step === 1;
        if (!isBinary) {
          ctx.fillStyle = cfg.color;
          ctx.font = `${Math.max(7, Math.round(8 * scale))}px sans-serif`;
          ctx.fillText(`${c.value}${cfg.unit}`, mx, my + r + 7 * scale);
        }
      }
    }
  }

  // ── Connection handles ──
  const hr = HANDLE_RADIUS * scale;
  if (tool !== "delete") {
    const showFor = new Set<string>();
    if (hoveredNodeId) showFor.add(hoveredNodeId);
    if (hoveredHandle) showFor.add(hoveredHandle.nodeId);
    if (selectedId && nodes.some((n) => n.id === selectedId))
      showFor.add(selectedId);

    for (const nodeId of showFor) {
      const node = nodeMap.get(nodeId);
      if (!node) continue;
      const hs = hsMap.get(nodeId) ?? LANE_WIDTH * scale;

      for (let i = 0; i < 4; i++) {
        const hp = handlePos(node, hs, i, scale);
        const isHov =
          hoveredHandle?.nodeId === nodeId && hoveredHandle?.idx === i;
        const isBuildTarget = buildFrom?.id === nodeId;

        ctx.beginPath();
        const edgeX = node.x + (i === 1 ? hs : i === 3 ? -hs : 0);
        const edgeY = node.y + (i === 2 ? hs : i === 0 ? -hs : 0);
        ctx.moveTo(edgeX, edgeY);
        ctx.lineTo(hp.x, hp.y);
        ctx.strokeStyle = isHov
          ? "rgba(100,180,255,0.6)"
          : "rgba(80,120,180,0.35)";
        ctx.lineWidth = 1.5 * scale;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(hp.x, hp.y, hr, 0, Math.PI * 2);
        ctx.fillStyle = isHov
          ? "#1e4a9a"
          : isBuildTarget
            ? "#1a3060"
            : "#111828";
        ctx.fill();
        ctx.strokeStyle = isHov ? "#80c0ff" : "#3a60a0";
        ctx.lineWidth = (isHov ? 2 : 1.5) * scale;
        ctx.stroke();

        const s = 4 * scale;
        ctx.strokeStyle = isHov ? "#a0d0ff" : "#4a80c0";
        ctx.lineWidth = (isHov ? 2 : 1.5) * scale;
        ctx.beginPath();
        ctx.moveTo(hp.x - s, hp.y);
        ctx.lineTo(hp.x + s, hp.y);
        ctx.moveTo(hp.x, hp.y - s);
        ctx.lineTo(hp.x, hp.y + s);
        ctx.stroke();
      }
    }
  }

  // ── Ghost segment (road building preview) ──
  if (tool === "road" && buildFrom && mouse) {
    const snap = nearestNodeSq(nodes, segments, mouse, scale, buildFrom.id);
    const target = snap ?? mouse;
    ctx.setLineDash([8 * scale, 6 * scale]);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(buildFrom.x, buildFrom.y);
    ctx.lineTo(target.x, target.y);
    ctx.strokeStyle = "rgba(100,180,255,0.55)";
    ctx.lineWidth = 3 * scale;
    ctx.stroke();
    ctx.setLineDash([]);
    if (snap) {
      const hs = hsMap.get(snap.id) ?? LANE_WIDTH * scale;
      ctx.strokeStyle = "rgba(80,220,80,0.7)";
      ctx.lineWidth = 2 * scale;
      ctx.strokeRect(
        snap.x - hs - 2 * scale,
        snap.y - hs - 2 * scale,
        (hs + 2 * scale) * 2,
        (hs + 2 * scale) * 2,
      );
    }
  }

  // ── Hovered segment highlight ──
  if (hoveredSegId) {
    const seg = segments.find((s) => s.id === hoveredSegId);
    if (seg) {
      const a = nodeMap.get(seg.fromId),
        b = nodeMap.get(seg.toId);
      if (a && b) {
        ctx.lineCap = "butt";
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle =
          tool === "delete" ? "rgba(255,80,80,0.18)" : "rgba(100,180,255,0.18)";
        ctx.lineWidth = roadWidth(seg, scale) + 8 * scale;
        ctx.stroke();
      }
    }
  }

  // ── Drop target highlight (drag obstacle onto road) ──
  if (dropTargetSegId) {
    const seg = segments.find((s) => s.id === dropTargetSegId);
    if (seg) {
      const a = nodeMap.get(seg.fromId),
        b = nodeMap.get(seg.toId);
      if (a && b) {
        ctx.lineCap = "butt";
        ctx.setLineDash([8 * scale, 6 * scale]);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = "rgba(80,220,120,0.35)";
        ctx.lineWidth = roadWidth(seg, scale) + 14 * scale;
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }
}

// ── App ────────────────────────────────────────────────────────────────────────
export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const panRef = useRef({ active: false, startX: 0, startY: 0, didPan: false });

  const [nodes, setNodes] = useState<RoadNode[]>([]);
  const [segments, setSegments] = useState<RoadSegment[]>([]);
  const [tool, setTool] = useState<Tool>("road");
  const [defLanesF, setDefLanesF] = useState(1);
  const [defLanesB, setDefLanesB] = useState(1);
  const [defSpeed, setDefSpeed] = useState(50);
  const [defSurface, setDefSurface] = useState<SurfaceType>("asphalt");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [buildFrom, setBuildFrom] = useState<RoadNode | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredSegId, setHoveredSegId] = useState<string | null>(null);
  const [hoveredHandle, setHoveredHandle] = useState<HoveredHandle | null>(
    null,
  );
  const [mouse, setMouse] = useState<Vec2 | null>(null);
  const [editPanel, setEditPanel] = useState<EditPanelState | null>(null);
  const [roadScale, setRoadScale] = useState(0.1);
  const [defDisplayScale, setDefDisplayScale] = useState(1);
  const [draggingCoeff, setDraggingCoeff] = useState<CoefficientType | null>(
    null,
  );
  const [dropTargetSegId, setDropTargetSegId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(true);
  const draggingCoeffRef = useRef<CoefficientType | null>(null);
  const [draggingCrossingFromPalette, setDraggingCrossingFromPalette] =
    useState(false);
  const draggingCrossingFromPaletteRef = useRef(false);

  const [hoveredCrossingId, setHoveredCrossingId] = useState<string | null>(
    null,
  );
  const [draggingCrossing, setDraggingCrossing] = useState<{
    segId: string;
    crossingId: string;
  } | null>(null);
  const draggingCrossingRef = useRef<{
    segId: string;
    crossingId: string;
  } | null>(null);
  const justFinishedCrossingDragRef = useRef(false);

  const stateRef = useRef({
    nodes,
    segments,
    tool,
    defLanesF,
    defLanesB,
    defSpeed,
    defSurface,
    selectedId,
    buildFrom,
    hoveredNodeId,
    hoveredSegId,
    hoveredHandle,
    mouse,
    roadScale,
    defDisplayScale,
    dropTargetSegId,
  });
  useLayoutEffect(() => {
    stateRef.current = {
      nodes,
      segments,
      tool,
      defLanesF,
      defLanesB,
      defSpeed,
      defSurface,
      selectedId,
      buildFrom,
      hoveredNodeId,
      hoveredSegId,
      hoveredHandle,
      mouse,
      roadScale,
      defDisplayScale,
      dropTargetSegId,
    };
  });

  // ── Helper: run a full canvas render using current stateRef ──
  const renderFromRef = useCallback((map: L.Map) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const s = stateRef.current;
    const scale = getScale(map.getZoom(), s.roadScale);
    const screenNodes = s.nodes.map((n) => toScreen(map, n));
    const screenBf = s.buildFrom ? toScreen(map, s.buildFrom) : null;
    render(
      canvas.getContext("2d")!,
      screenNodes,
      s.segments,
      s.selectedId,
      s.hoveredNodeId,
      s.hoveredSegId,
      s.hoveredHandle,
      s.tool,
      screenBf,
      s.mouse,
      scale,
      s.dropTargetSegId,
    );
  }, []);

  // ── Resize (must run before map init so canvas is sized) ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const map = mapRef.current;
      map?.invalidateSize();
      if (map) renderFromRef(map);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [renderFromRef]);

  // ── Leaflet map init ──
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current, {
      center: MAP_CENTER,
      zoom: MAP_ZOOM,
      zoomControl: false,
      attributionControl: true,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;

    map.on("move zoom", () => renderFromRef(map));
    renderFromRef(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [renderFromRef]);

  // ── Canvas render (React state changes) ──
  useEffect(() => {
    const canvas = canvasRef.current;
    const map = mapRef.current;
    if (!canvas || !map) return;
    const scale = getScale(map.getZoom(), roadScale);
    const screenNodes = nodes.map((n) => toScreen(map, n));
    const screenBf = buildFrom ? toScreen(map, buildFrom) : null;
    render(
      canvas.getContext("2d")!,
      screenNodes,
      segments,
      selectedId,
      hoveredNodeId,
      hoveredSegId,
      hoveredHandle,
      tool,
      screenBf,
      mouse,
      scale,
      dropTargetSegId,
    );
  }, [
    nodes,
    segments,
    selectedId,
    hoveredNodeId,
    hoveredSegId,
    hoveredHandle,
    tool,
    buildFrom,
    mouse,
    roadScale,
    dropTargetSegId,
  ]);

  // ── Wheel zoom (non-passive to allow preventDefault) ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const map = mapRef.current;
      if (!map) return;
      const rect = canvas.getBoundingClientRect();
      const latlng = map.containerPointToLatLng(
        L.point(e.clientX - rect.left, e.clientY - rect.top),
      );
      const delta = e.deltaY > 0 ? -1 : 1;
      const zoom = Math.max(
        map.getMinZoom(),
        Math.min(map.getMaxZoom(), map.getZoom() + delta),
      );
      map.setZoomAround(latlng, zoom);
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

  // ── Global panning listeners (shift+drag / middle-drag) ──
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!panRef.current.active) return;
      const map = mapRef.current;
      if (!map) return;
      const dx = e.clientX - panRef.current.startX;
      const dy = e.clientY - panRef.current.startY;
      if (dx !== 0 || dy !== 0) panRef.current.didPan = true;
      panRef.current.startX = e.clientX;
      panRef.current.startY = e.clientY;
      map.panBy(L.point(-dx, -dy), { animate: false });
    };
    const onUp = () => {
      if (!panRef.current.active) return;
      panRef.current.active = false;
      if (canvasRef.current) {
        const t = stateRef.current.tool;
        canvasRef.current.style.cursor =
          t === "select" ? "default" : "crosshair";
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  // ── Global crossing drag listeners ──
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const dc = draggingCrossingRef.current;
      if (!dc) return;
      const map = mapRef.current;
      if (!map) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const { segments: segs, nodes: ns } = stateRef.current;
      const screenNodes = ns.map((n) => toScreen(map, n));
      const screenMap = new Map(screenNodes.map((n) => [n.id, n]));
      const seg = segs.find((s) => s.id === dc.segId);
      if (!seg) return;
      const a = screenMap.get(seg.fromId);
      const b = screenMap.get(seg.toId);
      if (!a || !b) return;
      const { t } = projectToSegment(pos, a, b);
      const safeT = Math.max(0.05, Math.min(0.95, t));
      setSegments((p) =>
        p.map((s) => {
          if (s.id !== dc.segId) return s;
          return {
            ...s,
            pedestrianCrossings: (s.pedestrianCrossings ?? []).map((c) =>
              c.id === dc.crossingId ? { ...c, t: safeT } : c,
            ),
          };
        }),
      );
    };
    const onUp = () => {
      if (!draggingCrossingRef.current) return;
      justFinishedCrossingDragRef.current = true;
      draggingCrossingRef.current = null;
      setDraggingCrossing(null);
      if (canvasRef.current) {
        const t = stateRef.current.tool;
        canvasRef.current.style.cursor =
          t === "select" ? "default" : "crosshair";
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const getPos = useCallback((e: React.MouseEvent): Vec2 => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }, []);

  // ── Mouse down (start panning or crossing drag) ──
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if ((e.shiftKey && e.button === 0) || e.button === 1) {
        panRef.current = {
          active: true,
          startX: e.clientX,
          startY: e.clientY,
          didPan: false,
        };
        e.preventDefault();
        canvasRef.current!.style.cursor = "grabbing";
        return;
      }
      if (e.button === 0 && !e.shiftKey) {
        const map = mapRef.current;
        if (!map) return;
        const rect = canvasRef.current!.getBoundingClientRect();
        const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        const {
          segments: segs,
          nodes: ns,
          tool: t,
          roadScale: rs,
        } = stateRef.current;
        if (t === "select" || t === "crossing") {
          const scale = getScale(map.getZoom(), rs);
          const screenNodes = ns.map((n) => toScreen(map, n));
          const screenMap = new Map(screenNodes.map((n) => [n.id, n]));
          const snap = nearestCrossing(screenMap, segs, pos, scale);
          if (snap) {
            draggingCrossingRef.current = {
              segId: snap.seg.id,
              crossingId: snap.crossing.id,
            };
            setDraggingCrossing({
              segId: snap.seg.id,
              crossingId: snap.crossing.id,
            });
          }
        }
      }
    },
    [],
  );

  // ── Mouse move: handles > nodes > segments ──
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (panRef.current.active) return;
      const map = mapRef.current;
      if (!map) return;

      const pos = getPos(e);
      setMouse(pos);
      const {
        nodes: ns,
        segments: segs,
        tool: t,
        buildFrom: bf,
        roadScale: rs,
      } = stateRef.current;
      const scale = getScale(map.getZoom(), rs);
      const screenNodes = ns.map((n) => toScreen(map, n));
      const screenMap = new Map(screenNodes.map((n) => [n.id, n]));
      const screenBf = bf ? toScreen(map, bf) : null;
      const hr = HANDLE_RADIUS * scale;

      if (t !== "delete") {
        for (const sn of screenNodes) {
          const hs = nodeHalfSize(sn.id, segs, scale);
          if (dist(pos, sn) > hs + HANDLE_OFFSET * scale + hr + 6 * scale)
            continue;
          for (let i = 0; i < 4; i++) {
            if (dist(pos, handlePos(sn, hs, i, scale)) <= hr + 3 * scale) {
              setHoveredHandle({ nodeId: sn.id, idx: i });
              setHoveredNodeId(null);
              setHoveredSegId(null);
              return;
            }
          }
        }
      }
      setHoveredHandle(null);

      const exclude = screenBf?.id;
      const hNode = nearestNodeSq(screenNodes, segs, pos, scale, exclude);
      setHoveredNodeId(hNode?.id ?? null);
      const seg = hNode
        ? null
        : nearestSegment(screenMap, segs, pos, 30, scale);
      setHoveredSegId(seg?.id ?? null);
      if ((t === "select" || t === "crossing") && !hNode) {
        const snapCross = nearestCrossing(screenMap, segs, pos, scale);
        setHoveredCrossingId(snapCross?.crossing.id ?? null);
      } else {
        setHoveredCrossingId(null);
      }
    },
    [getPos],
  );

  // ── Left click ──
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (e.button !== 0) return;
      if (e.shiftKey) return;
      if (panRef.current.didPan) {
        panRef.current.didPan = false;
        return;
      }
      const map = mapRef.current;
      if (!map) return;

      setEditPanel(null);
      if (justFinishedCrossingDragRef.current) {
        justFinishedCrossingDragRef.current = false;
        return;
      }
      const pos = getPos(e);
      const {
        nodes: ns,
        segments: segs,
        tool: t,
        defLanesF: dlF,
        defLanesB: dlB,
        defSpeed: dspd,
        defSurface: dsurf,
        defDisplayScale: dDsp,
        buildFrom: bf,
        roadScale: rs,
      } = stateRef.current;

      const scale = getScale(map.getZoom(), rs);
      const screenNodes = ns.map((n) => toScreen(map, n));
      const screenMap = new Map(screenNodes.map((n) => [n.id, n]));
      const geoMap = new Map(ns.map((n) => [n.id, n]));
      const screenBf = bf ? toScreen(map, bf) : null;
      const hr = HANDLE_RADIUS * scale;
      const minLen = MIN_SEGMENT_LENGTH * scale;

      // ── Handle click: always starts/extends a road ──
      if (t !== "delete" && t !== "crossing") {
        for (const sn of screenNodes) {
          const hs = nodeHalfSize(sn.id, segs, scale);
          if (dist(pos, sn) > hs + HANDLE_OFFSET * scale + hr + 6 * scale)
            continue;
          for (let i = 0; i < 4; i++) {
            if (dist(pos, handlePos(sn, hs, i, scale)) <= hr + 3 * scale) {
              const geoNode = geoMap.get(sn.id)!;
              if (!bf) {
                setTool("road");
                setBuildFrom(geoNode);
              } else if (bf.id !== sn.id) {
                if (!alreadyConnected(segs, bf.id, sn.id)) {
                  setSegments((p) => [
                    ...p,
                    {
                      id: uid(),
                      fromId: bf.id,
                      toId: sn.id,
                      lanesForward: dlF,
                      lanesBackward: dlB,
                      speedLimit: dspd,
                      surface: dsurf,
                      displayScale: dDsp,
                    },
                  ]);
                }
                setBuildFrom(geoNode);
              }
              return;
            }
          }
        }
      }

      // ── Road tool ──
      if (t === "road") {
        const snap = nearestNodeSq(screenNodes, segs, pos, scale, screenBf?.id);
        if (!bf) {
          if (snap) {
            setBuildFrom(geoMap.get(snap.id)!);
          } else {
            const geo = toGeo(map, pos);
            const newNode: RoadNode = { id: uid(), lat: geo.lat, lng: geo.lng };
            setNodes((p) => [...p, newNode]);
            setBuildFrom(newNode);
          }
        } else {
          if (snap?.id === bf.id) return;
          if (snap) {
            if (dist(screenBf!, snap) < minLen) return;
            if (!alreadyConnected(segs, bf.id, snap.id)) {
              setSegments((p) => [
                ...p,
                {
                  id: uid(),
                  fromId: bf.id,
                  toId: snap.id,
                  lanesForward: dlF,
                  lanesBackward: dlB,
                  speedLimit: dspd,
                  surface: dsurf,
                  displayScale: dDsp,
                },
              ]);
            }
            setBuildFrom(null);
          } else {
            if (dist(screenBf!, pos) < minLen) return;
            const geo = toGeo(map, pos);
            const newNode: RoadNode = { id: uid(), lat: geo.lat, lng: geo.lng };
            setNodes((p) => [...p, newNode]);
            if (!alreadyConnected(segs, bf.id, newNode.id)) {
              setSegments((p) => [
                ...p,
                {
                  id: uid(),
                  fromId: bf.id,
                  toId: newNode.id,
                  lanesForward: dlF,
                  lanesBackward: dlB,
                  speedLimit: dspd,
                  surface: dsurf,
                  displayScale: dDsp,
                },
              ]);
            }
            setBuildFrom(newNode);
          }
        }

        // ── Crossing tool ──
      } else if (t === "crossing") {
        const snap = nearestSegmentWithT(screenMap, segs, pos, 30, scale);
        if (snap) {
          const safeT = Math.max(0.05, Math.min(0.95, snap.t));
          setSegments((p) =>
            p.map((s) => {
              if (s.id !== snap.seg.id) return s;
              return {
                ...s,
                pedestrianCrossings: [
                  ...(s.pedestrianCrossings ?? []),
                  { id: uid(), t: safeT },
                ],
              };
            }),
          );
        }
        // ── Select tool ──
      } else if (t === "select") {
        const snapN = nearestNodeSq(screenNodes, segs, pos, scale);
        if (snapN) {
          setSelectedId((prev) => (prev === snapN.id ? null : snapN.id));
          return;
        }
        const snapS = nearestSegment(screenMap, segs, pos, 30, scale);
        if (snapS)
          setSelectedId((prev) => (prev === snapS.id ? null : snapS.id));
        else setSelectedId(null);

        // ── Delete tool ──
      } else if (t === "delete") {
        const snapCross = nearestCrossing(screenMap, segs, pos, scale);
        if (snapCross) {
          setSegments((p) =>
            p.map((s) => {
              if (s.id !== snapCross.seg.id) return s;
              return {
                ...s,
                pedestrianCrossings: (s.pedestrianCrossings ?? []).filter(
                  (c) => c.id !== snapCross.crossing.id,
                ),
              };
            }),
          );
          return;
        }
        const snapN = nearestNodeSq(screenNodes, segs, pos, scale);
        if (snapN) {
          setNodes((p) => p.filter((n) => n.id !== snapN.id));
          setSegments((p) =>
            p.filter((s) => s.fromId !== snapN.id && s.toId !== snapN.id),
          );
          setSelectedId((prev) => (prev === snapN.id ? null : prev));
          return;
        }
        const snapS = nearestSegment(screenMap, segs, pos, 30, scale);
        if (snapS) {
          setSegments((p) => p.filter((s) => s.id !== snapS.id));
          setSelectedId((prev) => (prev === snapS.id ? null : prev));
        }
      }
    },
    [getPos],
  );

  // ── Right-click: open road editor or cancel building ──
  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const map = mapRef.current;
      if (!map) return;
      const {
        buildFrom: bf,
        nodes: ns,
        segments: segs,
        roadScale: rs,
      } = stateRef.current;
      if (bf) {
        setBuildFrom(null);
        return;
      }
      const pos = getPos(e);
      const scale = getScale(map.getZoom(), rs);
      const screenNodes = ns.map((n) => toScreen(map, n));
      const screenMap = new Map(screenNodes.map((n) => [n.id, n]));
      const seg = nearestSegment(screenMap, segs, pos, 30, scale);
      if (seg) {
        setEditPanel({ segId: seg.id, x: e.clientX, y: e.clientY });
        setSelectedId(seg.id);
      } else setEditPanel(null);
    },
    [getPos],
  );

  const handleSegmentChange = useCallback((updated: RoadSegment) => {
    setSegments((p) => p.map((s) => (s.id === updated.id ? updated : s)));
  }, []);

  // ── Drag-and-drop obstacle onto road ──
  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      const dc = draggingCoeffRef.current;
      const fromPalette = draggingCrossingFromPaletteRef.current;
      if (!dc && !fromPalette) return;
      const map = mapRef.current;
      if (!map) return;
      const rect = canvasRef.current!.getBoundingClientRect();
      const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const { segments: segs, nodes: ns, roadScale: rs } = stateRef.current;
      const scale = getScale(map.getZoom(), rs);
      const screenNodes = ns.map((n) => toScreen(map, n));
      const screenMap = new Map(screenNodes.map((n) => [n.id, n]));
      const seg = nearestSegment(screenMap, segs, pos, 30, scale);
      setDropTargetSegId(seg?.id ?? null);
    },
    [],
  );

  const handleDrop = useCallback((e: React.DragEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const dc = draggingCoeffRef.current;
    const fromPalette = draggingCrossingFromPaletteRef.current;
    if (!dc && !fromPalette) {
      setDropTargetSegId(null);
      return;
    }
    const map = mapRef.current;
    if (!map) {
      setDropTargetSegId(null);
      return;
    }
    const rect = canvasRef.current!.getBoundingClientRect();
    const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const { segments: segs, nodes: ns, roadScale: rs } = stateRef.current;
    const scale = getScale(map.getZoom(), rs);
    const screenNodes = ns.map((n) => toScreen(map, n));
    const screenMap = new Map(screenNodes.map((n) => [n.id, n]));

    if (fromPalette) {
      const snap = nearestSegmentWithT(screenMap, segs, pos, 30, scale);
      if (snap) {
        const safeT = Math.max(0.05, Math.min(0.95, snap.t));
        setSegments((p) =>
          p.map((s) => {
            if (s.id !== snap.seg.id) return s;
            return {
              ...s,
              pedestrianCrossings: [
                ...(s.pedestrianCrossings ?? []),
                { id: uid(), t: safeT },
              ],
            };
          }),
        );
      }
      setDraggingCrossingFromPalette(false);
      draggingCrossingFromPaletteRef.current = false;
    } else if (dc) {
      const seg = nearestSegment(screenMap, segs, pos, 30, scale);
      if (seg) {
        const cfg = COEFF[dc];
        setSegments((p) =>
          p.map((s) => {
            if (s.id !== seg.id) return s;
            if ((s.coefficients ?? []).some((c) => c.type === dc)) return s;
            return {
              ...s,
              coefficients: [
                ...(s.coefficients ?? []),
                { id: uid(), type: dc, value: cfg.default },
              ],
            };
          }),
        );
      }
      draggingCoeffRef.current = null;
      setDraggingCoeff(null);
    }
    setDropTargetSegId(null);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDropTargetSegId(null);
  }, []);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setBuildFrom(null);
        setSelectedId(null);
        setEditPanel(null);
      }
      if (e.ctrlKey || e.metaKey) return;
      if (e.key === "r") {
        setTool("road");
        setBuildFrom(null);
      }
      if (e.key === "s") {
        setTool("select");
        setBuildFrom(null);
      }
      if (e.key === "d") {
        setTool("delete");
        setBuildFrom(null);
      }
      if (e.key === "x") {
        setTool("crossing");
        setBuildFrom(null);
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        const { selectedId: sid, nodes: ns } = stateRef.current;
        if (!sid) return;
        e.preventDefault();
        if (ns.some((n) => n.id === sid)) {
          setNodes((p) => p.filter((n) => n.id !== sid));
          setSegments((p) =>
            p.filter((s) => s.fromId !== sid && s.toId !== sid),
          );
        } else {
          setSegments((p) => p.filter((s) => s.id !== sid));
        }
        setSelectedId(null);
        setEditPanel(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Derived ──
  const selNode = nodes.find((n) => n.id === selectedId);
  const selSeg = segments.find((s) => s.id === selectedId);
  const selNodeSegs = selNode ? nodeSegments(segments, selNode.id) : [];
  const isIntersection = selNodeSegs.length >= 3;
  const intersectionCount = nodes.filter(
    (n) => nodeSegments(segments, n.id).length >= 3,
  ).length;
  const editSeg = editPanel
    ? (segments.find((s) => s.id === editPanel.segId) ?? null)
    : null;
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
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#0d0d1a",
        overflow: "hidden",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* ── Toolbar ── */}
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
            max={2}
            step={0.05}
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
          onClick={() => {
            setNodes([]);
            setSegments([]);
            setSelectedId(null);
            setBuildFrom(null);
            setEditPanel(null);
          }}
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
            {nodes.length} nodes · {segments.length} roads
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

      {/* ── Map + Canvas ── */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <div
          ref={mapContainerRef}
          style={{ position: "absolute", inset: 0, zIndex: 0 }}
        />
        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            zIndex: 1,
            cursor: draggingCrossing
              ? "grabbing"
              : hoveredCrossingId && (tool === "select" || tool === "crossing")
                ? "grab"
                : tool === "select"
                  ? "default"
                  : "crosshair",
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => {
            if (!panRef.current.active) {
              setMouse(null);
              setHoveredNodeId(null);
              setHoveredSegId(null);
              setHoveredHandle(null);
              setHoveredCrossingId(null);
            }
          }}
          onClick={handleClick}
          onContextMenu={handleContextMenu}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onDragLeave={handleDragLeave}
        />

        {/* Obstacle palette */}
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            zIndex: 10,
            background: "#111128",
            border: "1px solid #1e1e3e",
            borderRadius: 8,
            width: 190,
            boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
            userSelect: "none",
            overflow: "hidden",
          }}
        >
          <div
            onClick={() => setPaletteOpen((p) => !p)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 12px",
              cursor: "pointer",
              borderBottom: paletteOpen ? "1px solid #1e1e40" : "none",
              background: "#12122a",
            }}
          >
            <span style={{ fontWeight: 700, color: "#eef", fontSize: 13 }}>
              Obstacles
            </span>
            <span style={{ color: "#556", fontSize: 11 }}>
              {paletteOpen ? "▲" : "▼"}
            </span>
          </div>
          {paletteOpen && (
            <div style={{ padding: "6px 8px" }}>
              {/* Pedestrian crossing (zebra) - drop at position */}
              <div
                draggable
                onDragStart={(e) => {
                  draggingCrossingFromPaletteRef.current = true;
                  setDraggingCrossingFromPalette(true);
                  e.dataTransfer.effectAllowed = "copy";
                  e.dataTransfer.setData(
                    "application/x-pedestrian-crossing",
                    "1",
                  );
                }}
                onDragEnd={() => {
                  draggingCrossingFromPaletteRef.current = false;
                  setDraggingCrossingFromPalette(false);
                  setDropTargetSegId(null);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "5px 8px",
                  marginBottom: 6,
                  borderRadius: 5,
                  cursor: "grab",
                  background: draggingCrossingFromPalette
                    ? "#1a2a4a"
                    : "transparent",
                  border: draggingCrossingFromPalette
                    ? "1px solid #2a4a80"
                    : "1px solid transparent",
                  borderBottom: draggingCrossingFromPalette
                    ? "none"
                    : "1px solid #1a1a30",
                  transition: "background 0.15s",
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 4,
                    background: "#e0c030",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 12,
                    flexShrink: 0,
                  }}
                >
                  ⇔
                </div>
                <span
                  style={{ color: "#e0c030", fontSize: 12, fontWeight: 600 }}
                >
                  Crosswalk
                </span>
              </div>
              {COEFF_TYPES.map((type) => {
                const cfg = COEFF[type];
                const active = draggingCoeff === type;
                return (
                  <div
                    key={type}
                    draggable
                    onDragStart={(e) => {
                      draggingCoeffRef.current = type;
                      setDraggingCoeff(type);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    onDragEnd={() => {
                      draggingCoeffRef.current = null;
                      setDraggingCoeff(null);
                      setDropTargetSegId(null);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "5px 8px",
                      marginBottom: 2,
                      borderRadius: 5,
                      cursor: "grab",
                      background: active ? "#1a2a4a" : "transparent",
                      border: active
                        ? "1px solid #2a4a80"
                        : "1px solid transparent",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      if (!active) e.currentTarget.style.background = "#0d0d22";
                    }}
                    onMouseLeave={(e) => {
                      if (!active)
                        e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        background: cfg.color,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                        fontWeight: 700,
                        fontSize: 11,
                        flexShrink: 0,
                      }}
                    >
                      {cfg.symbol}
                    </div>
                    <span style={{ color: "#99a", fontSize: 12 }}>
                      {cfg.label}
                    </span>
                  </div>
                );
              })}
              <div
                style={{
                  color: "#334",
                  fontSize: 10,
                  textAlign: "center",
                  marginTop: 6,
                  paddingTop: 6,
                  borderTop: "1px solid #1a1a30",
                }}
              >
                Drag onto a road segment
              </div>
            </div>
          )}
        </div>

        {/* Road edit panel */}
        {editSeg && editPanel && (
          <RoadEditPanel
            seg={editSeg}
            panelX={editPanel.x}
            panelY={editPanel.y}
            onChange={handleSegmentChange}
            onClose={() => setEditPanel(null)}
          />
        )}

        {/* Selection info panel */}
        {!editPanel && (selNode || selSeg) && (
          <div
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              zIndex: 10,
              background: "#111128",
              border: "1px solid #1e1e3e",
              borderRadius: 8,
              padding: "12px 16px",
              minWidth: 210,
              color: "#aab",
              fontSize: 13,
              boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
            }}
          >
            {selNode && (
              <>
                <div
                  style={{
                    fontWeight: 700,
                    color: "#eef",
                    marginBottom: 8,
                    fontSize: 14,
                  }}
                >
                  {isIntersection
                    ? "✕ Intersection"
                    : selNodeSegs.length === 0
                      ? "○ Isolated"
                      : selNodeSegs.length === 1
                        ? "● Road End"
                        : "↩ Waypoint"}
                </div>
                <div style={{ color: "#556" }}>
                  Connections:{" "}
                  <span style={{ color: "#99a" }}>{selNodeSegs.length}</span>
                </div>
                <div style={{ color: "#556", marginBottom: 10 }}>
                  At:{" "}
                  <span style={{ color: "#778" }}>
                    {selNode.lat.toFixed(5)}, {selNode.lng.toFixed(5)}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setTool("road");
                    setBuildFrom(selNode);
                  }}
                  style={{
                    ...chip(false),
                    width: "100%",
                    padding: "6px",
                    textAlign: "center",
                    color: "#80c0ff",
                    borderColor: "#2a4a80",
                  }}
                >
                  + Add connection
                </button>
              </>
            )}
            {selSeg && (
              <>
                <div
                  style={{
                    fontWeight: 700,
                    color: "#eef",
                    marginBottom: 8,
                    fontSize: 14,
                  }}
                >
                  Road Segment
                </div>
                <div style={{ color: "#778", marginBottom: 3 }}>
                  {selSeg.lanesBackward > 0
                    ? `${selSeg.lanesForward} ↔ ${selSeg.lanesBackward} lanes`
                    : `${selSeg.lanesForward} lane${selSeg.lanesForward > 1 ? "s" : ""} → one-way`}
                </div>
                <div style={{ color: "#778", marginBottom: 3 }}>
                  {selSeg.speedLimit} km/h
                </div>
                <div style={{ color: "#778", marginBottom: 3 }}>
                  {SURFACE[selSeg.surface].label}
                </div>
                <div style={{ color: "#778" }}>
                  Size: {(selSeg.displayScale ?? 1).toFixed(2)}×
                </div>
                {selSeg.coefficients && selSeg.coefficients.length > 0 && (
                  <div
                    style={{
                      marginTop: 6,
                      paddingTop: 6,
                      borderTop: "1px solid #1e1e3a",
                    }}
                  >
                    <div
                      style={{ color: "#556", fontSize: 11, marginBottom: 4 }}
                    >
                      Coefficients:
                    </div>
                    {selSeg.coefficients.map((c) => {
                      const cfg = COEFF[c.type];
                      const isBinary =
                        cfg.max === 1 && cfg.min === 0 && cfg.step === 1;
                      return (
                        <div
                          key={c.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            marginBottom: 2,
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: cfg.color,
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ color: "#778", fontSize: 12 }}>
                            {cfg.label}
                            {!isBinary && cfg.unit
                              ? `: ${c.value} ${cfg.unit}`
                              : ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div style={{ color: "#445", fontSize: 11, marginTop: 8 }}>
                  Right-click to edit
                </div>
              </>
            )}
            <div
              style={{
                color: "#334",
                fontSize: 11,
                marginTop: 8,
                paddingTop: 8,
                borderTop: "1px solid #1e1e3a",
              }}
            >
              Del / Backspace to remove
            </div>
          </div>
        )}

        {/* Legend */}
        <div
          style={{
            position: "absolute",
            bottom: 12,
            left: 12,
            zIndex: 10,
            color: "#556",
            fontSize: 11,
            lineHeight: 1.9,
            userSelect: "none",
            background: "rgba(13,13,26,0.7)",
            borderRadius: 6,
            padding: "4px 10px",
          }}
        >
          <div>R = Road · S = Select · D = Delete · Esc = Cancel</div>
          <div>Scroll = Zoom · Shift+drag / Middle-drag = Pan</div>
          <div>
            Road size = global slider · Right-click road for per-segment size
          </div>
          <div>
            Right-click a road to edit · Hover a node to add connections
          </div>
        </div>
      </div>
    </div>
  );
}
