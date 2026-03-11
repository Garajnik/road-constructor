import { LANE_WIDTH, HANDLE_RADIUS, COEFF, SURFACE, POCKET_WIDTH_FACTOR, BUS_STOP_LENGTH_T, CROSSING_DEFAULT_WIDTH } from "../constants";
import type {
  Vec2,
  ScreenNode,
  RoadSegment,
  HoveredHandle,
  Tool,
} from "../types";
import {
  totalLanes,
  roadWidth,
  dist,
  nodeSegments,
  nodeHalfSize,
  nodeOrientationAngle,
  handlePos,
  nearestNodeSq,
  bezierPoint,
  bezierTangent,
} from "../utils/geometry";
import slopeSvgUrl from "../assets/slope.svg?url";
import speedLimitSvgUrl from "../assets/SpeedLimit.svg?url";

const _imgCache = new Map<string, HTMLImageElement | "loading">();

function loadImg(url: string, onLoad?: () => void): HTMLImageElement | null {
  const cached = _imgCache.get(url);
  if (cached && cached !== "loading") return cached;
  if (!cached) {
    _imgCache.set(url, "loading");
    const img = new Image();
    img.onload = () => {
      _imgCache.set(url, img);
      onLoad?.();
    };
    img.src = url;
  }
  return null;
}

export interface RenderOptions {
  ctx: CanvasRenderingContext2D;
  nodes: ScreenNode[];
  segments: RoadSegment[];
  selectedId: string | null;
  hoveredNodeId: string | null;
  hoveredSegId: string | null;
  hoveredHandle: HoveredHandle | null;
  tool: Tool;
  buildFrom: ScreenNode | null;
  mouse: Vec2 | null;
  scale: number;
  dropTargetSegId: string | null;
  /** Screen-space Bézier control points keyed by segment ID. */
  cpMap?: Map<string, Vec2>;
  /** Segment ID whose CP handle is currently hovered. */
  hoveredCpSegId?: string | null;
  /** Segment ID whose CP handle is currently being dragged. */
  draggingCpSegId?: string | null;
  theme?: "dark" | "light";
  triggerRender?: () => void;
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  angle: number,
  size = 12,
) {
  const fx = Math.cos(angle),
    fy = Math.sin(angle);
  const lx = -Math.sin(angle),
    ly = Math.cos(angle);
  const h = size * 0.5,
    w = size * 0.35;
  ctx.beginPath();
  ctx.moveTo(cx - fx * h, cy - fy * h);
  ctx.lineTo(cx + fx * h, cy + fy * h);
  ctx.moveTo(cx + fx * h, cy + fy * h);
  ctx.lineTo(cx + fx * h - fx * w + lx * w, cy + fy * h - fy * w + ly * w);
  ctx.moveTo(cx + fx * h, cy + fy * h);
  ctx.lineTo(cx + fx * h - fx * w - lx * w, cy + fy * h - fy * w - ly * w);
  ctx.stroke();
}

/**
 * Compute the sub-Bézier control point for a quadratic curve trimmed to [tA, tB].
 * Uses de Casteljau subdivision.
 */
function subBezierCp(a: Vec2, cp: Vec2, b: Vec2, tA: number, tB: number): Vec2 {
  // Right portion [tA, 1]: R0=B(tA), R1=(1-tA)*cp+tA*b, R2=b
  const r1 = { x: (1 - tA) * cp.x + tA * b.x, y: (1 - tA) * cp.y + tA * b.y };
  // Sub-curve [tA, tB] corresponds to t'=(tB-tA)/(1-tA) on right portion
  const tp = (1 - tA) > 1e-9 ? (tB - tA) / (1 - tA) : 0;
  // Left portion of right portion: control = lerp(R0, R1, tp)
  const r0 = bezierPoint(a, cp, b, tA);
  return { x: (1 - tp) * r0.x + tp * r1.x, y: (1 - tp) * r0.y + tp * r1.y };
}

/** Build a canvas path along a segment (straight or Bézier), trimmed by hsA/hsB. */
function segmentPath(
  ctx: CanvasRenderingContext2D,
  a: Vec2,
  b: Vec2,
  cp: Vec2 | undefined,
  hsA: number,
  hsB: number,
) {
  const segLen = dist(a, b);
  if (segLen < 2) return;
  if (cp) {
    const tA = hsA / segLen;
    const tB = 1 - hsB / segLen;
    if (tA >= tB) return;
    const p0 = bezierPoint(a, cp, b, tA);
    const p2 = bezierPoint(a, cp, b, tB);
    const subCp = subBezierCp(a, cp, b, tA, tB);
    ctx.moveTo(p0.x, p0.y);
    ctx.quadraticCurveTo(subCp.x, subCp.y, p2.x, p2.y);
  } else {
    const ux = (b.x - a.x) / segLen, uy = (b.y - a.y) / segLen;
    ctx.moveTo(a.x + ux * hsA, a.y + uy * hsA);
    ctx.lineTo(b.x - ux * hsB, b.y - uy * hsB);
  }
}

