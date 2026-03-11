import { LANE_WIDTH, SNAP_EXTRA, HANDLE_OFFSET } from "../constants";
import type {
  Vec2,
  ScreenNode,
  RoadSegment,
  RoadFeatureSide,
  PedestrianCrossing,
  BusStop,
  ParkingSpace,
} from "../types";

// ── Quadratic Bézier helpers ──────────────────────────────────────────────────

/** Point on quadratic Bézier curve at parameter t ∈ [0,1]. */
export function bezierPoint(a: Vec2, cp: Vec2, b: Vec2, t: number): Vec2 {
  const mt = 1 - t;
  return {
    x: mt * mt * a.x + 2 * mt * t * cp.x + t * t * b.x,
    y: mt * mt * a.y + 2 * mt * t * cp.y + t * t * b.y,
  };
}

/** Tangent direction (not normalised) on quadratic Bézier at parameter t. */
export function bezierTangent(a: Vec2, cp: Vec2, b: Vec2, t: number): Vec2 {
  const mt = 1 - t;
  return {
    x: 2 * mt * (cp.x - a.x) + 2 * t * (b.x - cp.x),
    y: 2 * mt * (cp.y - a.y) + 2 * t * (b.y - cp.y),
  };
}

/** Approximate nearest distance from point p to a quadratic Bézier curve (30 samples). */
export function distToCurve(p: Vec2, a: Vec2, cp: Vec2, b: Vec2): number {
  const N = 30;
  let best = Infinity;
  for (let i = 0; i <= N; i++) {
    const pt = bezierPoint(a, cp, b, i / N);
    const d = dist(p, pt);
    if (d < best) best = d;
  }
  return best;
}

/**
 * Approximate arc-length t for nearest point on a quadratic Bézier curve.
 * Returns t ∈ [0,1] for the closest sample out of N.
 */
export function nearestTOnCurve(p: Vec2, a: Vec2, cp: Vec2, b: Vec2): number {
  const N = 60;
  let bestT = 0;
  let bestD = Infinity;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const pt = bezierPoint(a, cp, b, t);
    const d = dist(p, pt);
    if (d < bestD) {
      bestD = d;
      bestT = t;
    }
  }
  return bestT;
}

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
 * When the dominant segment is curved, uses the Bézier tangent at the endpoint.
 */
export function nodeOrientationAngle(
  nodeId: string,
  segs: RoadSegment[],
  nodeMap: Map<string, Vec2>,
  cpMap?: Map<string, Vec2>,
): number {
  const conn = nodeSegments(segs, nodeId);
  if (conn.length === 0) return 0;

  const dominant = conn.reduce((a, b) =>
    totalLanes(a) >= totalLanes(b) ? a : b,
  );

  const node = nodeMap.get(nodeId);
  if (!node) return 0;

  const cp = cpMap?.get(dominant.id);
  if (cp) {
    const fromId = dominant.fromId;
    const toId = dominant.toId;
    const fromNode = nodeMap.get(fromId);
    const toNode = nodeMap.get(toId);
    if (fromNode && toNode) {
      // t=0 is fromId, t=1 is toId — tangent points from from→to
      const tAtNode = nodeId === fromId ? 0 : 1;
      const tan = bezierTangent(fromNode, cp, toNode, tAtNode);
      const len = Math.hypot(tan.x, tan.y);
      if (len > 1e-6) {
        // angle pointing away from the other node (same convention as chord)
        const sign = nodeId === fromId ? -1 : 1;
        return Math.atan2(sign * tan.y, sign * tan.x);
      }
    }
  }

  const otherId =
    dominant.fromId === nodeId ? dominant.toId : dominant.fromId;
  const other = nodeMap.get(otherId);
  if (!other) return 0;

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
  cpMap?: Map<string, Vec2>,
): RoadSegment | null {
  let best: RoadSegment | null = null,
    bestD = Infinity;
  for (const s of segs) {
    const a = nodeMap.get(s.fromId),
      b = nodeMap.get(s.toId);
    if (!a || !b) continue;
    const cp = cpMap?.get(s.id);
    const d = cp ? distToCurve(p, a, cp, b) : distToSegment(p, a, b);
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
  cpMap?: Map<string, Vec2>,
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
    const cp = cpMap?.get(s.id);

    for (const cross of crossings) {
      const pt = cp
        ? bezierPoint(a, cp, b, cross.t)
        : { x: a.x + cross.t * (b.x - a.x), y: a.y + cross.t * (b.y - a.y) };
      const d = dist(p, pt);
      if (d < hitRadius && d < bestD) {
        bestD = d;
        best = { seg: s, crossing: cross };
      }
    }
  }
  return best;
}

