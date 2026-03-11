import type {
  Tool,
  SurfaceType,
  CoefficientType,
  Vec2,
  RoadNode,
  RoadSegment,
  HoveredHandle,
  EditPanelState,
} from "../types";
import { uid } from "../utils/coordinates";

const MAX_HISTORY = 50;

export interface HistorySnapshot {
  nodes: RoadNode[];
  segments: RoadSegment[];
}

export interface AppState {
  nodes: RoadNode[];
  segments: RoadSegment[];
  past: HistorySnapshot[];
  future: HistorySnapshot[];
  tool: Tool;
  defLanesF: number;
  defLanesB: number;
  defSpeed: number;
  defSurface: SurfaceType;
  defDisplayScale: number;
  roadScale: number;
  selectedId: string | null;
  buildFrom: RoadNode | null;
  hoveredNodeId: string | null;
  hoveredSegId: string | null;
  hoveredHandle: HoveredHandle | null;
  hoveredCrossingId: string | null;
  mouse: Vec2 | null;
  editPanel: EditPanelState | null;
  paletteOpen: boolean;
  draggingCoeff: CoefficientType | null;
  dropTargetSegId: string | null;
  draggingCrossingFromPalette: boolean;
  draggingBusStopFromPalette: boolean;
  draggingParkingFromPalette: boolean;
  draggingCrossing: { segId: string; crossingId: string } | null;
  draggingBusStop: { segId: string; busStopId: string } | null;
  draggingParking: { segId: string; parkingId: string } | null;
  draggingNodeId: string | null;
  theme: "dark" | "light";
}

export const initialState: AppState = {
  nodes: [],
  segments: [],
  past: [],
  future: [],
  tool: "road",
  defLanesF: 1,
  defLanesB: 1,
  defSpeed: 50,
  defSurface: "asphalt",
  defDisplayScale: 1,
  roadScale: 0.1,
  selectedId: null,
  buildFrom: null,
  hoveredNodeId: null,
  hoveredSegId: null,
  hoveredHandle: null,
  hoveredCrossingId: null,
  mouse: null,
  editPanel: null,
  paletteOpen: true,
  draggingCoeff: null,
  dropTargetSegId: null,
  draggingCrossingFromPalette: false,
  draggingBusStopFromPalette: false,
  draggingParkingFromPalette: false,
  draggingCrossing: null,
  draggingBusStop: null,
  draggingParking: null,
  draggingNodeId: null,
  theme: "dark",
};

