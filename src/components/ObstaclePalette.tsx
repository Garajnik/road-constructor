import type { CoefficientType } from "../types";
import { COEFF, COEFF_TYPES } from "../constants";

interface ObstaclePaletteProps {
  paletteOpen: boolean;
  setPaletteOpen: (v: boolean) => void;
  draggingCoeff: CoefficientType | null;
  setDraggingCoeff: (v: CoefficientType | null) => void;
  draggingCoeffRef: React.RefObject<CoefficientType | null>;
  draggingCrossingFromPalette: boolean;
  setDraggingCrossingFromPalette: (v: boolean) => void;
  draggingCrossingFromPaletteRef: React.RefObject<boolean>;
  draggingBusStopFromPalette: boolean;
  setDraggingBusStopFromPalette: (v: boolean) => void;
  draggingBusStopFromPaletteRef: React.RefObject<boolean>;
  draggingParkingFromPalette: boolean;
  setDraggingParkingFromPalette: (v: boolean) => void;
  draggingParkingFromPaletteRef: React.RefObject<boolean>;
  setDropTargetSegId: (v: string | null) => void;
}

export function ObstaclePalette({
  paletteOpen,
  setPaletteOpen,
  draggingCoeff,
  setDraggingCoeff,
  draggingCoeffRef,
  draggingCrossingFromPalette,
  setDraggingCrossingFromPalette,
  draggingCrossingFromPaletteRef,
  draggingBusStopFromPalette,
  setDraggingBusStopFromPalette,
  draggingBusStopFromPaletteRef,
  draggingParkingFromPalette,
  setDraggingParkingFromPalette,
  draggingParkingFromPaletteRef,
  setDropTargetSegId,
}: ObstaclePaletteProps) {
  return (
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
        onClick={() => setPaletteOpen(!paletteOpen)}
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
          <div
            draggable
            onDragStart={(e) => {
              draggingBusStopFromPaletteRef.current = true;
              setDraggingBusStopFromPalette(true);
              e.dataTransfer.effectAllowed = "copy";
              e.dataTransfer.setData("application/x-bus-stop", "1");
            }}
            onDragEnd={() => {
              draggingBusStopFromPaletteRef.current = false;
              setDraggingBusStopFromPalette(false);
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
              background: draggingBusStopFromPalette ? "#1a2a4a" : "transparent",
              border: draggingBusStopFromPalette
                ? "1px solid #2a4a80"
                : "1px solid transparent",
              borderBottom: draggingBusStopFromPalette
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
                background: "#40a060",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 700,
                fontSize: 12,
                flexShrink: 0,
              }}
            >
              B
            </div>
            <span style={{ color: "#40a060", fontSize: 12, fontWeight: 600 }}>
              Bus Stop
            </span>
          </div>
          <div
            draggable
            onDragStart={(e) => {
              draggingParkingFromPaletteRef.current = true;
              setDraggingParkingFromPalette(true);
              e.dataTransfer.effectAllowed = "copy";
              e.dataTransfer.setData("application/x-parking", "1");
            }}
            onDragEnd={() => {
              draggingParkingFromPaletteRef.current = false;
              setDraggingParkingFromPalette(false);
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
              background: draggingParkingFromPalette ? "#1a2a4a" : "transparent",
              border: draggingParkingFromPalette
                ? "1px solid #2a4a80"
                : "1px solid transparent",
              borderBottom: draggingParkingFromPalette
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
                background: "#40a0c0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 700,
                fontSize: 12,
                flexShrink: 0,
              }}
            >
              P
            </div>
            <span style={{ color: "#40a0c0", fontSize: 12, fontWeight: 600 }}>
              Parking
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
  );
}
