# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev # Start dev server with HMR
npm run build # Type-check + build for production
npm run lint # Run ESLint
npm run preview # Preview production build
```

No test suite is configured.

## Architecture

This is a React + TypeScript canvas app for drawing road networks on a Leaflet map. The codebase is organized into focused modules:

**`src/types.ts`** — All shared types and interfaces: `Tool`, `SurfaceType`, `CoefficientType`, `RoadNode`, `ScreenNode`, `RoadSegment`, `Vec2`, etc.

**`src/constants.ts`** — Configuration constants: `LANE_WIDTH`, `HANDLE_RADIUS`, `MAP_CENTER`, `COEFF` (coefficient metadata), `SURFACE` (surface colors/labels), `SPEED_PRESETS`.

**`src/utils/`** — Pure utility functions:
- `geometry.ts` — Distance, projection, hit-testing helpers (`dist`, `distToSegment`, `nearestNodeSq`, `nearestSegment`, `nearestCrossing`, etc.)
- `coordinates.ts` — Leaflet coordinate conversion (`toScreen`, `toGeo`, `getScale`), plus `uid()` ID generator
- `styles.ts` — Shared `chip()` CSS helper for toggle buttons

**`src/rendering/canvas.ts`** — Canvas 2D rendering: `render(opts: RenderOptions)` draws roads, intersections, lane markings, crossings, coefficient markers, handles, and overlays.

**`src/state/reducer.ts`** — `useReducer`-based state management: `AppState` (25 fields), `AppAction` discriminated union, `appReducer`. Replaces individual `useState` calls.

**`src/hooks/`** — Custom hooks encapsulating side effects and event handling:
- `useCanvasRenderer.ts` — Canvas render on state changes + `renderFromRef` callback
- `useMap.ts` — Leaflet map initialization, resize observer, wheel zoom
- `useKeyboardShortcuts.ts` — R/S/D/X tool switching, Escape, Delete
- `useCanvasEvents.ts` — Mouse handlers (click, move, down, context menu) for all tools
- `useDragAndDrop.ts` — Drag-and-drop for coefficients/crossings, panning, crossing repositioning

**`src/components/`** — React UI components:
- `Toolbar.tsx` — Top toolbar (tools, lane/speed/surface defaults, sliders, clear, stats)
- `RoadEditPanel.tsx` — Floating panel for editing segment properties (right-click)
- `ObstaclePalette.tsx` — Draggable coefficient/crossing sidebar
- `SelectionInfoPanel.tsx` — Selection details display
- `LaneCounter.tsx`, `SectionLabel.tsx` — Small reusable UI helpers
- `Legend.tsx` — Keyboard shortcut overlay

**`src/App.tsx`** — Thin orchestrator (~190 lines): sets up `useReducer`, wires hooks, computes derived values, renders layout.

**Data model** — Two arrays in reducer state:
- `RoadNode[]` — intersection/endpoint positions `{ id, lat, lng }`
- `RoadSegment[]` — edges between nodes with `{ lanesForward, lanesBackward, speedLimit, surface, coefficients, pedestrianCrossings }`

**Interaction flow:**
- Mouse events on the canvas dispatch to tool-specific logic inside `useCanvasEvents`
- State is read inside callbacks via `stateRef` (synced each render with `useLayoutEffect`) to avoid stale closure issues
- Tools: `road` (click to place nodes and draw segments), `select` (click to inspect), `delete` (click to remove), `crossing` (click to place pedestrian crossings)
- Connection handles (N/E/S/W) appear on hover; clicking one starts or extends a road chain

**Keyboard shortcuts:** `R` road · `S` select · `D` delete · `X` crossing · `Esc` cancel · `Delete`/`Backspace` remove selected
