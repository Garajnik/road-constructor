import { LANE_WIDTH, SNAP_EXTRA, HANDLE_OFFSET, BUS_STOP_LENGTH_T } from "../constants";
import type {
  Vec2,
  ScreenNode,
  RoadSegment,
  RoadFeatureSide,
  PedestrianCrossing,
  BusStop,
  ParkingSpace,
} from "../types";

export function totalLanes(seg: RoadSegment) {
  return seg.lanesForward + seg.lanesBackward;
}

export function roadWidth(seg: RoadSegment, scale: number) {
  const segScale = seg.displayScale ?? 1;
  return totalLanes(seg) * LANE_WIDTH * scale * segScale;
}

export function dist(a: Vec2, b: Vec2) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return dist(p, a);
  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2),
  );
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy });
}

/** Project point onto segment, return t in [0,1] and distance. */
export function projectToSegment(
  p: Vec2,
  a: Vec2,
  b: Vec2,
): { t: number; dist: number } {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return { t: 0, dist: dist(p, a) };
  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2),
  );
  const proj = { x: a.x + t * dx, y: a.y + t * dy };
  return { t, dist: dist(p, proj) };
}

export function nodeSegments(segs: RoadSegment[], nodeId: string) {
  return segs.filter((s) => s.fromId === nodeId || s.toId === nodeId);
}

export function alreadyConnected(segs: RoadSegment[], a: string, b: string) {
  return segs.some(
    (s) => (s.fromId === a && s.toId === b) || (s.fromId === b && s.toId === a),
  );
}

export function nodeHalfSize(
  nodeId: string,
  segs: RoadSegment[],
  scale: number,
): number {
  const conn = nodeSegments(segs, nodeId);
  if (conn.length === 0) return LANE_WIDTH * scale;
  return Math.max(...conn.map((s) => roadWidth(s, scale))) / 2 + 4 * scale;
}

/**
 * Compute the orientation angle (radians) for a node based on connected segments.
 * The node box will be rotated by this angle to align with the road direction.
 * Uses only the dominant segment's direction (by lane count) so nodes with two
 * inputs (e.g. middle of a straight road) orient correctly, not averaged.
 */
export function nodeOrientationAngle(
  nodeId: string,
  segs: RoadSegment[],
  nodeMap: Map<string, Vec2>,
): number {
  const conn = nodeSegments(segs, nodeId);
  if (conn.length === 0) return 0;

  const dominant = conn.reduce((a, b) =>
    totalLanes(a) >= totalLanes(b) ? a : b,
  );

  const otherId =
    dominant.fromId === nodeId ? dominant.toId : dominant.fromId;
  const other = nodeMap.get(otherId);
  const node = nodeMap.get(nodeId);
  if (!other || !node) return 0;

  const dx = node.x - other.x,
    dy = node.y - other.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return 0;

  return Math.atan2(dy, dx);
}

function handleOffset(idx: number, d: number): Vec2 {
  if (idx === 0) return { x: 0, y: -d };
  if (idx === 1) return { x: d, y: 0 };
  if (idx === 2) return { x: 0, y: d };
  return { x: -d, y: 0 };
}

export function handlePos(
  node: Vec2,
  hs: number,
  idx: number,
  scale: number,
  angle = 0,
): Vec2 {
  const d = hs + HANDLE_OFFSET * scale;
  const off = handleOffset(idx, d);
  if (angle === 0) {
    return { x: node.x + off.x, y: node.y + off.y };
  }
  const cosA = Math.cos(angle),
    sinA = Math.sin(angle);
  return {
    x: node.x + off.x * cosA - off.y * sinA,
    y: node.y + off.x * sinA + off.y * cosA,
  };
}

