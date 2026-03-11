import { useCallback } from "react";
import type L from "leaflet";
import type { Vec2, RoadNode, RoadSegment } from "../types";
import { HANDLE_OFFSET, HANDLE_RADIUS, MIN_SEGMENT_LENGTH, CROSSING_DEFAULT_WIDTH, DEFAULT_TRAFFIC_INTENSITY } from "../constants";
import { getScale, uid, toScreen, toGeo } from "../utils/coordinates";
import { PARKING_DEFAULT_LENGTH_T } from "../constants";
import {
  dist,
  alreadyConnected,
  nodeHalfSize,
  nodeOrientationAngle,
  handlePos,
  nearestNodeSq,
  nearestSegment,
  nearestCrossing,
  nearestBusStop,
  nearestParkingSpace,
  nearestSegmentWithT,
  detectSide,
} from "../utils/geometry";
import type { AppAction, AppState, HistorySnapshot } from "../state/reducer";

type RefState = Pick<
  AppState,
  | "nodes"
  | "segments"
  | "tool"
  | "defLanesF"
  | "defLanesB"
  | "defSpeed"
  | "defSurface"
  | "defDisplayScale"
  | "selectedId"
  | "buildFrom"
  | "roadScale"
>;

interface UseCanvasEventsArgs {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  mapRef: React.RefObject<L.Map | null>;
  panRef: React.RefObject<{ active: boolean; startX: number; startY: number; didPan: boolean }>;
  stateRef: React.RefObject<RefState>;
  dispatch: React.Dispatch<AppAction>;
  draggingCrossingRef: React.RefObject<{ segId: string; crossingId: string } | null>;
  draggingBusStopRef: React.RefObject<{ segId: string; busStopId: string } | null>;
  draggingParkingRef: React.RefObject<{ segId: string; parkingId: string } | null>;
  draggingNodeRef: React.RefObject<{ nodeId: string; startX: number; startY: number; didMove: boolean } | null>;
  justFinishedCrossingDragRef: React.RefObject<boolean>;
  justFinishedBusStopDragRef: React.RefObject<boolean>;
  justFinishedParkingDragRef: React.RefObject<boolean>;
  justFinishedNodeDragRef: React.RefObject<boolean>;
  preDragSnapshotRef: React.MutableRefObject<HistorySnapshot | null>;
}