/** Find nearest segment and return projection parameter t (0..1). Curve-aware when cpMap is supplied. */
export function nearestSegmentWithT(
  nodeMap: Map<string, ScreenNode>,
  segs: RoadSegment[],
  p: Vec2,
  fallback: number,
  scale: number,
  cpMap?: Map<string, Vec2>,
): { seg: RoadSegment; t: number } | null {
  let best: { seg: RoadSegment; t: number } | null = null,
    bestD = Infinity;
  for (const s of segs) {
    const a = nodeMap.get(s.fromId),
      b = nodeMap.get(s.toId);
    if (!a || !b) continue;
    const cp = cpMap?.get(s.id);
    let t: number;
    let d: number;
    if (cp) {
      t = nearestTOnCurve(p, a, cp, b);
      d = dist(p, bezierPoint(a, cp, b, t));
    } else {
      const proj = projectToSegment(p, a, b);
      t = proj.t;
      d = proj.dist;
    }
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
  cpMap?: Map<string, Vec2>,
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
    const cp = cpMap?.get(s.id);
    for (const stop of stops) {
      const pt = cp
        ? bezierPoint(a, cp, b, stop.t)
        : { x: a.x + stop.t * (b.x - a.x), y: a.y + stop.t * (b.y - a.y) };
      const d = dist(p, pt);
      if (d < hitRadius && d < bestD) {
        bestD = d;
        best = { seg: s, busStop: stop };
      }
    }
  }
  return best;
}

/** Hit radius for speed limit icon (matches canvas icon size). */
const SPEED_LIMIT_ICON_HIT_RADIUS_SCALE = 14;

/** Find if click is on the speed limit icon of a segment. */
export function nearestSpeedLimitMarker(
  nodeMap: Map<string, ScreenNode>,
  segs: RoadSegment[],
  p: Vec2,
  scale: number,
  cpMap?: Map<string, Vec2>,
): RoadSegment | null {
  let best: RoadSegment | null = null;
  let bestD = Infinity;
  for (const s of segs) {
    const a = nodeMap.get(s.fromId),
      b = nodeMap.get(s.toId);
    if (!a || !b) continue;
    const segLen = dist(a, b);
    if (segLen < 2) continue;
    const cp = cpMap?.get(s.id);
    const hsA = nodeHalfSize(s.fromId, segs, scale);
    const hsB = nodeHalfSize(s.toId, segs, scale);
    const margin = 4 * scale;
    const tA = (hsA + margin) / segLen;
    const tB = 1 - (hsB + margin) / segLen;
    if (tA >= tB) continue;
    const tMid = (tA + tB) / 2;
    const midPt = cp
      ? bezierPoint(a, cp, b, tMid)
      : { x: a.x + tMid * (b.x - a.x), y: a.y + tMid * (b.y - a.y) };
    const hitRadius = SPEED_LIMIT_ICON_HIT_RADIUS_SCALE * scale;
    const d = dist(p, midPt);
    if (d < hitRadius && d < bestD) {
      bestD = d;
      best = s;
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
  cpMap?: Map<string, Vec2>,
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
    const cp = cpMap?.get(s.id);
    for (const space of spaces) {
      const pt = cp
        ? bezierPoint(a, cp, b, space.t)
        : { x: a.x + space.t * (b.x - a.x), y: a.y + space.t * (b.y - a.y) };
      const d = dist(p, pt);
      if (d < hitRadius && d < bestD) {
        bestD = d;
        best = { seg: s, parkingSpace: space };
      }
    }
  }
  return best;
}