export function nearestNodeSq(
  nodes: ScreenNode[],
  segs: RoadSegment[],
  p: Vec2,
  scale: number,
  exclude?: string,
): ScreenNode | null {
  let best: ScreenNode | null = null,
    bestD = Infinity;
  for (const n of nodes) {
    if (n.id === exclude) continue;
    const hs = nodeHalfSize(n.id, segs, scale);
    const snap = hs + SNAP_EXTRA * scale;
    const d = dist(n, p);
    if (d < snap && d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}

export function nearestSegment(
  nodeMap: Map<string, ScreenNode>,
  segs: RoadSegment[],
  p: Vec2,
  fallback: number,
  scale: number,
): RoadSegment | null {
  let best: RoadSegment | null = null,
    bestD = Infinity;
  for (const s of segs) {
    const a = nodeMap.get(s.fromId),
      b = nodeMap.get(s.toId);
    if (!a || !b) continue;
    const d = distToSegment(p, a, b);
    if (d < Math.max(roadWidth(s, scale) / 2, fallback * scale) && d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

/** Find if click is on a pedestrian crossing (for delete). */
export function nearestCrossing(
  nodeMap: Map<string, ScreenNode>,
  segs: RoadSegment[],
  p: Vec2,
  scale: number,
): { seg: RoadSegment; crossing: PedestrianCrossing } | null {
  let best: { seg: RoadSegment; crossing: PedestrianCrossing } | null = null;
  let bestD = Infinity;
  for (const s of segs) {
    const crossings = s.pedestrianCrossings;
    if (!crossings?.length) continue;
    const a = nodeMap.get(s.fromId),
      b = nodeMap.get(s.toId);
    if (!a || !b) continue;
    const rw = roadWidth(s, scale);
    const hitRadius = rw * 0.7;

    for (const cross of crossings) {
      const cx = a.x + cross.t * (b.x - a.x);
      const cy = a.y + cross.t * (b.y - a.y);
      const d = dist(p, { x: cx, y: cy });
      if (d < hitRadius && d < bestD) {
        bestD = d;
        best = { seg: s, crossing: cross };
      }
    }
  }
  return best;
}

/** Find nearest segment and return projection parameter t (0..1). */
export function nearestSegmentWithT(
  nodeMap: Map<string, ScreenNode>,
  segs: RoadSegment[],
  p: Vec2,
  fallback: number,
  scale: number,
): { seg: RoadSegment; t: number } | null {
  let best: { seg: RoadSegment; t: number } | null = null,
    bestD = Infinity;
  for (const s of segs) {
    const a = nodeMap.get(s.fromId),
      b = nodeMap.get(s.toId);
    if (!a || !b) continue;
    const { t, dist: d } = projectToSegment(p, a, b);
    if (d < Math.max(roadWidth(s, scale) / 2, fallback * scale) && d < bestD) {
      bestD = d;
      best = { seg: s, t };
    }
  }
  return best;
}

/**
 * Determine which side of the road (left/right) a point is on.
 * "left" = positive perpendicular direction (left when looking from A to B).
 */
export function detectSide(
  p: Vec2,
  a: Vec2,
  b: Vec2,
): RoadFeatureSide {
  const dx = b.x - a.x, dy = b.y - a.y;
  const cross = (p.x - a.x) * dy - (p.y - a.y) * dx;
  return cross >= 0 ? "right" : "left";
}

/** Find if click is on a bus stop. */
export function nearestBusStop(
  nodeMap: Map<string, ScreenNode>,
  segs: RoadSegment[],
  p: Vec2,
  scale: number,
): { seg: RoadSegment; busStop: BusStop } | null {
  let best: { seg: RoadSegment; busStop: BusStop } | null = null;
  let bestD = Infinity;
  for (const s of segs) {
    const stops = s.busStops;
    if (!stops?.length) continue;
    const a = nodeMap.get(s.fromId), b = nodeMap.get(s.toId);
    if (!a || !b) continue;
    const rw = roadWidth(s, scale);
    const hitRadius = rw * 0.9;
    for (const stop of stops) {
      const cx = a.x + stop.t * (b.x - a.x);
      const cy = a.y + stop.t * (b.y - a.y);
      const d = dist(p, { x: cx, y: cy });
      if (d < hitRadius && d < bestD) {
        bestD = d;
        best = { seg: s, busStop: stop };
      }
    }
  }
  return best;
}

/** Find if click is on a parking space. */
export function nearestParkingSpace(
  nodeMap: Map<string, ScreenNode>,
  segs: RoadSegment[],
  p: Vec2,
  scale: number,
): { seg: RoadSegment; parkingSpace: ParkingSpace } | null {
  let best: { seg: RoadSegment; parkingSpace: ParkingSpace } | null = null;
  let bestD = Infinity;
  for (const s of segs) {
    const spaces = s.parkingSpaces;
    if (!spaces?.length) continue;
    const a = nodeMap.get(s.fromId), b = nodeMap.get(s.toId);
    if (!a || !b) continue;
    const rw = roadWidth(s, scale);
    const hitRadius = rw * 0.9;
    for (const space of spaces) {
      const cx = a.x + space.t * (b.x - a.x);
      const cy = a.y + space.t * (b.y - a.y);
      const d = dist(p, { x: cx, y: cy });
      if (d < hitRadius && d < bestD) {
        bestD = d;
        best = { seg: s, parkingSpace: space };
      }
    }
  }
  return best;
}
