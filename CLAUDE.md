# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server with HMR
npm run build    # Type-check + build for production
npm run lint     # Run ESLint
npm run preview  # Preview production build
```

No test suite is configured.

## Architecture

This is a single-file React + TypeScript canvas app for drawing road networks. All logic lives in [src/App.tsx](src/App.tsx).

**Data model** — two arrays in React state:
- `RoadNode[]` — intersection/endpoint positions `{ id, x, y }`
- `RoadSegment[]` — edges between nodes with `{ lanesForward, lanesBackward, speedLimit, surface }`

**Rendering** — a single `render()` function draws everything to a `<canvas>` via the 2D API. It is called in a `useEffect` whenever any relevant state changes. The canvas resizes via `ResizeObserver`.

**Interaction flow:**
- Mouse events on the canvas dispatch to tool-specific logic inside `handleClick` / `handleMouseMove` / `handleContextMenu`
- State is read inside callbacks via `stateRef` (synced each render with `useLayoutEffect`) to avoid stale closure issues
- Tools: `road` (click to place nodes and draw segments), `select` (click to inspect), `delete` (click to remove)
- Connection handles (N/E/S/W) appear on hover; clicking one starts or extends a road chain

**UI components** — all inline in App.tsx:
- `RoadEditPanel` — floating panel (right-click a road) to edit speed, surface, lane counts
- `LaneCounter`, `SectionLabel` — small stateless helpers
- Toolbar and selection info panel are JSX inside `App`

**Key constants** (top of App.tsx): `LANE_WIDTH`, `HANDLE_RADIUS`, `HANDLE_OFFSET`, `SNAP_EXTRA`, `MIN_SEGMENT_LENGTH`

**Keyboard shortcuts:** `R` road · `S` select · `D` delete · `Esc` cancel · `Delete`/`Backspace` remove selected
