import { useEffect, useCallback } from "react";
import L from "leaflet";
import type { CoefficientType } from "../types";
import { COEFF, CROSSING_DEFAULT_WIDTH } from "../constants";
import { getScale, uid, toScreen, toGeo } from "../utils/coordinates";
import { PARKING_DEFAULT_LENGTH_T } from "../constants";
import {
  nearestSegment,
  nearestSegmentWithT,
  projectToSegment,
  detectSide,
  roadWidth,
} from "../utils/geometry";
import type { AppAction, AppState, HistorySnapshot } from "../state/reducer";

type RefState = Pick<AppState, "nodes" | "segments" | "tool" | "roadScale">;

interface UseDragAndDropArgs {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  mapRef: React.RefObject<L.Map | null>;
  panRef: React.RefObject<{ active: boolean; startX: number; startY: number; didPan: boolean }>;
  stateRef: React.RefObject<RefState>;
  dispatch: React.Dispatch<AppAction>;
  draggingCoeffRef: React.RefObject<CoefficientType | null>;
  draggingCrossingFromPaletteRef: React.RefObject<boolean>;
  draggingBusStopFromPaletteRef: React.RefObject<boolean>;
  draggingParkingFromPaletteRef: React.RefObject<boolean>;
  draggingCrossingRef: React.RefObject<{ segId: string; crossingId: string } | null>;
  draggingBusStopRef: React.RefObject<{ segId: string; busStopId: string } | null>;
  draggingParkingRef: React.RefObject<{ segId: string; parkingId: string } | null>;
  draggingNodeRef: React.RefObject<{
    nodeId: string;
    startX: number;
    startY: number;
    didMove: boolean;
  } | null>;
  justFinishedCrossingDragRef: React.RefObject<boolean>;
  justFinishedBusStopDragRef: React.RefObject<boolean>;
  justFinishedParkingDragRef: React.RefObject<boolean>;
  justFinishedNodeDragRef: React.RefObject<boolean>;
  preDragSnapshotRef: React.MutableRefObject<HistorySnapshot | null>;
}

