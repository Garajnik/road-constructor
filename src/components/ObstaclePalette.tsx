import type { CoefficientType } from "../types";
import { COEFF, COEFF_TYPES } from "../constants";
import slopeSvgUrl from "../assets/slope.svg?url";
import crosswalkSvgUrl from "../assets/Crosswalk.svg?url";
import busStopSvgUrl from "../assets/BusStop.svg?url";
import parkingSvgUrl from "../assets/Parking.svg?url";
import speedLimitSvgUrl from "../assets/SpeedLimit.svg?url";
import roadConditionSvgUrl from "../assets/RoadCondition.svg?url";

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
        background: "var(--panel-bg)",
        border: "1px solid var(--border)",
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
          borderBottom: paletteOpen ? "1px solid var(--border-muted)" : "none",
          background: "var(--panel-bg-alt)",
        }}
      >
        <span style={{ fontWeight: 700, color: "var(--text-secondary)", fontSize: 13 }}>
          Объекты
        </span>
        <span style={{ color: "var(--text-faint)", fontSize: 11 }}>
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
                ? "var(--chip-active-bg)"
                : "transparent",
              border: draggingCrossingFromPalette
                ? "1px solid var(--accent-muted)"
                : "1px solid transparent",
              borderBottom: draggingCrossingFromPalette
                ? "none"
                : "1px solid var(--border-alt)",
              transition: "background 0.15s",
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                overflow: "hidden",
              }}
            >
              <img
                src={crosswalkSvgUrl}
                alt="crosswalk"
                style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
              />
            </div>
            <span
              style={{ color: "#e0c030", fontSize: 12, fontWeight: 600 }}
            >
              Пешеходный переход
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
              background: draggingBusStopFromPalette ? "var(--chip-active-bg)" : "transparent",
              border: draggingBusStopFromPalette
                ? "1px solid var(--accent-muted)"
                : "1px solid transparent",
              borderBottom: draggingBusStopFromPalette
                ? "none"
                : "1px solid var(--border-alt)",
              transition: "background 0.15s",
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                overflow: "hidden",
              }}
            >
              <img
                src={busStopSvgUrl}
                alt="bus stop"
                style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
              />
            </div>
            <span style={{ color: "#40a060", fontSize: 12, fontWeight: 600 }}>
              Остановка
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
              background: draggingParkingFromPalette ? "var(--chip-active-bg)" : "transparent",
              border: draggingParkingFromPalette
                ? "1px solid var(--accent-muted)"
                : "1px solid transparent",
              borderBottom: draggingParkingFromPalette
                ? "none"
                : "1px solid var(--border-alt)",
              transition: "background 0.15s",
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                overflow: "hidden",
              }}
            >
              <img
                src={parkingSvgUrl}
                alt="parking"
                style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
              />
            </div>
            <span style={{ color: "#40a0c0", fontSize: 12, fontWeight: 600 }}>
              Парковка
            </span>
          </div>
          {COEFF_TYPES.filter(
            (type) =>
              ![
                "turning_radius",
                "maneuver",
                "lane_width",
                "pedestrian_crossing",
                "parking",
                "bus_stop",
              ].includes(type)
          ).map((type) => {
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
                  background: active ? "var(--chip-active-bg)" : "transparent",
                  border: active
                    ? "1px solid var(--accent-muted)"
                    : "1px solid transparent",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = "var(--chip-inactive-bg)";
                }}
                onMouseLeave={(e) => {
                  if (!active)
                    e.currentTarget.style.background = "transparent";
                }}
              >
                {type === "road_slope" ? (
                  <div
                    style={{
                      width: 44,
                      height: 14,
                      borderRadius: 3,
                      overflow: "hidden",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <img
                      src={slopeSvgUrl}
                      alt="slope"
                      style={{ width: "100%", height: "100%", objectFit: "fill", display: "block" }}
                    />
                  </div>
                ) : type === "speed_limit" ? (
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 4,
                      overflow: "hidden",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <img
                      src={speedLimitSvgUrl}
                      alt="speed limit"
                      style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                    />
                  </div>
                ) : type === "road_condition" ? (
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 4,
                      overflow: "hidden",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <img
                      src={roadConditionSvgUrl}
                      alt="road condition"
                      style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                    />
                  </div>
                ) : (
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
                )}
                <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                  {cfg.label}
                </span>
              </div>
            );
          })}
          <div
            style={{
              color: "var(--text-hint)",
              fontSize: 10,
              textAlign: "center",
              marginTop: 6,
              paddingTop: 6,
              borderTop: "1px solid var(--border-alt)",
            }}
          >
            Перетащите на участок дороги
          </div>
        </div>
      )}
    </div>
  );
}
