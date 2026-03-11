import type { RoadNode, RoadSegment } from "../types";
import { COEFF, SURFACE } from "../constants";
import { chip } from "../utils/styles";
import { nodeSegments } from "../utils/geometry";

interface SelectionInfoPanelProps {
  selNode: RoadNode | undefined;
  selSeg: RoadSegment | undefined;
  segments: RoadSegment[];
  onStartBuild: (node: RoadNode) => void;
}

export function SelectionInfoPanel({
  selNode,
  selSeg,
  segments,
  onStartBuild,
}: SelectionInfoPanelProps) {
  const selNodeSegs = selNode ? nodeSegments(segments, selNode.id) : [];
  const isIntersection = selNodeSegs.length >= 3;

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        zIndex: 10,
        background: "var(--panel-bg)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "12px 16px",
        minWidth: 210,
        color: "var(--text-body)",
        fontSize: 13,
        boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
      }}
    >
      {selNode && (
        <>
          <div
            style={{
              fontWeight: 700,
              color: "var(--text-secondary)",
              marginBottom: 8,
              fontSize: 14,
            }}
          >
            {isIntersection
              ? "✕ Перекрёсток"
              : selNodeSegs.length === 0
                ? "○ Изолированный"
                : selNodeSegs.length === 1
                  ? "● Конец дороги"
                  : "↩ Промежуточный узел"}
          </div>
          <div style={{ color: "var(--text-faint)" }}>
            Соединений:{" "}
            <span style={{ color: "var(--text-muted)" }}>{selNodeSegs.length}</span>
          </div>
          <div style={{ color: "var(--text-faint)", marginBottom: 10 }}>
            Координаты:{" "}
            <span style={{ color: "var(--text-dim)" }}>
              {selNode.lat.toFixed(5)}, {selNode.lng.toFixed(5)}
            </span>
          </div>
          <button
            onClick={() => onStartBuild(selNode)}
            style={{
              ...chip(false),
              width: "100%",
              padding: "6px",
              textAlign: "center",
              color: "var(--accent)",
              borderColor: "var(--accent-muted)",
            }}
          >
            + Добавить соединение
          </button>
        </>
      )}
      {selSeg && (
        <>
          <div
            style={{
              fontWeight: 700,
              color: "var(--text-secondary)",
              marginBottom: 8,
              fontSize: 14,
            }}
          >
            Участок дороги
          </div>
          <div style={{ color: "var(--text-dim)", marginBottom: 3 }}>
            {selSeg.lanesBackward > 0
              ? `${selSeg.lanesForward} ↔ ${selSeg.lanesBackward} полос`
              : `${selSeg.lanesForward} полос → одностороннее`}
          </div>
          <div style={{ color: "var(--text-dim)", marginBottom: 3 }}>
            {selSeg.speedLimit} km/h
          </div>
          <div style={{ color: "var(--text-dim)", marginBottom: 3 }}>
            {SURFACE[selSeg.surface].label}
          </div>
          <div style={{ color: "var(--text-dim)" }}>
            Размер: {(selSeg.displayScale ?? 1).toFixed(2)}×
          </div>
          {selSeg.coefficients && selSeg.coefficients.length > 0 && (
            <div
              style={{
                marginTop: 6,
                paddingTop: 6,
                borderTop: "1px solid var(--border-alt)",
              }}
            >
                <div
                style={{ color: "var(--text-faint)", fontSize: 11, marginBottom: 4 }}
              >
                Коэффициенты:
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
                    <span style={{ color: "var(--text-dim)", fontSize: 12 }}>
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
          <div style={{ color: "var(--text-subtle)", fontSize: 11, marginTop: 8 }}>
            ПКМ для редактирования
          </div>
        </>
      )}
      <div
        style={{
          color: "var(--text-hint)",
          fontSize: 11,
          marginTop: 8,
          paddingTop: 8,
          borderTop: "1px solid var(--border-alt)",
        }}
      >
        Del / Backspace для удаления
      </div>
    </div>
  );
}
