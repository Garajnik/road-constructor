import { useEffect, useCallback } from "react";
import type L from "leaflet";
import { getScale, toScreen } from "../utils/coordinates";
import { render } from "../rendering/canvas";
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
>;

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
    });
  }, [canvasRef, stateRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const map = mapRef.current;
    if (!canvas || !map) return;
    const scale = getScale(map.getZoom(), state.roadScale);
    const screenNodes = state.nodes.map((n) => toScreen(map, n));
    const screenBf = state.buildFrom ? toScreen(map, state.buildFrom) : null;
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
  ]);

  return renderFromRef;
}
