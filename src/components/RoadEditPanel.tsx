import { useCallback } from "react";
import type { RoadSegment, CoefficientType, RoadFeatureSide } from "../types";
import {
  COEFF,
  COEFF_TYPES,
  SURFACE,
  SURFACE_KEYS,
  SPEED_PRESETS,
  PARKING_DEFAULT_LENGTH_T,
  PARKING_MIN_LENGTH_T,
  PARKING_MAX_LENGTH_T,
  CROSSING_DEFAULT_WIDTH,
  CROSSING_MIN_WIDTH,
  CROSSING_MAX_WIDTH,
  DEFAULT_TRAFFIC_INTENSITY,
} from "../constants";
import { uid } from "../utils/coordinates";
import { chip } from "../utils/styles";
import {
  computeCapacity,
  computeServiceLevel,
  getServiceLevelRating,
} from "../utils/capacity";
import { CollapsibleSection } from "./CollapsibleSection";
import { LaneCounter } from "./LaneCounter";

export function RoadEditPanel({
  seg,
  panelX,
  panelY,
  segmentT,
  onChange,
  onClose,
  onPanelMove,
  onAddNode,
}: {
  seg: RoadSegment;
  panelX: number;
  panelY: number;
  segmentT?: number;
  onChange: (s: RoadSegment) => void;
  onClose: () => void;
  onPanelMove?: (x: number, y: number) => void;
  onAddNode?: (segId: string, t: number) => void;
}) {
  const handleHeaderMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0 || !onPanelMove) return;
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const startPanelX = panelX;
      const startPanelY = panelY;
      const onMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        onPanelMove(startPanelX + dx, startPanelY + dy);
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [onPanelMove, panelX, panelY],
  );
  const PW = 272;
  const left = Math.min(panelX + 8, window.innerWidth - PW - 12);
  const top = Math.min(panelY - 10, window.innerHeight - 510);
  const oneWay = seg.lanesBackward === 0;

  const P = computeCapacity(seg);
  const Z =
    seg.trafficIntensity != null && seg.trafficIntensity >= 0
      ? computeServiceLevel(seg.trafficIntensity, P)
      : null;
  const rating = Z != null ? getServiceLevelRating(Z) : null;

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
        background: "var(--panel-bg)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "14px 16px",
        color: "var(--text-body)",
        fontSize: 13,
        boxShadow: "0 8px 40px rgba(0,0,0,0.15)",
        userSelect: "none",
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        onMouseDown={(e) => {
          if ((e.target as HTMLElement).closest?.("button")) return;
          handleHeaderMouseDown(e);
        }}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
          borderBottom: "1px solid var(--border-muted)",
          paddingBottom: 10,
          cursor: onPanelMove ? "grab" : undefined,
        }}
      >
        <span style={{ fontWeight: 700, color: "var(--text-secondary)", fontSize: 14 }}>
          Свойства дороги
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {rating ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: 22,
                height: 22,
                padding: "0 5px",
                borderRadius: 4,
                background: `${rating.color}33`,
                color: rating.color,
                fontSize: 12,
                fontWeight: 800,
              }}
              title={`Z = ${Z?.toFixed(3) ?? ""}`}
            >
              {rating.letter}
            </span>
          ) : (
            <span
              style={{
                color: "var(--text-faint)",
                fontSize: 11,
              }}
              title="Задайте интенсивность трафика"
            >
              —
            </span>
          )}
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-faint)",
              cursor: "pointer",
              fontSize: 20,
              lineHeight: 1,
              padding: 0,
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {segmentT != null && onAddNode && (
        <div style={{ marginBottom: 14 }}>
          <button
            onClick={() => {
              const safeT = Math.max(0.05, Math.min(0.95, segmentT));
              onAddNode(seg.id, safeT);
            }}
            style={{
              width: "100%",
              padding: "8px 12px",
              background: "var(--chip-active-bg)",
              border: "1px solid var(--accent-muted)",
              borderRadius: 6,
              color: "var(--accent)",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            ⊕ Добавить узел ({(segmentT * 100).toFixed(0)}%)
          </button>
        </div>
      )}

      <CollapsibleSection label="Ограничение скорости (км/ч)">
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
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
      </CollapsibleSection>

      <CollapsibleSection label="Тип покрытия">
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
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
      </CollapsibleSection>

      <CollapsibleSection label="Направление движения">
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={() => onChange({ ...seg, lanesBackward: 0 })}
            style={chip(oneWay)}
          >
            → Одностороннее
          </button>
          <button
            onClick={() =>
              onChange({
                ...seg,
                lanesBackward: Math.max(1, seg.lanesBackward),
              })
            }
            style={chip(!oneWay)}
          >
            ↔ Двустороннее
          </button>
        </div>
      </CollapsibleSection>

      <CollapsibleSection label="Полосы">
        <LaneCounter
          label={oneWay ? "Количество полос" : "Полосы → (вперёд)"}
          value={seg.lanesForward}
          onChange={(v) => onChange({ ...seg, lanesForward: v })}
        />
        {!oneWay && (
          <LaneCounter
            label="Полосы ← (назад)"
            value={seg.lanesBackward}
            onChange={(v) => onChange({ ...seg, lanesBackward: v })}
          />
        )}
      </CollapsibleSection>

      <CollapsibleSection label="Размер участка">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
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
            style={{ flex: 1, accentColor: "var(--accent-muted)" }}
          />
          <span style={{ color: "var(--accent)", fontWeight: 700, minWidth: 36 }}>
            {(seg.displayScale ?? 1).toFixed(2)}×
          </span>
        </div>
      </CollapsibleSection>

      <CollapsibleSection label="Коэффициенты">
        <div>
          {(seg.pedestrianCrossings ?? []).map((c) => (
            <div
              key={c.id}
              style={{
                marginBottom: 4,
                padding: "4px 6px",
                background: "var(--chip-inactive-bg)",
                borderRadius: 4,
                border: "1px solid var(--border-alt)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: "#e0c030", fontSize: 12 }}>⇔</span>
                <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
                  {(c.t * 100).toFixed(0)}% вдоль дороги
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
                    color: "var(--clear-btn-color)",
                    cursor: "pointer",
                    fontSize: 14,
                    padding: "0 4px",
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 4,
                }}
              >
                <span style={{ color: "var(--text-dim)", fontSize: 10 }}>Ширина:</span>
                <input
                  type="range"
                  min={CROSSING_MIN_WIDTH}
                  max={CROSSING_MAX_WIDTH}
                  step={0.05}
                  value={c.width ?? CROSSING_DEFAULT_WIDTH}
                  onChange={(e) => {
                    const width = parseFloat(e.target.value);
                    onChange({
                      ...seg,
                      pedestrianCrossings: (seg.pedestrianCrossings ?? []).map(
                        (cc) => (cc.id === c.id ? { ...cc, width } : cc),
                      ),
                    });
                  }}
                  style={{ flex: 1, accentColor: "#e0c030" }}
                />
                <span style={{ color: "#e0c030", fontSize: 10, minWidth: 35 }}>
                  {((c.width ?? CROSSING_DEFAULT_WIDTH) * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          ))}
          <button
            onClick={() =>
              onChange({
                ...seg,
                pedestrianCrossings: [
                  ...(seg.pedestrianCrossings ?? []),
                  { id: uid(), t: 0.5, width: CROSSING_DEFAULT_WIDTH },
                ],
              })
            }
            style={{
              width: "100%",
              background: "var(--chip-inactive-bg)",
              border: "1px dashed var(--border)",
              borderRadius: 4,
              color: "var(--text-dim)",
              padding: "6px 8px",
              fontSize: 11,
              cursor: "pointer",
              marginTop: 4,
            }}
          >
            + Добавить переход в центре
          </button>
          <div
            style={{
              marginTop: 10,
              borderTop: "1px solid var(--border-alt)",
              paddingTop: 10,
            }}
          />
          {(seg.busStops ?? []).map((bs) => (
            <div
              key={bs.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 4,
                padding: "4px 6px",
                background: "var(--chip-inactive-bg)",
                borderRadius: 4,
                border: "1px solid var(--border-alt)",
              }}
            >
              <span style={{ color: "#40a060", fontSize: 12, fontWeight: 700 }}>
                B
              </span>
              <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
                {(bs.t * 100).toFixed(0)}%
              </span>
              <select
                value={bs.side}
                onChange={(e) => {
                  const side = e.target.value as RoadFeatureSide;
                  onChange({
                    ...seg,
                    busStops: (seg.busStops ?? []).map((b) =>
                      b.id === bs.id ? { ...b, side } : b,
                    ),
                  });
                }}
                style={{
                  background: "var(--chip-inactive-bg)",
                  border: "1px solid var(--border)",
                  borderRadius: 3,
                  color: "var(--accent)",
                  padding: "1px 4px",
                  fontSize: 11,
                }}
              >
                <option value="left">Слева</option>
                <option value="right">Справа</option>
              </select>
              <button
                onClick={() =>
                  onChange({
                    ...seg,
                    busStops: (seg.busStops ?? []).filter(
                      (b) => b.id !== bs.id,
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
                busStops: [
                  ...(seg.busStops ?? []),
                  { id: uid(), t: 0.5, side: "right" },
                ],
              })
            }
            style={{
              width: "100%",
              background: "var(--chip-inactive-bg)",
              border: "1px dashed var(--border)",
              borderRadius: 4,
              color: "var(--text-dim)",
              padding: "6px 8px",
              fontSize: 11,
              cursor: "pointer",
              marginTop: 4,
            }}
          >
            + Добавить остановку в центре
          </button>
          <div
            style={{
              marginTop: 10,
              borderTop: "1px solid var(--border-alt)",
              paddingTop: 10,
            }}
          />
          {(seg.parkingSpaces ?? []).map((ps) => (
            <div
              key={ps.id}
              style={{
                marginBottom: 4,
                padding: "4px 6px",
                background: "var(--chip-inactive-bg)",
                borderRadius: 4,
                border: "1px solid var(--border-alt)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{ color: "#40a0c0", fontSize: 12, fontWeight: 700 }}
                >
                  P
                </span>
                <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
                  {(ps.t * 100).toFixed(0)}%
                </span>
                <select
                  value={ps.side}
                  onChange={(e) => {
                    const side = e.target.value as RoadFeatureSide;
                    onChange({
                      ...seg,
                      parkingSpaces: (seg.parkingSpaces ?? []).map((p) =>
                        p.id === ps.id ? { ...p, side } : p,
                      ),
                    });
                  }}
                  style={{
                    background: "var(--chip-inactive-bg)",
                    border: "1px solid var(--border)",
                    borderRadius: 3,
                    color: "var(--accent)",
                    padding: "1px 4px",
                    fontSize: 11,
                  }}
                >
                <option value="left">Слева</option>
                <option value="right">Справа</option>
              </select>
              <button
                onClick={() =>
                  onChange({
                    ...seg,
                    parkingSpaces: (seg.parkingSpaces ?? []).filter(
                        (p) => p.id !== ps.id,
                      ),
                    })
                  }
                  style={{
                    marginLeft: "auto",
                    background: "none",
                    border: "none",
                    color: "var(--clear-btn-color)",
                    cursor: "pointer",
                    fontSize: 14,
                    padding: "0 4px",
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 4,
                }}
              >
                <span style={{ color: "var(--text-dim)", fontSize: 10 }}>Длина:</span>
                <input
                  type="range"
                  min={PARKING_MIN_LENGTH_T}
                  max={PARKING_MAX_LENGTH_T}
                  step={0.01}
                  value={ps.length}
                  onChange={(e) => {
                    const length = parseFloat(e.target.value);
                    onChange({
                      ...seg,
                      parkingSpaces: (seg.parkingSpaces ?? []).map((p) =>
                        p.id === ps.id ? { ...p, length } : p,
                      ),
                    });
                  }}
                  style={{ flex: 1, accentColor: "#40a0c0" }}
                />
                <span style={{ color: "#40a0c0", fontSize: 10, minWidth: 30 }}>
                  {(ps.length * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          ))}
          <button
            onClick={() =>
              onChange({
                ...seg,
                parkingSpaces: [
                  ...(seg.parkingSpaces ?? []),
                  {
                    id: uid(),
                    t: 0.5,
                    side: "right",
                    length: PARKING_DEFAULT_LENGTH_T,
                  },
                ],
              })
            }
            style={{
              width: "100%",
              background: "var(--chip-inactive-bg)",
              border: "1px dashed var(--border)",
              borderRadius: 4,
              color: "var(--text-dim)",
              padding: "6px 8px",
              fontSize: 11,
              cursor: "pointer",
              marginTop: 4,
            }}
          >
            + Добавить парковку в центре
          </button>
          <div
            style={{
              marginTop: 10,
              borderTop: "1px solid var(--border-alt)",
              paddingTop: 10,
            }}
          />
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
                  background: "var(--chip-inactive-bg)",
                  borderRadius: 5,
                  border: "1px solid var(--border-alt)",
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
                    color: "var(--text-muted)",
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
                        color: "var(--accent)",
                        padding: "2px 4px",
                        fontSize: 12,
                        textAlign: "right",
                      }}
                    />
                    {cfg.unit && (
                      <span
                        style={{ color: "var(--text-faint)", fontSize: 11, minWidth: 20 }}
                      >
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
                    color: "var(--clear-btn-color)",
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
                background: "var(--chip-inactive-bg)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                color: "#80c0ff",
                padding: "5px 8px",
                fontSize: 12,
                cursor: "pointer",
                marginTop: 4,
              }}
            >
              <option value="">+ Добавить коэффициент...</option>
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
      </CollapsibleSection>

      <CollapsibleSection label="Уровень обслуживания от загрузки">
        <div
          style={{
            padding: "10px 12px",
            background: "var(--chip-inactive-bg)",
            borderRadius: 6,
            border: "1px solid var(--border-alt)",
          }}
        >
          <div style={{ marginBottom: 8 }}>
            <span style={{ color: "#99a", fontSize: 11 }}>
              Интенсивность трафика N (авт/ч)
            </span>
            <input
              type="number"
              min={0}
              step={50}
              placeholder={String(DEFAULT_TRAFFIC_INTENSITY)}
              value={seg.trafficIntensity ?? ""}
              onChange={(e) => {
                const v =
                  e.target.value === ""
                    ? undefined
                    : parseFloat(e.target.value);
                onChange({
                  ...seg,
                  trafficIntensity:
                    v !== undefined && !isNaN(v) ? Math.max(0, v) : undefined,
                });
              }}
              style={{
                width: "100%",
                marginTop: 4,
                background: "var(--chip-inactive-bg)",
                border: "1px solid var(--border)",
                borderRadius: 3,
                color: "#80c0ff",
                padding: "6px 8px",
                fontSize: 12,
              }}
            />
          </div>
          <div style={{ color: "var(--text-muted)", fontSize: 11, marginBottom: 2 }}>
            Пропускная способность P = {computeCapacity(seg).toLocaleString()} авт/ч
          </div>
          <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 6 }}>
            (зависит от полос, скорости, покрытия, препятствий, переходов)
          </div>
          {seg.trafficIntensity != null &&
            seg.trafficIntensity >= 0 &&
            (() => {
              const P = computeCapacity(seg);
              const Z = computeServiceLevel(seg.trafficIntensity, P);
              const rating = Z != null ? getServiceLevelRating(Z) : null;
              return (
                <div
                  style={{
                    paddingTop: 8,
                    borderTop: "1px solid var(--border-alt)",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span style={{ color: "var(--text-secondary)" }}>
                    Z = N/P = {Z?.toFixed(3) ?? "—"}
                  </span>
                  {rating && (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minWidth: 24,
                        height: 24,
                        padding: "0 6px",
                        borderRadius: 4,
                        background: `${rating.color}33`,
                        color: rating.color,
                        fontSize: 14,
                        fontWeight: 800,
                      }}
                    >
                      {rating.letter}
                    </span>
                  )}
                </div>
              );
            })()}
        </div>
      </CollapsibleSection>
    </div>
  );
}
