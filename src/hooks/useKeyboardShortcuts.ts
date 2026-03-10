import { useEffect } from "react";
import type { AppAction, AppState } from "../state/reducer";

export function useKeyboardShortcuts(
  dispatch: React.Dispatch<AppAction>,
  stateRef: React.RefObject<Pick<AppState, "selectedId">>,
  zoomIn: () => void,
  zoomOut: () => void,
) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dispatch({ type: "SET_BUILD_FROM", node: null });
        dispatch({ type: "SET_SELECTED_ID", id: null });
        dispatch({ type: "SET_EDIT_PANEL", panel: null });
      }
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "z") {
          e.preventDefault();
          dispatch({ type: "UNDO" });
        }
        if (e.key === "y") {
          e.preventDefault();
          dispatch({ type: "REDO" });
        }
        return;
      }
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        zoomIn();
      }
      if (e.key === "-") {
        e.preventDefault();
        zoomOut();
      }
      if (e.key === "r") dispatch({ type: "SWITCH_TOOL", tool: "road" });
      if (e.key === "s") dispatch({ type: "SWITCH_TOOL", tool: "select" });
      if (e.key === "d") dispatch({ type: "SWITCH_TOOL", tool: "delete" });
      if (e.key === "x") dispatch({ type: "SWITCH_TOOL", tool: "crossing" });
      if (e.key === "b") dispatch({ type: "SWITCH_TOOL", tool: "bus_stop" });
      if (e.key === "p") dispatch({ type: "SWITCH_TOOL", tool: "parking" });
      if (e.key === "a") dispatch({ type: "SWITCH_TOOL", tool: "split" });
      if (e.key === "Delete" || e.key === "Backspace") {
        const { selectedId: sid } = stateRef.current;
        if (!sid) return;
        e.preventDefault();
        dispatch({ type: "DELETE_SELECTED" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch, stateRef, zoomIn, zoomOut]);
}
