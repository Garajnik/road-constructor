import { useReducer, useRef, useState, useLayoutEffect, useEffect } from "react";
import type L from "leaflet";

import { MAP_ZOOM } from "./constants";
import { nodeSegments } from "./utils/geometry";
import { appReducer, initialState } from "./state/reducer";
import type { HistorySnapshot } from "./state/reducer";
import { useCanvasRenderer } from "./hooks/useCanvasRenderer";
import { useMap } from "./hooks/useMap";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useCanvasEvents } from "./hooks/useCanvasEvents";
import { useDragAndDrop } from "./hooks/useDragAndDrop";
import { Toolbar } from "./components/Toolbar";
import { RoadEditPanel } from "./components/RoadEditPanel";
import { ObstaclePalette } from "./components/ObstaclePalette";
import { SelectionInfoPanel } from "./components/SelectionInfoPanel";
import { Legend } from "./components/Legend";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const panRef = useRef({ active: false, startX: 0, startY: 0, didPan: false });
  const preDragSnapshotRef = useRef<HistorySnapshot | null>(null);

  const [state, dispatch] = useReducer(appReducer, initialState);

  const draggingCoeffRef = useRef(state.draggingCoeff);
  const draggingCrossingFromPaletteRef = useRef(state.draggingCrossingFromPalette);
  const draggingBusStopFromPaletteRef = useRef(state.draggingBusStopFromPalette);
  const draggingParkingFromPaletteRef = useRef(state.draggingParkingFromPalette);
  const draggingCrossingRef = useRef(state.draggingCrossing);
  const draggingBusStopRef = useRef(state.draggingBusStop);
  const draggingParkingRef = useRef(state.draggingParking);
  const draggingNodeRef = useRef<{
    nodeId: string;
    startX: number;
    startY: number;
    didMove: boolean;
  } | null>(null);
  const justFinishedCrossingDragRef = useRef(false);
  const justFinishedBusStopDragRef = useRef(false);
  const justFinishedParkingDragRef = useRef(false);
  const justFinishedNodeDragRef = useRef(false);

  const stateRef = useRef(state);
  useLayoutEffect(() => {
    stateRef.current = state;
    draggingCoeffRef.current = state.draggingCoeff;
    draggingCrossingFromPaletteRef.current = state.draggingCrossingFromPalette;
    draggingBusStopFromPaletteRef.current = state.draggingBusStopFromPalette;
    draggingParkingFromPaletteRef.current = state.draggingParkingFromPalette;
    draggingCrossingRef.current = state.draggingCrossing;
    draggingBusStopRef.current = state.draggingBusStop;
    draggingParkingRef.current = state.draggingParking;
  });

  const renderFromRef = useCanvasRenderer(canvasRef, mapRef, stateRef, state);
  const { zoomIn, zoomOut } = useMap(canvasRef, mapContainerRef, mapRef, renderFromRef);
  useKeyboardShortcuts(dispatch, stateRef, zoomIn, zoomOut);

  const [zoomLevel, setZoomLevel] = useState(MAP_ZOOM);
  const zoomRafRef = useRef(0);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const onZoom = () => {
      if (zoomRafRef.current) return;
      zoomRafRef.current = requestAnimationFrame(() => {
        zoomRafRef.current = 0;
        setZoomLevel(map.getZoom());
      });
    };
    map.on("zoomend", onZoom);
    return () => {
      map.off("zoomend", onZoom);
      if (zoomRafRef.current) cancelAnimationFrame(zoomRafRef.current);
    };
  }, [mapRef]);

  const {
    handleMouseDown,
    handleMouseMove,
    handleClick,
    handleContextMenu,
    handleSegmentChange,
  } = useCanvasEvents({
    canvasRef,
    mapRef,
    panRef,
    stateRef,
    dispatch,
    draggingCrossingRef,
    draggingBusStopRef,
    draggingParkingRef,
    draggingNodeRef,
    justFinishedCrossingDragRef,
    justFinishedBusStopDragRef,
    justFinishedParkingDragRef,
    justFinishedNodeDragRef,
    preDragSnapshotRef,
  });

  const { handleDragOver, handleDrop, handleDragLeave } = useDragAndDrop({
    canvasRef,
    mapRef,
    panRef,
    stateRef,
    dispatch,
    draggingCoeffRef,
    draggingCrossingFromPaletteRef,
    draggingBusStopFromPaletteRef,
    draggingParkingFromPaletteRef,
    draggingCrossingRef,
    draggingBusStopRef,
    draggingParkingRef,
    draggingNodeRef,
    justFinishedCrossingDragRef,
    justFinishedBusStopDragRef,
    justFinishedParkingDragRef,
    justFinishedNodeDragRef,
    preDragSnapshotRef,
  });

  // ── Derived ──
  const selNode = state.nodes.find((n) => n.id === state.selectedId);
  const selSeg = state.segments.find((s) => s.id === state.selectedId);
  const intersectionCount = state.nodes.filter(
    (n) => nodeSegments(state.segments, n.id).length >= 3,
  ).length;
  const editSeg = state.editPanel
    ? (state.segments.find((s) => s.id === state.editPanel!.segId) ?? null)
    : null;

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
      <Toolbar
        tool={state.tool}
        setTool={(t) => dispatch({ type: "SET_TOOL", tool: t })}
        defLanesF={state.defLanesF}
        setDefLanesF={(v) => dispatch({ type: "SET_DEF_LANES_F", value: v })}
        defLanesB={state.defLanesB}
        setDefLanesB={(v) => dispatch({ type: "SET_DEF_LANES_B", value: v })}
        defSpeed={state.defSpeed}
        setDefSpeed={(v) => dispatch({ type: "SET_DEF_SPEED", value: v })}
        defSurface={state.defSurface}
        setDefSurface={(v) => dispatch({ type: "SET_DEF_SURFACE", value: v })}
        roadScale={state.roadScale}
        setRoadScale={(v) => dispatch({ type: "SET_ROAD_SCALE", value: v })}
        defDisplayScale={state.defDisplayScale}
        setDefDisplayScale={(v) => dispatch({ type: "SET_DEF_DISPLAY_SCALE", value: v })}
        nodeCount={state.nodes.length}
        segmentCount={state.segments.length}
        intersectionCount={intersectionCount}
        buildFrom={!!state.buildFrom}
        onClear={() => dispatch({ type: "CLEAR_ALL" })}
        setBuildFrom={() => dispatch({ type: "SET_BUILD_FROM", node: null })}
      />

      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <div
          ref={mapContainerRef}
          style={{ position: "absolute", inset: 0, zIndex: 0, background: "#0d0d1a" }}
        />
        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            zIndex: 1,
            cursor:
              state.draggingCrossing || state.draggingBusStop || state.draggingParking || state.draggingNodeId
                ? "grabbing"
                : (state.hoveredNodeId &&
                    (state.tool === "select" || state.tool === "road")) ||
                    (state.hoveredCrossingId &&
                      (state.tool === "select" || state.tool === "crossing"))
                  ? "grab"
                  : state.tool === "select"
                    ? "default"
                    : "crosshair",
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => {
            if (!panRef.current.active) {
              dispatch({ type: "CLEAR_HOVER" });
            }
          }}
          onClick={handleClick}
          onContextMenu={handleContextMenu}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onDragLeave={handleDragLeave}
        />

        <ObstaclePalette
          paletteOpen={state.paletteOpen}
          setPaletteOpen={(v) => dispatch({ type: "SET_PALETTE_OPEN", open: v })}
          draggingCoeff={state.draggingCoeff}
          setDraggingCoeff={(v) => dispatch({ type: "SET_DRAGGING_COEFF", coeff: v })}
          draggingCoeffRef={draggingCoeffRef}
          draggingCrossingFromPalette={state.draggingCrossingFromPalette}
          setDraggingCrossingFromPalette={(v) => dispatch({ type: "SET_DRAGGING_CROSSING_FROM_PALETTE", value: v })}
          draggingCrossingFromPaletteRef={draggingCrossingFromPaletteRef}
          draggingBusStopFromPalette={state.draggingBusStopFromPalette}
          setDraggingBusStopFromPalette={(v) => dispatch({ type: "SET_DRAGGING_BUS_STOP_FROM_PALETTE", value: v })}
          draggingBusStopFromPaletteRef={draggingBusStopFromPaletteRef}
          draggingParkingFromPalette={state.draggingParkingFromPalette}
          setDraggingParkingFromPalette={(v) => dispatch({ type: "SET_DRAGGING_PARKING_FROM_PALETTE", value: v })}
          draggingParkingFromPaletteRef={draggingParkingFromPaletteRef}
          setDropTargetSegId={(v) => dispatch({ type: "SET_DROP_TARGET_SEG_ID", id: v })}
        />

        {editSeg && state.editPanel && (
          <RoadEditPanel
            seg={editSeg}
            panelX={state.editPanel.x}
            panelY={state.editPanel.y}
            segmentT={state.editPanel.segmentT}
            onChange={handleSegmentChange}
            onClose={() => dispatch({ type: "SET_EDIT_PANEL", panel: null })}
            onPanelMove={(x, y) =>
              dispatch({ type: "MOVE_EDIT_PANEL", x, y })
            }
            onAddNode={(segId, t) =>
              dispatch({ type: "SPLIT_SEGMENT", segId, t })
            }
          />
        )}

        {!state.editPanel && (selNode || selSeg) && (
          <SelectionInfoPanel
            selNode={selNode}
            selSeg={selSeg}
            segments={state.segments}
            onStartBuild={(node) => {
              dispatch({ type: "SET_TOOL", tool: "road" });
              dispatch({ type: "SET_BUILD_FROM", node });
            }}
          />
        )}

        <Legend />

        <div
          style={{
            position: "absolute",
            bottom: 12,
            right: 12,
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            userSelect: "none",
          }}
        >
          <button
            onClick={zoomIn}
            style={{
              width: 32,
              height: 32,
              borderRadius: "6px 6px 0 0",
              border: "1px solid #1e1e3e",
              borderBottom: "none",
              background: "#12122a",
              color: "#80c0ff",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title="Приблизить (+)"
          >
            +
          </button>
          <div
            style={{
              width: 32,
              height: 26,
              background: "#12122a",
              border: "1px solid #1e1e3e",
              borderTop: "none",
              borderBottom: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#556",
              fontSize: 10,
              fontFamily: "monospace",
            }}
            title={`Масштаб: ${zoomLevel.toFixed(1)}`}
          >
            {zoomLevel.toFixed(1)}
          </div>
          <button
            onClick={zoomOut}
            style={{
              width: 32,
              height: 32,
              borderRadius: "0 0 6px 6px",
              border: "1px solid #1e1e3e",
              borderTop: "none",
              background: "#12122a",
              color: "#80c0ff",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title="Отдалить (-)"
          >
            -
          </button>
        </div>
      </div>
    </div>
  );
}