export function useCanvasEvents({
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
}: UseCanvasEventsArgs) {
  const getPos = useCallback((e: React.MouseEvent): Vec2 => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }, [canvasRef]);

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
            const value = {
              segId: snap.seg.id,
              crossingId: snap.crossing.id,
            };
            preDragSnapshotRef.current = { nodes: ns, segments: segs };
            draggingCrossingRef.current = value;
            dispatch({ type: "SET_DRAGGING_CROSSING", value });
          }
        }
        if (t === "select" || t === "bus_stop") {
          const scale = getScale(map.getZoom(), rs);
          const screenNodes = ns.map((n) => toScreen(map, n));
          const screenMap = new Map(screenNodes.map((n) => [n.id, n]));
          const snap = nearestBusStop(screenMap, segs, pos, scale);
          if (snap) {
            const value = { segId: snap.seg.id, busStopId: snap.busStop.id };
            preDragSnapshotRef.current = { nodes: ns, segments: segs };
            draggingBusStopRef.current = value;
            dispatch({ type: "SET_DRAGGING_BUS_STOP", value });
          }
        }
        if (t === "select" || t === "parking") {
          const scale = getScale(map.getZoom(), rs);
          const screenNodes = ns.map((n) => toScreen(map, n));
          const screenMap = new Map(screenNodes.map((n) => [n.id, n]));
          const snap = nearestParkingSpace(screenMap, segs, pos, scale);
          if (snap) {
            const value = { segId: snap.seg.id, parkingId: snap.parkingSpace.id };
            preDragSnapshotRef.current = { nodes: ns, segments: segs };
            draggingParkingRef.current = value;
            dispatch({ type: "SET_DRAGGING_PARKING", value });
          }
        }
        const anyDrag = draggingCrossingRef.current || draggingBusStopRef.current || draggingParkingRef.current;
        if ((t === "select" || t === "road") && !anyDrag) {
          const scale = getScale(map.getZoom(), rs);
          const screenNodes = ns.map((n) => toScreen(map, n));
          const screenMap = new Map(screenNodes.map((n) => [n.id, n]));
          const snapN = nearestNodeSq(screenNodes, segs, pos, scale);
          if (snapN) {
            const hs = nodeHalfSize(snapN.id, segs, scale);
            const hr = HANDLE_RADIUS * scale;
            let overHandle = false;
            const handleAngle = nodeOrientationAngle(snapN.id, segs, screenMap);
            for (let i = 0; i < 4; i++) {
              if (
                dist(pos, handlePos(snapN, hs, i, scale, handleAngle)) <=
                hr + 3 * scale
              ) {
                overHandle = true;
                break;
              }
            }
            if (!overHandle) {
              // Save state before the drag starts so it can be undone
              preDragSnapshotRef.current = { nodes: ns, segments: segs };
              draggingNodeRef.current = {
                nodeId: snapN.id,
                startX: e.clientX,
                startY: e.clientY,
                didMove: false,
              };
              dispatch({ type: "SET_DRAGGING_NODE_ID", id: snapN.id });
            }
          }
        }
      }
    },
    [
      canvasRef,
      mapRef,
      panRef,
      stateRef,
      dispatch,
      draggingCrossingRef,
      draggingBusStopRef,
      draggingParkingRef,
      draggingNodeRef,
      preDragSnapshotRef,
    ],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (panRef.current.active) return;
      const map = mapRef.current;
      if (!map) return;

      const pos = getPos(e);
      dispatch({ type: "SET_MOUSE", pos });
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
          const handleAngle = nodeOrientationAngle(sn.id, segs, screenMap);
          for (let i = 0; i < 4; i++) {
            if (dist(pos, handlePos(sn, hs, i, scale, handleAngle)) <= hr + 3 * scale) {
              dispatch({ type: "SET_HOVERED_HANDLE", handle: { nodeId: sn.id, idx: i } });
              dispatch({ type: "SET_HOVERED_NODE_ID", id: null });
              dispatch({ type: "SET_HOVERED_SEG_ID", id: null });
              return;
            }
          }
        }
      }
      dispatch({ type: "SET_HOVERED_HANDLE", handle: null });

      const exclude = screenBf?.id;
      const hNode = nearestNodeSq(screenNodes, segs, pos, scale, exclude);
      dispatch({ type: "SET_HOVERED_NODE_ID", id: hNode?.id ?? null });
      const seg = hNode
        ? null
        : nearestSegment(screenMap, segs, pos, 30, scale);
      dispatch({ type: "SET_HOVERED_SEG_ID", id: seg?.id ?? null });
      if ((t === "select" || t === "crossing") && !hNode) {
        const snapCross = nearestCrossing(screenMap, segs, pos, scale);
        dispatch({ type: "SET_HOVERED_CROSSING_ID", id: snapCross?.crossing.id ?? null });
      } else {
        dispatch({ type: "SET_HOVERED_CROSSING_ID", id: null });
      }
    },
    [getPos, panRef, mapRef, stateRef, dispatch],
  );

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

      dispatch({ type: "SET_EDIT_PANEL", panel: null });
      if (justFinishedCrossingDragRef.current) {
        justFinishedCrossingDragRef.current = false;
        return;
      }
      if (justFinishedBusStopDragRef.current) {
        justFinishedBusStopDragRef.current = false;
        return;
      }
      if (justFinishedParkingDragRef.current) {
        justFinishedParkingDragRef.current = false;
        return;
      }
      if (justFinishedNodeDragRef.current) {
        justFinishedNodeDragRef.current = false;
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

      if (t !== "delete" && t !== "crossing" && t !== "bus_stop" && t !== "parking" && t !== "split") {
        for (const sn of screenNodes) {
          const hs = nodeHalfSize(sn.id, segs, scale);
          if (dist(pos, sn) > hs + HANDLE_OFFSET * scale + hr + 6 * scale)
            continue;
          const handleAngle = nodeOrientationAngle(sn.id, segs, screenMap);
          for (let i = 0; i < 4; i++) {
            if (dist(pos, handlePos(sn, hs, i, scale, handleAngle)) <= hr + 3 * scale) {
              const geoNode = geoMap.get(sn.id)!;
              if (!bf) {
                dispatch({ type: "SET_TOOL", tool: "road" });
                dispatch({ type: "SET_BUILD_FROM", node: geoNode });
              } else if (bf.id !== sn.id) {
                if (!alreadyConnected(segs, bf.id, sn.id)) {
                  dispatch({
                    type: "ADD_SEGMENT",
                    segment: {
                      id: uid(),
                      fromId: bf.id,
                      toId: sn.id,
                      lanesForward: dlF,
                      lanesBackward: dlB,
                      speedLimit: dspd,
                      surface: dsurf,
                      displayScale: dDsp,
                      trafficIntensity: DEFAULT_TRAFFIC_INTENSITY,
                    },
                  });
                }
                dispatch({ type: "SET_BUILD_FROM", node: geoNode });
              }
              return;
            }
          }
        }
      }

      if (t === "road") {
        const snap = nearestNodeSq(screenNodes, segs, pos, scale, screenBf?.id);
        if (!bf) {
          if (snap) {
            dispatch({ type: "SET_BUILD_FROM", node: geoMap.get(snap.id)! });
          } else {
            const segSnap = nearestSegmentWithT(screenMap, segs, pos, 30, scale);
            if (segSnap) {
              const safeT = Math.max(0.05, Math.min(0.95, segSnap.t));
              dispatch({
                type: "SPLIT_SEGMENT",
                segId: segSnap.seg.id,
                t: safeT,
                setBuildFrom: true,
              });
            } else {
              const geo = toGeo(map, pos);
              const newNode: RoadNode = { id: uid(), lat: geo.lat, lng: geo.lng };
              dispatch({ type: "ADD_NODE", node: newNode });
              dispatch({ type: "SET_BUILD_FROM", node: newNode });
            }
          }
        } else {
          if (snap?.id === bf.id) return;
          if (snap) {
            if (dist(screenBf!, snap) < minLen) return;
            if (!alreadyConnected(segs, bf.id, snap.id)) {
              dispatch({
                type: "ADD_SEGMENT",
                segment: {
                  id: uid(),
                  fromId: bf.id,
                  toId: snap.id,
                  lanesForward: dlF,
                  lanesBackward: dlB,
                  speedLimit: dspd,
                  surface: dsurf,
                  displayScale: dDsp,
                  trafficIntensity: DEFAULT_TRAFFIC_INTENSITY,
                },
              });
            }
            dispatch({ type: "SET_BUILD_FROM", node: null });
          } else {
            const segSnap = nearestSegmentWithT(screenMap, segs, pos, 30, scale);
            if (segSnap) {
              const safeT = Math.max(0.05, Math.min(0.95, segSnap.t));
              dispatch({
                type: "SPLIT_SEGMENT",
                segId: segSnap.seg.id,
                t: safeT,
                setBuildFrom: true,
              });
            } else {
              if (dist(screenBf!, pos) < minLen) return;
              const geo = toGeo(map, pos);
              const newNode: RoadNode = { id: uid(), lat: geo.lat, lng: geo.lng };
              dispatch({ type: "ADD_NODE", node: newNode });
              if (!alreadyConnected(segs, bf.id, newNode.id)) {
                dispatch({
                  type: "ADD_SEGMENT",
                  segment: {
                    id: uid(),
                    fromId: bf.id,
                    toId: newNode.id,
                    lanesForward: dlF,
                    lanesBackward: dlB,
                    speedLimit: dspd,
                    surface: dsurf,
                    displayScale: dDsp,
                    trafficIntensity: DEFAULT_TRAFFIC_INTENSITY,
                  },
                });
              }
              dispatch({ type: "SET_BUILD_FROM", node: newNode });
            }
          }
        }
      } else if (t === "crossing") {
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
      } else if (t === "bus_stop") {
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
      } else if (t === "parking") {
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
      } else if (t === "split") {
        const snap = nearestSegmentWithT(screenMap, segs, pos, 30, scale);
        if (snap) {
          const safeT = Math.max(0.05, Math.min(0.95, snap.t));
          dispatch({ type: "SPLIT_SEGMENT", segId: snap.seg.id, t: safeT });
        }
      } else if (t === "select") {
        const snapN = nearestNodeSq(screenNodes, segs, pos, scale);
        if (snapN) {
          dispatch({ type: "TOGGLE_SELECTED_ID", id: snapN.id });
          return;
        }
        const snapS = nearestSegment(screenMap, segs, pos, 30, scale);
        if (snapS) dispatch({ type: "TOGGLE_SELECTED_ID", id: snapS.id });
        else dispatch({ type: "SET_SELECTED_ID", id: null });
      } else if (t === "delete") {
        const snapCross = nearestCrossing(screenMap, segs, pos, scale);
        if (snapCross) {
          dispatch({ type: "SAVE_HISTORY" });
          dispatch({
            type: "UPDATE_SEGMENTS",
            updater: (segs) =>
              segs.map((s) => {
                if (s.id !== snapCross.seg.id) return s;
                return {
                  ...s,
                  pedestrianCrossings: (s.pedestrianCrossings ?? []).filter(
                    (c) => c.id !== snapCross.crossing.id,
                  ),
                };
              }),
          });
          return;
        }
        const snapBus = nearestBusStop(screenMap, segs, pos, scale);
        if (snapBus) {
          dispatch({ type: "SAVE_HISTORY" });
          dispatch({
            type: "UPDATE_SEGMENTS",
            updater: (segs) =>
              segs.map((s) => {
                if (s.id !== snapBus.seg.id) return s;
                return {
                  ...s,
                  busStops: (s.busStops ?? []).filter(
                    (b) => b.id !== snapBus.busStop.id,
                  ),
                };
              }),
          });
          return;
        }
        const snapPark = nearestParkingSpace(screenMap, segs, pos, scale);
        if (snapPark) {
          dispatch({ type: "SAVE_HISTORY" });
          dispatch({
            type: "UPDATE_SEGMENTS",
            updater: (segs) =>
              segs.map((s) => {
                if (s.id !== snapPark.seg.id) return s;
                return {
                  ...s,
                  parkingSpaces: (s.parkingSpaces ?? []).filter(
                    (p) => p.id !== snapPark.parkingSpace.id,
                  ),
                };
              }),
          });
          return;
        }
        const snapN = nearestNodeSq(screenNodes, segs, pos, scale);
        if (snapN) {
          dispatch({ type: "REMOVE_NODE", nodeId: snapN.id });
          return;
        }
        const snapS = nearestSegment(screenMap, segs, pos, 30, scale);
        if (snapS) {
          dispatch({ type: "REMOVE_SEGMENT", segId: snapS.id });
        }
      }
    },
    [
      getPos,
      panRef,
      mapRef,
      stateRef,
      dispatch,
      justFinishedCrossingDragRef,
      justFinishedBusStopDragRef,
      justFinishedParkingDragRef,
      justFinishedNodeDragRef,
    ],
  );

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
        dispatch({ type: "SET_BUILD_FROM", node: null });
        return;
      }
      const pos = getPos(e);
      const scale = getScale(map.getZoom(), rs);
      const screenNodes = ns.map((n) => toScreen(map, n));
      const screenMap = new Map(screenNodes.map((n) => [n.id, n]));
      const snapN = nearestNodeSq(screenNodes, segs, pos, scale);
      if (snapN) {
        dispatch({ type: "REMOVE_NODE", nodeId: snapN.id });
        dispatch({ type: "SET_EDIT_PANEL", panel: null });
        return;
      }
      const snap = nearestSegmentWithT(screenMap, segs, pos, 30, scale);
      if (snap) {
        dispatch({
          type: "SET_EDIT_PANEL",
          panel: {
            segId: snap.seg.id,
            x: e.clientX,
            y: e.clientY,
            segmentT: snap.t,
          },
        });
        dispatch({ type: "SET_SELECTED_ID", id: snap.seg.id });
      } else {
        dispatch({ type: "SET_EDIT_PANEL", panel: null });
      }
    },
    [getPos, mapRef, stateRef, dispatch],
  );

  const handleSegmentChange = useCallback((updated: RoadSegment) => {
    dispatch({ type: "UPDATE_SEGMENT", segment: updated });
  }, [dispatch]);

  return {
    handleMouseDown,
    handleMouseMove,
    handleClick,
    handleContextMenu,
    handleSegmentChange,
  };
}