export type AppAction =
  | { type: "SET_NODES"; nodes: RoadNode[] }
  | { type: "ADD_NODE"; node: RoadNode }
  | { type: "UPDATE_NODE"; nodeId: string; lat: number; lng: number }
  | { type: "REMOVE_NODE"; nodeId: string }
  | { type: "SET_SEGMENTS"; segments: RoadSegment[] }
  | { type: "ADD_SEGMENT"; segment: RoadSegment }
  | { type: "UPDATE_SEGMENT"; segment: RoadSegment }
  | { type: "REMOVE_SEGMENT"; segId: string }
  | { type: "UPDATE_SEGMENTS"; updater: (segs: RoadSegment[]) => RoadSegment[] }
  | { type: "SET_TOOL"; tool: Tool }
  | { type: "SET_DEF_LANES_F"; value: number }
  | { type: "SET_DEF_LANES_B"; value: number }
  | { type: "SET_DEF_SPEED"; value: number }
  | { type: "SET_DEF_SURFACE"; value: SurfaceType }
  | { type: "SET_DEF_DISPLAY_SCALE"; value: number }
  | { type: "SET_ROAD_SCALE"; value: number }
  | { type: "SET_SELECTED_ID"; id: string | null }
  | { type: "TOGGLE_SELECTED_ID"; id: string }
  | { type: "SET_BUILD_FROM"; node: RoadNode | null }
  | { type: "SET_HOVERED_NODE_ID"; id: string | null }
  | { type: "SET_HOVERED_SEG_ID"; id: string | null }
  | { type: "SET_HOVERED_HANDLE"; handle: HoveredHandle | null }
  | { type: "SET_HOVERED_CROSSING_ID"; id: string | null }
  | { type: "SET_MOUSE"; pos: Vec2 | null }
  | { type: "SET_EDIT_PANEL"; panel: EditPanelState | null }
  | { type: "MOVE_EDIT_PANEL"; x: number; y: number }
  | { type: "SET_PALETTE_OPEN"; open: boolean }
  | { type: "SET_DRAGGING_COEFF"; coeff: CoefficientType | null }
  | { type: "SET_DROP_TARGET_SEG_ID"; id: string | null }
  | { type: "SET_DRAGGING_CROSSING_FROM_PALETTE"; value: boolean }
  | { type: "SET_DRAGGING_BUS_STOP_FROM_PALETTE"; value: boolean }
  | { type: "SET_DRAGGING_PARKING_FROM_PALETTE"; value: boolean }
  | { type: "SET_DRAGGING_CROSSING"; value: { segId: string; crossingId: string } | null }
  | { type: "SET_DRAGGING_BUS_STOP"; value: { segId: string; busStopId: string } | null }
  | { type: "SET_DRAGGING_PARKING"; value: { segId: string; parkingId: string } | null }
  | { type: "SET_DRAGGING_NODE_ID"; id: string | null }
  | { type: "CLEAR_HOVER" }
  | { type: "CLEAR_ALL" }
  | { type: "DELETE_SELECTED" }
  | { type: "SET_THEME"; theme: "dark" | "light" }
  | { type: "SPLIT_SEGMENT"; segId: string; t: number; setBuildFrom?: boolean }
  | { type: "SWITCH_TOOL"; tool: Tool }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "SAVE_HISTORY" }
  | { type: "PUSH_SNAPSHOT"; snapshot: HistorySnapshot };