export function render(opts: RenderOptions) {
  const {
    ctx,
    nodes,
    segments,
    selectedId,
    hoveredNodeId,
    hoveredSegId,
    hoveredHandle,
    tool,
    buildFrom,
    mouse,
    scale,
    dropTargetSegId,
    cpMap,
    hoveredCpSegId,
    draggingCpSegId,
    theme = "dark",
    triggerRender,
  } = opts;

  const light = theme === "light";
  const textColor = light ? "#1a1a2e" : "rgba(255,255,255,0.9)";
  const textMuted = light ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.22)";
  const crossingStripe = light ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.95)";
  const nodeHoverStroke = light ? "#64748b" : "#aaa";
  const segHoverBorder = light ? "#94a3b8" : "#2a2a40";

  const W = ctx.canvas.width,
    H = ctx.canvas.height;
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const hsMap = new Map<string, number>();
  for (const n of nodes) hsMap.set(n.id, nodeHalfSize(n.id, segments, scale));

  ctx.clearRect(0, 0, W, H);

  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";

  // ── Road bodies (trimmed to intersection box edges) ──
  for (const seg of segments) {
    const a = nodeMap.get(seg.fromId),
      b = nodeMap.get(seg.toId);
    if (!a || !b) continue;
    const rw = roadWidth(seg, scale);
    const { color, border } = SURFACE[seg.surface];
    const isSel = seg.id === selectedId;
    const isHov = seg.id === hoveredSegId;
    const cp = cpMap?.get(seg.id);

    const segLen = dist(a, b);
    if (segLen < 2) continue;
    const hsA = hsMap.get(seg.fromId) ?? 0;
    const hsB = hsMap.get(seg.toId) ?? 0;

    ctx.beginPath();
    segmentPath(ctx, a, b, cp, hsA, hsB);
    ctx.strokeStyle = isSel ? "#1e4a90" : isHov ? segHoverBorder : border;
    ctx.lineWidth = rw + 6 * scale;
    ctx.stroke();

    ctx.beginPath();
    segmentPath(ctx, a, b, cp, hsA, hsB);
    ctx.strokeStyle = isSel ? "#2a5080" : color;
    ctx.lineWidth = rw;
    ctx.stroke();
  }

  // ── Square intersection boxes (oriented to match road segments) ──
  for (const node of nodes) {
    const hs = hsMap.get(node.id) ?? LANE_WIDTH * scale;
    const isSel = node.id === selectedId;
    const isHov = node.id === hoveredNodeId;
    const isHandleHov = hoveredHandle?.nodeId === node.id;
    const segs = nodeSegments(segments, node.id);
    const isIntersection = segs.length >= 3;

    const dominant =
      segs.length > 0
        ? segs.reduce((a, b) => (totalLanes(a) >= totalLanes(b) ? a : b))
        : null;
    const { color, border } = dominant
      ? SURFACE[dominant.surface]
      : SURFACE.asphalt;

    const angle = nodeOrientationAngle(node.id, segments, nodeMap, cpMap);
    ctx.save();
    ctx.translate(node.x, node.y);
    ctx.rotate(angle);

    const pad = 10 * scale;
    if (isIntersection) {
      ctx.fillStyle = "rgba(255,160,0,0.08)";
      ctx.fillRect(-hs - pad, -hs - pad, (hs + pad) * 2, (hs + pad) * 2);
    }

    const borderPad = 3 * scale;
    ctx.fillStyle = isSel ? "#1e4a90" : border;
    ctx.fillRect(-hs - borderPad, -hs - borderPad, (hs + borderPad) * 2, (hs + borderPad) * 2);

    ctx.fillStyle = isSel ? "#2a5080" : color;
    ctx.fillRect(-hs, -hs, hs * 2, hs * 2);

    if (isSel || isHov || isHandleHov) {
      ctx.strokeStyle = isSel ? "#2563eb" : isIntersection ? "#ea580c" : nodeHoverStroke;
      ctx.lineWidth = (isHov || isHandleHov ? 1.5 : 2) * scale;
      ctx.strokeRect(-hs - 0.5, -hs - 0.5, hs * 2 + 1, hs * 2 + 1);
    }

    if (isIntersection) {
      ctx.fillStyle = "rgba(255,160,0,0.7)";
      ctx.font = `bold ${Math.max(9, Math.min(12, hs - 4 * scale))}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("✕", 0, 0);
    }
    ctx.restore();
  }

  // ── Lane markings + arrows ──
  ctx.lineCap = "butt";
  const lw = LANE_WIDTH * scale;
  for (const seg of segments) {
    const a = nodeMap.get(seg.fromId),
      b = nodeMap.get(seg.toId);
    if (!a || !b) continue;

    const nF = seg.lanesForward,
      nB = seg.lanesBackward;
    const rw = (nF + nB) * lw;
    const segLen = dist(a, b);
    if (segLen < 2) continue;
    const cp = cpMap?.get(seg.id);

    const hsA = hsMap.get(seg.fromId) ?? 0;
    const hsB = hsMap.get(seg.toId) ?? 0;
    const margin = 4 * scale;
    const tA = (hsA + margin) / segLen;
    const tB = 1 - (hsB + margin) / segLen;
    if (tA >= tB) continue;

    const cOff = ((nF - nB) / 2) * lw;

    // Helper: draw a "parallel" line at perpendicular offset `off` along the segment
    // For curves, sample and draw a polyline; for straight, use a single line
    const STEPS = cp ? 24 : 1;
    const drawParallelLine = (off: number) => {
      ctx.beginPath();
      for (let i = 0; i <= STEPS; i++) {
        const t = tA + (tB - tA) * (i / STEPS);
        const pt = cp ? bezierPoint(a, cp, b, t) : { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
        let nx: number, ny: number;
        if (cp) {
          const tan = bezierTangent(a, cp, b, t);
          const tLen = Math.hypot(tan.x, tan.y);
          nx = tLen > 1e-6 ? -tan.y / tLen : 0;
          ny = tLen > 1e-6 ? tan.x / tLen : 1;
        } else {
          const ux = (b.x - a.x) / segLen, uy = (b.y - a.y) / segLen;
          nx = -uy; ny = ux;
        }
        const px2 = pt.x + nx * off, py2 = pt.y + ny * off;
        if (i === 0) ctx.moveTo(px2, py2);
        else ctx.lineTo(px2, py2);
      }
      ctx.stroke();
    };

    // Estimate drawn length for arrow spacing
    const startPt = cp ? bezierPoint(a, cp, b, tA) : { x: a.x + tA * (b.x - a.x), y: a.y + tA * (b.y - a.y) };
    const endPt = cp ? bezierPoint(a, cp, b, tB) : { x: a.x + tB * (b.x - a.x), y: a.y + tB * (b.y - a.y) };
    const drawnLen = dist(startPt, endPt);
    if (drawnLen < 16 * scale) continue;

    ctx.setLineDash([]);
    ctx.strokeStyle = "rgba(255,255,255,0.65)";
    ctx.lineWidth = 2 * scale;
    drawParallelLine(-rw / 2);
    drawParallelLine(rw / 2);

    ctx.setLineDash([10 * scale, 10 * scale]);
    ctx.strokeStyle = "rgba(255,255,255,0.38)";
    ctx.lineWidth = 1.5 * scale;
    for (let i = 1; i < nF; i++) drawParallelLine(cOff - i * lw);
    for (let i = 1; i < nB; i++) drawParallelLine(cOff + i * lw);

    if (nB > 0) {
      ctx.setLineDash([14 * scale, 7 * scale]);
      ctx.strokeStyle = "rgba(255,200,40,0.85)";
      ctx.lineWidth = 2.5 * scale;
      drawParallelLine(cOff);
    }
    ctx.setLineDash([]);

    ctx.lineCap = "round";
    ctx.lineWidth = 1.5 * scale;
    const step = 80 * scale;
    for (let d = step; d < drawnLen - 10 * scale; d += step) {
      const tArrow = tA + (tB - tA) * (d / drawnLen);
      const pt = cp ? bezierPoint(a, cp, b, tArrow) : { x: a.x + tArrow * (b.x - a.x), y: a.y + tArrow * (b.y - a.y) };
      let arrowAngle: number;
      let nx: number, ny: number;
      if (cp) {
        const tan = bezierTangent(a, cp, b, tArrow);
        arrowAngle = Math.atan2(tan.y, tan.x);
        const tLen = Math.hypot(tan.x, tan.y);
        nx = tLen > 1e-6 ? -tan.y / tLen : 0;
        ny = tLen > 1e-6 ? tan.x / tLen : 1;
      } else {
        arrowAngle = Math.atan2(b.y - a.y, b.x - a.x);
        const ux = (b.x - a.x) / segLen, uy = (b.y - a.y) / segLen;
        nx = -uy; ny = ux;
      }
      ctx.strokeStyle = "rgba(255,255,255,0.32)";
      for (let i = 0; i < nF; i++) {
        drawArrow(
          ctx,
          pt.x + nx * (cOff - (i + 0.5) * lw),
          pt.y + ny * (cOff - (i + 0.5) * lw),
          arrowAngle,
          12 * scale,
        );
      }
      if (nB > 0) {
        ctx.strokeStyle = "rgba(255,255,255,0.25)";
        for (let i = 0; i < nB; i++) {
          drawArrow(
            ctx,
            pt.x + nx * (cOff + (i + 0.5) * lw),
            pt.y + ny * (cOff + (i + 0.5) * lw),
            arrowAngle + Math.PI,
            12 * scale,
          );
        }
      }
    }
    ctx.lineCap = "butt";

    const midPt = cp ? bezierPoint(a, cp, b, (tA + tB) / 2) : { x: (startPt.x + endPt.x) / 2, y: (startPt.y + endPt.y) / 2 };
    ctx.fillStyle = textMuted;
    ctx.font = `bold ${Math.max(8, Math.round(10 * scale))}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const laneLabel = nB > 0 ? `${nF}↔${nB}` : `${nF}→`;
    const speedImg = loadImg(speedLimitSvgUrl, triggerRender);
    const iconSize = Math.max(16, 24 * scale);
    if (speedImg) {
      ctx.save();
      ctx.translate(midPt.x, midPt.y);
      ctx.drawImage(speedImg, -iconSize / 2, -iconSize / 2, iconSize, iconSize);
      ctx.restore();
      ctx.fillStyle = light ? "#1a1a2e" : "#111";
      ctx.font = `bold ${Math.max(7, Math.round(8 * scale))}px monospace`;
      ctx.fillText(String(seg.speedLimit), midPt.x, midPt.y);
      ctx.fillStyle = textMuted;
      ctx.fillText(` ${laneLabel}`, midPt.x + iconSize / 2 + 4 * scale, midPt.y);
    } else {
      ctx.fillText(
        nB > 0 ? `${nF}↔${nB}  ${seg.speedLimit}` : `${nF}→  ${seg.speedLimit}`,
        midPt.x,
        midPt.y,
      );
    }
  }
  ctx.setLineDash([]);

  // ── Pedestrian crossings (zebra stripes) ──
  const NUM_STRIPES = 6;
  const STRIPE_GAP_RATIO = 1; // gap between stripes, relative to stripe width
  for (const seg of segments) {
    const crossings = seg.pedestrianCrossings;
    if (!crossings || crossings.length === 0) continue;
    const a = nodeMap.get(seg.fromId),
      b = nodeMap.get(seg.toId);
    if (!a || !b) continue;
    const segLen = dist(a, b);
    if (segLen < 2) continue;
    const cp = cpMap?.get(seg.id);
    const hsA = hsMap.get(seg.fromId) ?? 0;
    const hsB = hsMap.get(seg.toId) ?? 0;
    const tMin = hsA / segLen;
    const tMax = 1 - hsB / segLen;
    const rw = roadWidth(seg, scale);
    const totalStripeSpan = NUM_STRIPES + (NUM_STRIPES - 1) * STRIPE_GAP_RATIO;
    const stripeWidth = Math.max(1, rw / totalStripeSpan);
    const stripePitch = stripeWidth * (1 + STRIPE_GAP_RATIO);

    for (const cross of crossings) {
      const t = Math.max(0, Math.min(1, cross.t));
      if (t < tMin + 0.02 || t > tMax - 0.02) continue;
      const cPt = cp ? bezierPoint(a, cp, b, t) : { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
      const cw = rw * (cross.width ?? CROSSING_DEFAULT_WIDTH);
      let angle: number;
      if (cp) {
        const tan = bezierTangent(a, cp, b, t);
        angle = Math.atan2(tan.y, tan.x);
      } else {
        angle = Math.atan2(b.y - a.y, b.x - a.x);
      }

      ctx.save();
      ctx.translate(cPt.x, cPt.y);
      ctx.rotate(angle);
      for (let i = 0; i < NUM_STRIPES; i++) {
        const totalSpan = stripePitch * (NUM_STRIPES - 1) + stripeWidth;
        const y0 = -totalSpan / 2 + i * stripePitch;
        ctx.fillStyle = crossingStripe;
        ctx.fillRect(-cw / 2, y0, cw, stripeWidth);
      }
      ctx.restore();
    }
  }

  // ── Bus stop pockets ──
  for (const seg of segments) {
    const stops = seg.busStops;
    if (!stops || stops.length === 0) continue;
    const a = nodeMap.get(seg.fromId), b = nodeMap.get(seg.toId);
    if (!a || !b) continue;
    const { color, border } = SURFACE[seg.surface];
    const segLen = dist(a, b);
    if (segLen < 2) continue;
    const cp = cpMap?.get(seg.id);
    const baseUx = (b.x - a.x) / segLen, baseUy = (b.y - a.y) / segLen;
    const rw = roadWidth(seg, scale);
    const pocketW = rw * POCKET_WIDTH_FACTOR * 0.45;
    const halfLen = BUS_STOP_LENGTH_T * segLen * 0.5;
    const taperLen = halfLen * 0.35;

    for (const stop of stops) {
      const cPt = cp ? bezierPoint(a, cp, b, stop.t) : { x: a.x + stop.t * (b.x - a.x), y: a.y + stop.t * (b.y - a.y) };
      const cx = cPt.x, cy = cPt.y;
      let ux = baseUx, uy = baseUy;
      if (cp) {
        const tan = bezierTangent(a, cp, b, stop.t);
        const tLen = Math.hypot(tan.x, tan.y);
        if (tLen > 1e-6) { ux = tan.x / tLen; uy = tan.y / tLen; }
      }
      const px = -uy, py = ux;
      const sideSign = stop.side === "left" ? 1 : -1;
      const edgeOff = (rw / 2) * sideSign;
      const outerOff = edgeOff + pocketW * sideSign;

      const t0x = cx - ux * halfLen, t0y = cy - uy * halfLen;
      const t1x = cx + ux * halfLen, t1y = cy + uy * halfLen;

      ctx.beginPath();
      ctx.moveTo(t0x + px * edgeOff, t0y + py * edgeOff);
      ctx.lineTo(t0x + ux * taperLen + px * outerOff, t0y + uy * taperLen + py * outerOff);
      ctx.lineTo(t1x - ux * taperLen + px * outerOff, t1y - uy * taperLen + py * outerOff);
      ctx.lineTo(t1x + px * edgeOff, t1y + py * edgeOff);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = border;
      ctx.lineWidth = 1.5 * scale;
      ctx.stroke();

      const lineCount = 4;
      const lineStep = (halfLen * 2 - taperLen * 2) / (lineCount + 1);
      ctx.strokeStyle = "#e0c030";
      ctx.lineWidth = 1.5 * scale;
      for (let i = 1; i <= lineCount; i++) {
        const sd = -halfLen + taperLen + i * lineStep;
        const sx = cx + ux * sd + px * edgeOff;
        const sy = cy + uy * sd + py * edgeOff;
        const ex = cx + ux * sd + px * outerOff;
        const ey = cy + uy * sd + py * outerOff;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }

      ctx.fillStyle = "#e0c030";
      ctx.font = `bold ${Math.max(7, Math.round(9 * scale))}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const labelOff = edgeOff + (pocketW * 0.5) * sideSign;
      ctx.fillText("B", cx + px * labelOff, cy + py * labelOff);
    }
  }

  // ── Parking space pockets ──
  for (const seg of segments) {
    const spaces = seg.parkingSpaces;
    if (!spaces || spaces.length === 0) continue;
    const a = nodeMap.get(seg.fromId), b = nodeMap.get(seg.toId);
    if (!a || !b) continue;
    const { color, border } = SURFACE[seg.surface];
    const segLen = dist(a, b);
    if (segLen < 2) continue;
    const cp = cpMap?.get(seg.id);
    const baseUx = (b.x - a.x) / segLen, baseUy = (b.y - a.y) / segLen;
    const rw = roadWidth(seg, scale);
    const pocketW = rw * POCKET_WIDTH_FACTOR * 0.45;

    for (const space of spaces) {
      const halfLen = space.length * segLen * 0.5;
      const taperLen = halfLen * 0.25;
      const cPt = cp ? bezierPoint(a, cp, b, space.t) : { x: a.x + space.t * (b.x - a.x), y: a.y + space.t * (b.y - a.y) };
      const cx = cPt.x, cy = cPt.y;
      let ux = baseUx, uy = baseUy;
      if (cp) {
        const tan = bezierTangent(a, cp, b, space.t);
        const tLen = Math.hypot(tan.x, tan.y);
        if (tLen > 1e-6) { ux = tan.x / tLen; uy = tan.y / tLen; }
      }
      const px = -uy, py = ux;
      const sideSign = space.side === "left" ? 1 : -1;
      const edgeOff = (rw / 2) * sideSign;
      const outerOff = edgeOff + pocketW * sideSign;

      const t0x = cx - ux * halfLen, t0y = cy - uy * halfLen;
      const t1x = cx + ux * halfLen, t1y = cy + uy * halfLen;

      ctx.beginPath();
      ctx.moveTo(t0x + px * edgeOff, t0y + py * edgeOff);
      ctx.lineTo(t0x + ux * taperLen + px * outerOff, t0y + uy * taperLen + py * outerOff);
      ctx.lineTo(t1x - ux * taperLen + px * outerOff, t1y - uy * taperLen + py * outerOff);
      ctx.lineTo(t1x + px * edgeOff, t1y + py * edgeOff);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = border;
      ctx.lineWidth = 1.5 * scale;
      ctx.stroke();

      const stallCount = Math.max(2, Math.floor(halfLen * 2 / (pocketW * 0.8)));
      const stallStep = (halfLen * 2 - taperLen * 2) / stallCount;
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 1 * scale;
      for (let i = 1; i < stallCount; i++) {
        const sd = -halfLen + taperLen + i * stallStep;
        const sx = cx + ux * sd + px * edgeOff;
        const sy = cy + uy * sd + py * edgeOff;
        const ex = cx + ux * sd + px * outerOff;
        const ey = cy + uy * sd + py * outerOff;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }

      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = `bold ${Math.max(7, Math.round(9 * scale))}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const labelOff = edgeOff + (pocketW * 0.5) * sideSign;
      ctx.fillText("P", cx + px * labelOff, cy + py * labelOff);
    }
  }

  // ── Coefficient markers ──
  for (const seg of segments) {
    const coeffs = seg.coefficients;
    if (!coeffs || coeffs.length === 0) continue;
    const a = nodeMap.get(seg.fromId),
      b = nodeMap.get(seg.toId);
    if (!a || !b) continue;
    const segLen = dist(a, b);
    if (segLen < 2) continue;
    const cp = cpMap?.get(seg.id);
    const baseUx = (b.x - a.x) / segLen, baseUy = (b.y - a.y) / segLen;
    const hsA = hsMap.get(seg.fromId) ?? 0;
    const hsB = hsMap.get(seg.toId) ?? 0;
    const margin = 8 * scale;
    const tA = (hsA + margin) / segLen;
    const tB = 1 - (hsB + margin) / segLen;
    if (tA >= tB) continue;
    const startPt = cp ? bezierPoint(a, cp, b, tA) : { x: a.x + tA * (b.x - a.x), y: a.y + tA * (b.y - a.y) };
    const endPt = cp ? bezierPoint(a, cp, b, tB) : { x: a.x + tB * (b.x - a.x), y: a.y + tB * (b.y - a.y) };
    const drawnLen = dist(startPt, endPt);
    if (drawnLen < 30 * scale) continue;

    const rw = roadWidth(seg, scale);
    const r = Math.max(6, 8 * scale);
    const n = coeffs.length;

    for (let ci = 0; ci < n; ci++) {
      const c = coeffs[ci];
      const cfg = COEFF[c.type];
      const t = tA + (tB - tA) * (n === 1 ? 0.5 : 0.15 + (0.7 * ci) / (n - 1));
      const basePt = cp ? bezierPoint(a, cp, b, t) : { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
      let ux = baseUx, uy = baseUy;
      let roadAngle = Math.atan2(b.y - a.y, b.x - a.x);
      if (cp) {
        const tan = bezierTangent(a, cp, b, t);
        const tLen = Math.hypot(tan.x, tan.y);
        if (tLen > 1e-6) { ux = tan.x / tLen; uy = tan.y / tLen; roadAngle = Math.atan2(tan.y, tan.x); }
      }
      const pxN = -uy, pyN = ux;
      const offset = rw / 2 + r + 3 * scale;
      const mx = basePt.x + pxN * offset;
      const my = basePt.y + pyN * offset;

      ctx.beginPath();
      ctx.moveTo(basePt.x + pxN * (rw / 2), basePt.y + pyN * (rw / 2));
      ctx.lineTo(mx, my);
      ctx.strokeStyle = cfg.color + "50";
      ctx.lineWidth = 1 * scale;
      ctx.stroke();

      if (c.type === "road_slope") {
        const slopeImg = loadImg(slopeSvgUrl, triggerRender);
        const imgW = Math.max(80, 120 * scale);
        const imgH = imgW * (44 / 276);
        if (slopeImg) {
          ctx.save();
          ctx.translate(mx, my);
          // Positive slope = uphill toward 'to' → high end (left of SVG) points toward 'to'
          ctx.rotate(roadAngle + (c.value > 0 ? Math.PI : 0));
          ctx.drawImage(slopeImg, -imgW / 2, -imgH / 2, imgW, imgH);
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(mx, my, r, 0, Math.PI * 2);
          ctx.fillStyle = cfg.color;
          ctx.fill();
          ctx.strokeStyle = light ? "#64748b" : "#000";
          ctx.lineWidth = 1.2 * scale;
          ctx.stroke();
          ctx.fillStyle = textColor;
          ctx.font = `bold ${Math.max(7, Math.round(9 * scale))}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(cfg.symbol, mx, my);
        }
        if (scale >= 0.7) {
          ctx.fillStyle = cfg.color;
          ctx.font = `${Math.max(7, Math.round(8 * scale))}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(`${c.value}${cfg.unit}`, mx, my + imgH / 2 + 7 * scale);
        }
      } else {
        ctx.beginPath();
        ctx.arc(mx, my, r, 0, Math.PI * 2);
        ctx.fillStyle = cfg.color;
        ctx.fill();
        ctx.strokeStyle = light ? "#64748b" : "#000";
        ctx.lineWidth = 1.2 * scale;
        ctx.stroke();

        ctx.fillStyle = textColor;
        ctx.font = `bold ${Math.max(7, Math.round(9 * scale))}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(cfg.symbol, mx, my);

        if (scale >= 0.7) {
          const isBinary = cfg.max === 1 && cfg.min === 0 && cfg.step === 1;
          if (!isBinary) {
            ctx.fillStyle = cfg.color;
            ctx.font = `${Math.max(7, Math.round(8 * scale))}px sans-serif`;
            ctx.fillText(`${c.value}${cfg.unit}`, mx, my + r + 7 * scale);
          }
        }
      }
    }
  }

  // ── Connection handles ──
  const hr = HANDLE_RADIUS * scale;
  if (tool !== "delete") {
    const showFor = new Set<string>();
    if (hoveredNodeId) showFor.add(hoveredNodeId);
    if (hoveredHandle) showFor.add(hoveredHandle.nodeId);
    if (selectedId && nodes.some((n) => n.id === selectedId))
      showFor.add(selectedId);

    for (const nodeId of showFor) {
      const node = nodeMap.get(nodeId);
      if (!node) continue;
      const hs = hsMap.get(nodeId) ?? LANE_WIDTH * scale;
      const handleAngle = nodeOrientationAngle(nodeId, segments, nodeMap, cpMap);

      for (let i = 0; i < 4; i++) {
        const hp = handlePos(node, hs, i, scale, handleAngle);
        const isHov =
          hoveredHandle?.nodeId === nodeId && hoveredHandle?.idx === i;
        const isBuildTarget = buildFrom?.id === nodeId;

        const edgeOff = (() => {
          if (i === 0) return { x: 0, y: -hs };
          if (i === 1) return { x: hs, y: 0 };
          if (i === 2) return { x: 0, y: hs };
          return { x: -hs, y: 0 };
        })();
        const cosA = Math.cos(handleAngle),
          sinA = Math.sin(handleAngle);
        const edgeX =
          node.x + edgeOff.x * cosA - edgeOff.y * sinA;
        const edgeY =
          node.y + edgeOff.x * sinA + edgeOff.y * cosA;

        ctx.beginPath();
        ctx.moveTo(edgeX, edgeY);
        ctx.lineTo(hp.x, hp.y);
        ctx.strokeStyle = isHov
          ? "rgba(100,180,255,0.6)"
          : "rgba(80,120,180,0.35)";
        ctx.lineWidth = 1.5 * scale;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(hp.x, hp.y, hr, 0, Math.PI * 2);
        ctx.fillStyle = isHov
          ? (light ? "#93c5fd" : "#1e4a9a")
          : isBuildTarget
            ? (light ? "#bfdbfe" : "#1a3060")
            : (light ? "#e2e8f0" : "#111828");
        ctx.fill();
        ctx.strokeStyle = isHov ? (light ? "#2563eb" : "#80c0ff") : (light ? "#60a5fa" : "#3a60a0");
        ctx.lineWidth = (isHov ? 2 : 1.5) * scale;
        ctx.stroke();

        const s = 4 * scale;
        ctx.strokeStyle = isHov ? (light ? "#3b82f6" : "#a0d0ff") : (light ? "#2563eb" : "#4a80c0");
        ctx.lineWidth = (isHov ? 2 : 1.5) * scale;
        ctx.beginPath();
        ctx.moveTo(hp.x - s, hp.y);
        ctx.lineTo(hp.x + s, hp.y);
        ctx.moveTo(hp.x, hp.y - s);
        ctx.lineTo(hp.x, hp.y + s);
        ctx.stroke();
      }
    }
  }

  // ── Ghost segment (road building preview) ──
  if (tool === "road" && buildFrom && mouse) {
    const snap = nearestNodeSq(nodes, segments, mouse, scale, buildFrom.id);
    const target = snap ?? mouse;
    ctx.setLineDash([8 * scale, 6 * scale]);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(buildFrom.x, buildFrom.y);
    ctx.lineTo(target.x, target.y);
    ctx.strokeStyle = "rgba(100,180,255,0.55)";
    ctx.lineWidth = 3 * scale;
    ctx.stroke();
    ctx.setLineDash([]);
    if (snap) {
      const hs = hsMap.get(snap.id) ?? LANE_WIDTH * scale;
      ctx.strokeStyle = "rgba(80,220,80,0.7)";
      ctx.lineWidth = 2 * scale;
      ctx.strokeRect(
        snap.x - hs - 2 * scale,
        snap.y - hs - 2 * scale,
        (hs + 2 * scale) * 2,
        (hs + 2 * scale) * 2,
      );
    }
  }

  // ── Bézier control point handles (select tool) ──
  if (tool === "select") {
    const cpHandleSegs = new Set<string>();
    if (hoveredSegId) cpHandleSegs.add(hoveredSegId);
    if (selectedId && segments.some((s) => s.id === selectedId)) cpHandleSegs.add(selectedId);

    for (const segId of cpHandleSegs) {
      const seg = segments.find((s) => s.id === segId);
      if (!seg) continue;
      const a = nodeMap.get(seg.fromId), b = nodeMap.get(seg.toId);
      if (!a || !b) continue;
      const cp = cpMap?.get(seg.id);
      const isHov = hoveredCpSegId === seg.id;
      const isDrag = draggingCpSegId === seg.id;

      // Handle position: at cp if curved, else at segment midpoint
      const hpX = cp ? cp.x : (a.x + b.x) / 2;
      const hpY = cp ? cp.y : (a.y + b.y) / 2;

      // Dashed line from both endpoints to cp for curved segments
      if (cp) {
        ctx.save();
        ctx.setLineDash([4 * scale, 4 * scale]);
        ctx.strokeStyle = "rgba(100,200,255,0.35)";
        ctx.lineWidth = 1 * scale;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(cp.x, cp.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // Draw CP handle as diamond
      const hSize = (isHov || isDrag ? 8 : 6) * scale;
      ctx.save();
      ctx.translate(hpX, hpY);
      ctx.rotate(Math.PI / 4);
      ctx.beginPath();
      ctx.rect(-hSize / 2, -hSize / 2, hSize, hSize);
      ctx.fillStyle = isDrag
        ? "rgba(255,180,60,0.9)"
        : isHov
          ? (light ? "#93c5fd" : "#1e4a9a")
          : cp
            ? (light ? "#fbbf24" : "#d97706")
            : (light ? "#e2e8f0" : "#1e293b");
      ctx.fill();
      ctx.strokeStyle = isDrag
        ? "#ff8c00"
        : isHov
          ? (light ? "#2563eb" : "#80c0ff")
          : cp
            ? (light ? "#b45309" : "#f59e0b")
            : (light ? "#60a5fa" : "#3a60a0");
      ctx.lineWidth = (isHov || isDrag ? 2 : 1.5) * scale;
      ctx.stroke();
      ctx.restore();
    }
  }

  // ── Hovered segment highlight ──
  if (hoveredSegId) {
    const seg = segments.find((s) => s.id === hoveredSegId);
    if (seg) {
      const a = nodeMap.get(seg.fromId),
        b = nodeMap.get(seg.toId);
      if (a && b) {
        const cp = cpMap?.get(seg.id);
        ctx.lineCap = "butt";
        ctx.beginPath();
        if (cp) {
          ctx.moveTo(a.x, a.y);
          ctx.quadraticCurveTo(cp.x, cp.y, b.x, b.y);
        } else {
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
        }
        ctx.strokeStyle =
          tool === "delete" ? "rgba(255,80,80,0.18)" : "rgba(100,180,255,0.18)";
        ctx.lineWidth = roadWidth(seg, scale) + 8 * scale;
        ctx.stroke();
      }
    }
  }

  // ── Drop target highlight (drag obstacle onto road) ──
  if (dropTargetSegId) {
    const seg = segments.find((s) => s.id === dropTargetSegId);
    if (seg) {
      const a = nodeMap.get(seg.fromId),
        b = nodeMap.get(seg.toId);
      if (a && b) {
        const cp = cpMap?.get(seg.id);
        ctx.lineCap = "butt";
        ctx.setLineDash([8 * scale, 6 * scale]);
        ctx.beginPath();
        if (cp) {
          ctx.moveTo(a.x, a.y);
          ctx.quadraticCurveTo(cp.x, cp.y, b.x, b.y);
        } else {
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
        }
        ctx.strokeStyle = "rgba(80,220,120,0.35)";
        ctx.lineWidth = roadWidth(seg, scale) + 14 * scale;
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }
}
