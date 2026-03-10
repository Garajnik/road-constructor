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
            onClick={() => onStartBuild(selNode)}
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
  );
}