/** Push the current nodes/segments onto the past stack and clear future. */
function withHistory(state: AppState): AppState {
  const snapshot: HistorySnapshot = { nodes: state.nodes, segments: state.segments };
  const newPast = state.past.length >= MAX_HISTORY
    ? [...state.past.slice(1), snapshot]
    : [...state.past, snapshot];
  return { ...state, past: newPast, future: [] };
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SET_NODES": {
      const s = withHistory(state);
      return { ...s, nodes: action.nodes };
    }
    case "ADD_NODE": {
      const s = withHistory(state);
      return { ...s, nodes: [...s.nodes, action.node] };
    }
    case "UPDATE_NODE":
      return {
        ...state,
        nodes: state.nodes.map((n) =>
          n.id === action.nodeId
            ? { ...n, lat: action.lat, lng: action.lng }
            : n,
        ),
      };
    case "REMOVE_NODE": {
      const s = withHistory(state);
      return {
        ...s,
        nodes: s.nodes.filter((n) => n.id !== action.nodeId),
        segments: s.segments.filter(
          (seg) => seg.fromId !== action.nodeId && seg.toId !== action.nodeId,
        ),
        selectedId: s.selectedId === action.nodeId ? null : s.selectedId,
      };
    }
    case "SET_SEGMENTS": {
      const s = withHistory(state);
      return { ...s, segments: action.segments };
    }
    case "ADD_SEGMENT": {
      const s = withHistory(state);
      return { ...s, segments: [...s.segments, action.segment] };
    }
    case "UPDATE_SEGMENT": {
      const s = withHistory(state);
      return {
        ...s,
        segments: s.segments.map((seg) =>
          seg.id === action.segment.id ? action.segment : seg,
        ),
      };
    }
    case "REMOVE_SEGMENT": {
      const s = withHistory(state);
      return {
        ...s,
        segments: s.segments.filter((seg) => seg.id !== action.segId),
        selectedId: s.selectedId === action.segId ? null : s.selectedId,
      };
    }
    case "UPDATE_SEGMENTS":
      return { ...state, segments: action.updater(state.segments) };
    case "SET_TOOL":
      return { ...state, tool: action.tool };
    case "SWITCH_TOOL":
      return { ...state, tool: action.tool, buildFrom: null };
    case "SET_DEF_LANES_F":
      return { ...state, defLanesF: action.value };
    case "SET_DEF_LANES_B":
      return { ...state, defLanesB: action.value };
    case "SET_DEF_SPEED":
      return { ...state, defSpeed: action.value };
    case "SET_DEF_SURFACE":
      return { ...state, defSurface: action.value };
    case "SET_DEF_DISPLAY_SCALE":
      return { ...state, defDisplayScale: action.value };
    case "SET_ROAD_SCALE":
      return { ...state, roadScale: action.value };
    case "SET_SELECTED_ID":
      return { ...state, selectedId: action.id };
    case "TOGGLE_SELECTED_ID":
      return {
        ...state,
        selectedId: state.selectedId === action.id ? null : action.id,
      };
    case "SET_BUILD_FROM":
      return { ...state, buildFrom: action.node };
    case "SET_HOVERED_NODE_ID":
      return { ...state, hoveredNodeId: action.id };
    case "SET_HOVERED_SEG_ID":
      return { ...state, hoveredSegId: action.id };
    case "SET_HOVERED_HANDLE":
      return { ...state, hoveredHandle: action.handle };
    case "SET_HOVERED_CROSSING_ID":
      return { ...state, hoveredCrossingId: action.id };
    case "SET_MOUSE":
      return { ...state, mouse: action.pos };
    case "SET_EDIT_PANEL":
      return { ...state, editPanel: action.panel };
    case "MOVE_EDIT_PANEL":
      return {
        ...state,
        editPanel: state.editPanel
          ? { ...state.editPanel, x: action.x, y: action.y }
          : null,
      };
    case "SET_PALETTE_OPEN":
      return { ...state, paletteOpen: action.open };
    case "SET_DRAGGING_COEFF":
      return { ...state, draggingCoeff: action.coeff };
    case "SET_DROP_TARGET_SEG_ID":
      return { ...state, dropTargetSegId: action.id };
    case "SET_DRAGGING_CROSSING_FROM_PALETTE":
      return { ...state, draggingCrossingFromPalette: action.value };
    case "SET_DRAGGING_BUS_STOP_FROM_PALETTE":
      return { ...state, draggingBusStopFromPalette: action.value };
    case "SET_DRAGGING_PARKING_FROM_PALETTE":
      return { ...state, draggingParkingFromPalette: action.value };
    case "SET_DRAGGING_CROSSING":
      return { ...state, draggingCrossing: action.value };
    case "SET_DRAGGING_BUS_STOP":
      return { ...state, draggingBusStop: action.value };
    case "SET_DRAGGING_PARKING":
      return { ...state, draggingParking: action.value };
    case "SET_DRAGGING_NODE_ID":
      return { ...state, draggingNodeId: action.id };
    case "SET_THEME":
      return { ...state, theme: action.theme };
    case "CLEAR_HOVER":
      return {
        ...state,
        mouse: null,
        hoveredNodeId: null,
        hoveredSegId: null,
        hoveredHandle: null,
        hoveredCrossingId: null,
      };
    case "CLEAR_ALL": {
      const s = withHistory(state);
      return {
        ...s,
        nodes: [],
        segments: [],
        selectedId: null,
        buildFrom: null,
        editPanel: null,
      };
    }
    case "SPLIT_SEGMENT": {
      const seg = state.segments.find((s) => s.id === action.segId);
      if (!seg) return state;
      const fromNode = state.nodes.find((n) => n.id === seg.fromId);
      const toNode = state.nodes.find((n) => n.id === seg.toId);
      if (!fromNode || !toNode) return state;
      const t = Math.max(0.05, Math.min(0.95, action.t));
      const newNode: RoadNode = {
        id: uid(),
        lat: fromNode.lat + t * (toNode.lat - fromNode.lat),
        lng: fromNode.lng + t * (toNode.lng - fromNode.lng),
      };
      const segBase = {
        lanesForward: seg.lanesForward,
        lanesBackward: seg.lanesBackward,
        speedLimit: seg.speedLimit,
        surface: seg.surface,
        displayScale: seg.displayScale,
        trafficIntensity: seg.trafficIntensity,
        coefficients: seg.coefficients,
      };
      const crossings1 = (seg.pedestrianCrossings ?? [])
        .filter((c) => c.t < t)
        .map((c) => ({ ...c, t: c.t / t }));
      const crossings2 = (seg.pedestrianCrossings ?? [])
        .filter((c) => c.t >= t)
        .map((c) => ({ ...c, t: (c.t - t) / (1 - t) }));
      const busStops1 = (seg.busStops ?? [])
        .filter((b) => b.t < t)
        .map((b) => ({ ...b, t: b.t / t }));
      const busStops2 = (seg.busStops ?? [])
        .filter((b) => b.t >= t)
        .map((b) => ({ ...b, t: (b.t - t) / (1 - t) }));
      const parking1 = (seg.parkingSpaces ?? [])
        .filter((p) => p.t < t)
        .map((p) => ({ ...p, t: p.t / t }));
      const parking2 = (seg.parkingSpaces ?? [])
        .filter((p) => p.t >= t)
        .map((p) => ({ ...p, t: (p.t - t) / (1 - t) }));
      const seg1: RoadSegment = {
        ...segBase,
        id: uid(),
        fromId: seg.fromId,
        toId: newNode.id,
        pedestrianCrossings: crossings1.length ? crossings1 : undefined,
        busStops: busStops1.length ? busStops1 : undefined,
        parkingSpaces: parking1.length ? parking1 : undefined,
      };
      const seg2: RoadSegment = {
        ...segBase,
        id: uid(),
        fromId: newNode.id,
        toId: seg.toId,
        pedestrianCrossings: crossings2.length ? crossings2 : undefined,
        busStops: busStops2.length ? busStops2 : undefined,
        parkingSpaces: parking2.length ? parking2 : undefined,
      };
      const s = withHistory(state);
      return {
        ...s,
        nodes: [...s.nodes, newNode],
        segments: s.segments
          .filter((x) => x.id !== action.segId)
          .concat(seg1, seg2),
        selectedId: null,
        editPanel: null,
        buildFrom: action.setBuildFrom ? newNode : s.buildFrom,
      };
    }
    case "DELETE_SELECTED": {
      if (!state.selectedId) return state;
      const s = withHistory(state);
      const sid = s.selectedId!;
      const isNode = s.nodes.some((n) => n.id === sid);
      if (isNode) {
        return {
          ...s,
          nodes: s.nodes.filter((n) => n.id !== sid),
          segments: s.segments.filter(
            (seg) => seg.fromId !== sid && seg.toId !== sid,
          ),
          selectedId: null,
          editPanel: null,
        };
      }
      return {
        ...s,
        segments: s.segments.filter((seg) => seg.id !== sid),
        selectedId: null,
        editPanel: null,
      };
    }
    case "SAVE_HISTORY": {
      return withHistory(state);
    }
    case "PUSH_SNAPSHOT": {
      const newPast = state.past.length >= MAX_HISTORY
        ? [...state.past.slice(1), action.snapshot]
        : [...state.past, action.snapshot];
      return { ...state, past: newPast, future: [] };
    }
    case "UNDO": {
      if (state.past.length === 0) return state;
      const newPast = [...state.past];
      const snapshot = newPast.pop()!;
      const currentSnapshot: HistorySnapshot = { nodes: state.nodes, segments: state.segments };
      const newFuture = [currentSnapshot, ...state.future].slice(0, MAX_HISTORY);
      return {
        ...state,
        past: newPast,
        future: newFuture,
        nodes: snapshot.nodes,
        segments: snapshot.segments,
        selectedId: null,
        buildFrom: null,
        editPanel: null,
      };
    }
    case "REDO": {
      if (state.future.length === 0) return state;
      const newFuture = [...state.future];
      const snapshot = newFuture.shift()!;
      const currentSnapshot: HistorySnapshot = { nodes: state.nodes, segments: state.segments };
      const newPast = [...state.past, currentSnapshot].slice(-MAX_HISTORY);
      return {
        ...state,
        past: newPast,
        future: newFuture,
        nodes: snapshot.nodes,
        segments: snapshot.segments,
        selectedId: null,
        buildFrom: null,
        editPanel: null,
      };
    }
    default:
      return state;
  }
}
