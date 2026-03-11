import { useEffect, useCallback } from "react";
import type L from "leaflet";
import { getScale, toScreen } from "../utils/coordinates";
import { render } from "../rendering/canvas";
import type { Vec2 } from "../types";
import type { AppState } from "../state/reducer";

type RefState = Pick<
  AppState,
  | "nodes"
  | "segments"
  | "tool"
  | "selectedId"
  | "buildFrom"
  | "hoveredNodeId"
  | "hoveredSegId"
  | "hoveredHandle"
  | "mouse"
  | "roadScale"
  | "dropTargetSegId"
  | "hoveredCpSegId"
  | "draggingCpSegId"
  | "theme"
>;

/** Convert each segment's geo-space cp to screen-space. */
function buildCpMap(map: L.Map, segments: AppState["segments"]): Map<string, Vec2> {
  const result = new Map<string, Vec2>();
  for (const seg of segments) {
    if (!seg.cp) continue;
    const pt = map.latLngToContainerPoint([seg.cp.lat, seg.cp.lng]);
    result.set(seg.id, { x: pt.x, y: pt.y });
  }
  return result;
}

export function useCanvasRenderer(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  mapRef: React.RefObject<L.Map | null>,
  stateRef: React.RefObject<RefState>,
  state: RefState,
) {
  const renderFromRef = useCallback((map: L.Map) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const s = stateRef.current;
    const scale = getScale(map.getZoom(), s.roadScale);
    const screenNodes = s.nodes.map((n) => toScreen(map, n));
    const screenBf = s.buildFrom ? toScreen(map, s.buildFrom) : null;
    const cpMap = buildCpMap(map, s.segments);
    render({
      ctx: canvas.getContext("2d")!,
      nodes: screenNodes,
      segments: s.segments,
      selectedId: s.selectedId,
      hoveredNodeId: s.hoveredNodeId,
      hoveredSegId: s.hoveredSegId,
      hoveredHandle: s.hoveredHandle,
      tool: s.tool,
      buildFrom: screenBf,
      mouse: s.mouse,
      scale,
      dropTargetSegId: s.dropTargetSegId,
      cpMap,
      hoveredCpSegId: s.hoveredCpSegId,
      draggingCpSegId: s.draggingCpSegId,
      theme: s.theme,
      triggerRender: () => renderFromRef(map),
    });
  }, [canvasRef, stateRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const map = mapRef.current;
    if (!canvas || !map) return;
    const scale = getScale(map.getZoom(), state.roadScale);
    const screenNodes = state.nodes.map((n) => toScreen(map, n));
    const screenBf = state.buildFrom ? toScreen(map, state.buildFrom) : null;
    const cpMap = buildCpMap(map, state.segments);
    render({
      ctx: canvas.getContext("2d")!,
      nodes: screenNodes,
      segments: state.segments,
      selectedId: state.selectedId,
      hoveredNodeId: state.hoveredNodeId,
      hoveredSegId: state.hoveredSegId,
      hoveredHandle: state.hoveredHandle,
      tool: state.tool,
      buildFrom: screenBf,
      mouse: state.mouse,
      scale,
      dropTargetSegId: state.dropTargetSegId,
      cpMap,
      hoveredCpSegId: state.hoveredCpSegId,
      draggingCpSegId: state.draggingCpSegId,
      theme: state.theme,
      triggerRender: () => { const m = mapRef.current; if (m) renderFromRef(m); },
    });
  }, [
    canvasRef,
    mapRef,
    state.nodes,
    state.segments,
    state.selectedId,
    state.hoveredNodeId,
    state.hoveredSegId,
    state.hoveredHandle,
    state.tool,
    state.buildFrom,
    state.mouse,
    state.roadScale,
    state.dropTargetSegId,
    state.hoveredCpSegId,
    state.draggingCpSegId,
    state.theme,
  ]);

  return renderFromRef;
}