export function useDragAndDrop({
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
}: UseDragAndDropArgs) {
  // Global panning listeners
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
  }, [canvasRef, mapRef, panRef, stateRef]);

  // Global crossing drag listeners
  useEffect(() => {
    const REMOVE_THRESHOLD_FACTOR = 2;
    const onMove = (e: MouseEvent) => {
      const dc = draggingCrossingRef.current;
      if (!dc) return;
      const map = mapRef.current;
      if (!map) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const { segments: segs, nodes: ns } = stateRef.current;
      // const scale = getScale(map.getZoom(), rs);
      const screenNodes = ns.map((n) => toScreen(map, n));
      const screenMap = new Map(screenNodes.map((n) => [n.id, n]));
      const seg = segs.find((s) => s.id === dc.segId);
      if (!seg) return;
      const a = screenMap.get(seg.fromId);
      const b = screenMap.get(seg.toId);
      if (!a || !b) return;
      const { t } = projectToSegment(pos, a, b);
      const safeT = Math.max(0.05, Math.min(0.95, t));
      dispatch({
        type: "UPDATE_SEGMENTS",
        updater: (segs) =>
          segs.map((s) => {
            if (s.id !== dc.segId) return s;
            return {
              ...s,
              pedestrianCrossings: (s.pedestrianCrossings ?? []).map((c) =>
                c.id === dc.crossingId ? { ...c, t: safeT } : c,
              ),
            };
          }),
      });
    };
    const onUp = (e: MouseEvent) => {
      const dc = draggingCrossingRef.current;
      if (!dc) return;
      const map = mapRef.current;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (map && rect) {
        const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        const { segments: segs, nodes: ns, roadScale: rs } = stateRef.current;
        const scale = getScale(map.getZoom(), rs);
        const screenNodes = ns.map((n) => toScreen(map, n));
        const screenMap = new Map(screenNodes.map((n) => [n.id, n]));
        const seg = segs.find((s) => s.id === dc.segId);
        if (seg) {
          const a = screenMap.get(seg.fromId);
          const b = screenMap.get(seg.toId);
          if (a && b) {
            const { dist: d } = projectToSegment(pos, a, b);
            const threshold = roadWidth(seg, scale) * REMOVE_THRESHOLD_FACTOR;
            if (d > threshold) {
              dispatch({ type: "SAVE_HISTORY" });
              dispatch({
                type: "UPDATE_SEGMENTS",
                updater: (segs) =>
                  segs.map((s) => {
                    if (s.id !== dc.segId) return s;
                    return {
                      ...s,
                      pedestrianCrossings: (s.pedestrianCrossings ?? []).filter(
                        (c) => c.id !== dc.crossingId,
                      ),
                    };
                  }),
              });
              preDragSnapshotRef.current = null;
              justFinishedCrossingDragRef.current = true;
              draggingCrossingRef.current = null;
              dispatch({ type: "SET_DRAGGING_CROSSING", value: null });
              if (canvasRef.current) {
                const t = stateRef.current.tool;
                canvasRef.current.style.cursor =
                  t === "select" ? "default" : "crosshair";
              }
              return;
            }
          }
        }
      }
      if (preDragSnapshotRef.current) {
        dispatch({ type: "PUSH_SNAPSHOT", snapshot: preDragSnapshotRef.current });
        preDragSnapshotRef.current = null;
      }
      justFinishedCrossingDragRef.current = true;
      draggingCrossingRef.current = null;
      dispatch({ type: "SET_DRAGGING_CROSSING", value: null });
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
  }, [canvasRef, mapRef, stateRef, dispatch, draggingCrossingRef, justFinishedCrossingDragRef, preDragSnapshotRef]);

  // Global bus stop drag listeners
  useEffect(() => {
    const REMOVE_THRESHOLD_FACTOR = 2;
    const onMove = (e: MouseEvent) => {
      const db = draggingBusStopRef.current;
      if (!db) return;
      const map = mapRef.current;
      if (!map) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const { segments: segs, nodes: ns } = stateRef.current;
      // const scale = getScale(map.getZoom(), rs);
      const screenNodes = ns.map((n) => toScreen(map, n));
      const screenMap = new Map(screenNodes.map((n) => [n.id, n]));
      const seg = segs.find((s) => s.id === db.segId);
      if (!seg) return;
      const a = screenMap.get(seg.fromId);
      const b = screenMap.get(seg.toId);
      if (!a || !b) return;
      const { t } = projectToSegment(pos, a, b);
      const safeT = Math.max(0.05, Math.min(0.95, t));
      dispatch({
        type: "UPDATE_SEGMENTS",
        updater: (segs) =>
          segs.map((s) => {
            if (s.id !== db.segId) return s;
            return {
              ...s,
              busStops: (s.busStops ?? []).map((b) =>
                b.id === db.busStopId ? { ...b, t: safeT } : b,
              ),
            };
          }),
      });
    };
    const onUp = (e: MouseEvent) => {
      const db = draggingBusStopRef.current;
      if (!db) return;
      const map = mapRef.current;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (map && rect) {
        const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        const { segments: segs, nodes: ns, roadScale: rs } = stateRef.current;
        const scale = getScale(map.getZoom(), rs);
        const screenNodes = ns.map((n) => toScreen(map, n));
        const screenMap = new Map(screenNodes.map((n) => [n.id, n]));
        const seg = segs.find((s) => s.id === db.segId);
        if (seg) {
          const a = screenMap.get(seg.fromId);
          const b = screenMap.get(seg.toId);
          if (a && b) {
            const { dist: d } = projectToSegment(pos, a, b);
            const threshold = roadWidth(seg, scale) * REMOVE_THRESHOLD_FACTOR;
            if (d > threshold) {
              dispatch({ type: "SAVE_HISTORY" });
              dispatch({
                type: "UPDATE_SEGMENTS",
                updater: (segs) =>
                  segs.map((s) => {
                    if (s.id !== db.segId) return s;
                    return {
                      ...s,
                      busStops: (s.busStops ?? []).filter((b) => b.id !== db.busStopId),
                    };
                  }),
              });
              preDragSnapshotRef.current = null;
              justFinishedBusStopDragRef.current = true;
              draggingBusStopRef.current = null;
              dispatch({ type: "SET_DRAGGING_BUS_STOP", value: null });
              if (canvasRef.current) {
                const t = stateRef.current.tool;
                canvasRef.current.style.cursor = t === "select" ? "default" : "crosshair";
              }
              return;
            }
          }
        }
      }
      if (preDragSnapshotRef.current) {
        dispatch({ type: "PUSH_SNAPSHOT", snapshot: preDragSnapshotRef.current });
        preDragSnapshotRef.current = null;
      }
      justFinishedBusStopDragRef.current = true;
      draggingBusStopRef.current = null;
      dispatch({ type: "SET_DRAGGING_BUS_STOP", value: null });
      if (canvasRef.current) {
        const t = stateRef.current.tool;
        canvasRef.current.style.cursor = t === "select" ? "default" : "crosshair";
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [canvasRef, mapRef, stateRef, dispatch, draggingBusStopRef, justFinishedBusStopDragRef, preDragSnapshotRef]);

  // Global parking drag listeners
  useEffect(() => {
    const REMOVE_THRESHOLD_FACTOR = 2;
    const onMove = (e: MouseEvent) => {
      const dp = draggingParkingRef.current;
      if (!dp) return;
      const map = mapRef.current;
      if (!map) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const { segments: segs, nodes: ns } = stateRef.current;
      // const scale = getScale(map.getZoom(), rs);
      const screenNodes = ns.map((n) => toScreen(map, n));
      const screenMap = new Map(screenNodes.map((n) => [n.id, n]));
      const seg = segs.find((s) => s.id === dp.segId);
      if (!seg) return;
      const a = screenMap.get(seg.fromId);
      const b = screenMap.get(seg.toId);
      if (!a || !b) return;
      const { t } = projectToSegment(pos, a, b);
      const safeT = Math.max(0.05, Math.min(0.95, t));
      dispatch({
        type: "UPDATE_SEGMENTS",
        updater: (segs) =>
          segs.map((s) => {
            if (s.id !== dp.segId) return s;
            return {
              ...s,
              parkingSpaces: (s.parkingSpaces ?? []).map((p) =>
                p.id === dp.parkingId ? { ...p, t: safeT } : p,
              ),
            };
          }),
      });
    };
    const onUp = (e: MouseEvent) => {
      const dp = draggingParkingRef.current;
      if (!dp) return;
      const map = mapRef.current;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (map && rect) {
        const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        const { segments: segs, nodes: ns, roadScale: rs } = stateRef.current;
        const scale = getScale(map.getZoom(), rs);
        const screenNodes = ns.map((n) => toScreen(map, n));
        const screenMap = new Map(screenNodes.map((n) => [n.id, n]));
        const seg = segs.find((s) => s.id === dp.segId);
        if (seg) {
          const a = screenMap.get(seg.fromId);
          const b = screenMap.get(seg.toId);
          if (a && b) {
            const { dist: d } = projectToSegment(pos, a, b);
            const threshold = roadWidth(seg, scale) * REMOVE_THRESHOLD_FACTOR;
            if (d > threshold) {
              dispatch({ type: "SAVE_HISTORY" });
              dispatch({
                type: "UPDATE_SEGMENTS",
                updater: (segs) =>
                  segs.map((s) => {
                    if (s.id !== dp.segId) return s;
                    return {
                      ...s,
                      parkingSpaces: (s.parkingSpaces ?? []).filter((p) => p.id !== dp.parkingId),
                    };
                  }),
              });
              preDragSnapshotRef.current = null;
              justFinishedParkingDragRef.current = true;
              draggingParkingRef.current = null;
              dispatch({ type: "SET_DRAGGING_PARKING", value: null });
              if (canvasRef.current) {
                const t = stateRef.current.tool;
                canvasRef.current.style.cursor = t === "select" ? "default" : "crosshair";
              }
              return;
            }
          }
        }
      }
      if (preDragSnapshotRef.current) {
        dispatch({ type: "PUSH_SNAPSHOT", snapshot: preDragSnapshotRef.current });
        preDragSnapshotRef.current = null;
      }
      justFinishedParkingDragRef.current = true;
      draggingParkingRef.current = null;
      dispatch({ type: "SET_DRAGGING_PARKING", value: null });
      if (canvasRef.current) {
        const t = stateRef.current.tool;
        canvasRef.current.style.cursor = t === "select" ? "default" : "crosshair";
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [canvasRef, mapRef, stateRef, dispatch, draggingParkingRef, justFinishedParkingDragRef, preDragSnapshotRef]);

  // Global node drag listeners
  useEffect(() => {
    const DRAG_THRESHOLD = 3;
    const onMove = (e: MouseEvent) => {
      const dn = draggingNodeRef.current;
      if (!dn) return;
      const map = mapRef.current;
      if (!map) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const dx = Math.abs(e.clientX - dn.startX);
      const dy = Math.abs(e.clientY - dn.startY);
      if (dx >= DRAG_THRESHOLD || dy >= DRAG_THRESHOLD) {
        dn.didMove = true;
      }
      const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const geo = toGeo(map, pos);
      dispatch({ type: "UPDATE_NODE", nodeId: dn.nodeId, lat: geo.lat, lng: geo.lng });
    };
    const onUp = () => {
      const dn = draggingNodeRef.current;
      if (!dn) return;
      if (dn.didMove) {
        // Push the pre-drag snapshot so the node move can be undone
        if (preDragSnapshotRef.current) {
          dispatch({ type: "PUSH_SNAPSHOT", snapshot: preDragSnapshotRef.current });
        }
        justFinishedNodeDragRef.current = true;
      }
      preDragSnapshotRef.current = null;
      draggingNodeRef.current = null;
      dispatch({ type: "SET_DRAGGING_NODE_ID", id: null });
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
  }, [
    canvasRef,
    mapRef,
    stateRef,
    dispatch,
    draggingNodeRef,
    justFinishedNodeDragRef,
    preDragSnapshotRef,
  ]);

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      const dc = draggingCoeffRef.current;
      const fromPalette = draggingCrossingFromPaletteRef.current;
      const fromBusPalette = draggingBusStopFromPaletteRef.current;
      const fromParkingPalette = draggingParkingFromPaletteRef.current;
      if (!dc && !fromPalette && !fromBusPalette && !fromParkingPalette) return;
      const map = mapRef.current;
      if (!map) return;
      const rect = canvasRef.current!.getBoundingClientRect();
      const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const { segments: segs, nodes: ns, roadScale: rs } = stateRef.current;
      const scale = getScale(map.getZoom(), rs);
      const screenNodes = ns.map((n) => toScreen(map, n));
      const screenMap = new Map(screenNodes.map((n) => [n.id, n]));
      const seg = nearestSegment(screenMap, segs, pos, 30, scale);
      dispatch({ type: "SET_DROP_TARGET_SEG_ID", id: seg?.id ?? null });
    },
    [canvasRef, mapRef, stateRef, dispatch, draggingCoeffRef, draggingCrossingFromPaletteRef, draggingBusStopFromPaletteRef, draggingParkingFromPaletteRef],
  );

  const handleDrop = useCallback((e: React.DragEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const dc = draggingCoeffRef.current;
    const fromPalette = draggingCrossingFromPaletteRef.current;
    const fromBusPalette = draggingBusStopFromPaletteRef.current;
    const fromParkingPalette = draggingParkingFromPaletteRef.current;
    if (!dc && !fromPalette && !fromBusPalette && !fromParkingPalette) {
      dispatch({ type: "SET_DROP_TARGET_SEG_ID", id: null });
      return;
    }
    const map = mapRef.current;
    if (!map) {
      dispatch({ type: "SET_DROP_TARGET_SEG_ID", id: null });
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
        dispatch({ type: "SAVE_HISTORY" });
        dispatch({
          type: "UPDATE_SEGMENTS",
          updater: (segs) =>
            segs.map((s) => {
              if (s.id !== snap.seg.id) return s;
              return {
                ...s,
                pedestrianCrossings: [
                  ...(s.pedestrianCrossings ?? []),
                  { id: uid(), t: safeT, width: CROSSING_DEFAULT_WIDTH },
                ],
              };
            }),
        });
      }
      dispatch({ type: "SET_DRAGGING_CROSSING_FROM_PALETTE", value: false });
      draggingCrossingFromPaletteRef.current = false;
    } else if (fromBusPalette) {
      const snap = nearestSegmentWithT(screenMap, segs, pos, 30, scale);
      if (snap) {
        const safeT = Math.max(0.05, Math.min(0.95, snap.t));
        const a = screenMap.get(snap.seg.fromId);
        const b = screenMap.get(snap.seg.toId);
        const side = a && b ? detectSide(pos, a, b) : "right" as const;
        dispatch({ type: "SAVE_HISTORY" });
        dispatch({
          type: "UPDATE_SEGMENTS",
          updater: (segs) =>
            segs.map((s) => {
              if (s.id !== snap.seg.id) return s;
              return {
                ...s,
                busStops: [
                  ...(s.busStops ?? []),
                  { id: uid(), t: safeT, side },
                ],
              };
            }),
        });
      }
      dispatch({ type: "SET_DRAGGING_BUS_STOP_FROM_PALETTE", value: false });
      draggingBusStopFromPaletteRef.current = false;
    } else if (fromParkingPalette) {
      const snap = nearestSegmentWithT(screenMap, segs, pos, 30, scale);
      if (snap) {
        const safeT = Math.max(0.05, Math.min(0.95, snap.t));
        const a = screenMap.get(snap.seg.fromId);
        const b = screenMap.get(snap.seg.toId);
        const side = a && b ? detectSide(pos, a, b) : "right" as const;
        dispatch({ type: "SAVE_HISTORY" });
        dispatch({
          type: "UPDATE_SEGMENTS",
          updater: (segs) =>
            segs.map((s) => {
              if (s.id !== snap.seg.id) return s;
              return {
                ...s,
                parkingSpaces: [
                  ...(s.parkingSpaces ?? []),
                  { id: uid(), t: safeT, side, length: PARKING_DEFAULT_LENGTH_T },
                ],
              };
            }),
        });
      }
      dispatch({ type: "SET_DRAGGING_PARKING_FROM_PALETTE", value: false });
      draggingParkingFromPaletteRef.current = false;
    } else if (dc) {
      const seg = nearestSegment(screenMap, segs, pos, 30, scale);
      if (seg) {
        const cfg = COEFF[dc];
        dispatch({ type: "SAVE_HISTORY" });
        dispatch({
          type: "UPDATE_SEGMENTS",
          updater: (segs) =>
            segs.map((s) => {
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
        });
      }
      draggingCoeffRef.current = null;
      dispatch({ type: "SET_DRAGGING_COEFF", coeff: null });
    }
    dispatch({ type: "SET_DROP_TARGET_SEG_ID", id: null });
  }, [canvasRef, mapRef, stateRef, dispatch, draggingCoeffRef, draggingCrossingFromPaletteRef, draggingBusStopFromPaletteRef, draggingParkingFromPaletteRef]);

  const handleDragLeave = useCallback(() => {
    dispatch({ type: "SET_DROP_TARGET_SEG_ID", id: null });
  }, [dispatch]);

  return { handleDragOver, handleDrop, handleDragLeave };
}
