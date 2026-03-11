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
} from "../utils/geometry";
import slopeSvgUrl from "../assets/slope.svg?url";

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

    const segLen = dist(a, b);
    if (segLen < 2) continue;
    const ux = (b.x - a.x) / segLen,
      uy = (b.y - a.y) / segLen;
    const hsA = hsMap.get(seg.fromId) ?? 0;
    const hsB = hsMap.get(seg.toId) ?? 0;
    const drawnLen = segLen - hsA - hsB;
    if (drawnLen < 4) continue;

    const sx = a.x + ux * hsA,
      sy = a.y + uy * hsA;
    const ex = b.x - ux * hsB,
      ey = b.y - uy * hsB;

    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.strokeStyle = isSel ? "#1e4a90" : isHov ? segHoverBorder : border;
    ctx.lineWidth = rw + 6 * scale;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
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

    const angle = nodeOrientationAngle(node.id, segments, nodeMap);
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
    const ux = (b.x - a.x) / segLen,
      uy = (b.y - a.y) / segLen;
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const px = -uy,
      py = ux;

    const hsA = hsMap.get(seg.fromId) ?? 0;
    const hsB = hsMap.get(seg.toId) ?? 0;
    const margin = 4 * scale;
    const sx = a.x + ux * (hsA + margin),
      sy = a.y + uy * (hsA + margin);
    const ex = b.x - ux * (hsB + margin),
      ey = b.y - uy * (hsB + margin);
    if (dist({ x: sx, y: sy }, { x: ex, y: ey }) < 16 * scale) continue;

    const cOff = ((nF - nB) / 2) * lw;

    ctx.setLineDash([]);
    ctx.strokeStyle = "rgba(255,255,255,0.65)";
    ctx.lineWidth = 2 * scale;
    for (const side of [-1, 1]) {
      const off = (side * rw) / 2;
      ctx.beginPath();
      ctx.moveTo(sx + px * off, sy + py * off);
      ctx.lineTo(ex + px * off, ey + py * off);
      ctx.stroke();
    }

    ctx.setLineDash([10 * scale, 10 * scale]);
    ctx.strokeStyle = "rgba(255,255,255,0.38)";
    ctx.lineWidth = 1.5 * scale;
    for (let i = 1; i < nF; i++) {
      const off = cOff - i * lw;
      ctx.beginPath();
      ctx.moveTo(sx + px * off, sy + py * off);
      ctx.lineTo(ex + px * off, ey + py * off);
      ctx.stroke();
    }
    for (let i = 1; i < nB; i++) {
      const off = cOff + i * lw;
      ctx.beginPath();
      ctx.moveTo(sx + px * off, sy + py * off);
      ctx.lineTo(ex + px * off, ey + py * off);
      ctx.stroke();
    }

    if (nB > 0) {
      ctx.setLineDash([14 * scale, 7 * scale]);
      ctx.strokeStyle = "rgba(255,200,40,0.85)";
      ctx.lineWidth = 2.5 * scale;
      ctx.beginPath();
      ctx.moveTo(sx + px * cOff, sy + py * cOff);
      ctx.lineTo(ex + px * cOff, ey + py * cOff);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    ctx.lineCap = "round";
    ctx.lineWidth = 1.5 * scale;
    const drawnLen = dist({ x: sx, y: sy }, { x: ex, y: ey });
    const step = 80 * scale;
    for (let d = step; d < drawnLen - 10 * scale; d += step) {
      const t = d / drawnLen;
      const bx = sx + (ex - sx) * t,
        by = sy + (ey - sy) * t;
      ctx.strokeStyle = "rgba(255,255,255,0.32)";
      for (let i = 0; i < nF; i++) {
        drawArrow(
          ctx,
          bx + px * (cOff - (i + 0.5) * lw),
          by + py * (cOff - (i + 0.5) * lw),
          angle,
          12 * scale,
        );
      }
      if (nB > 0) {
        ctx.strokeStyle = "rgba(255,255,255,0.25)";
        for (let i = 0; i < nB; i++) {
          drawArrow(
            ctx,
            bx + px * (cOff + (i + 0.5) * lw),
            by + py * (cOff + (i + 0.5) * lw),
            angle + Math.PI,
            12 * scale,
          );
        }
      }
    }
    ctx.lineCap = "butt";

    const midX = (sx + ex) / 2,
      midY = (sy + ey) / 2;
    ctx.fillStyle = textMuted;
    ctx.font = `bold ${Math.max(8, Math.round(10 * scale))}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      nB > 0 ? `${nF}↔${nB}  ${seg.speedLimit}` : `${nF}→  ${seg.speedLimit}`,
      midX,
      midY,
    );
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
      const cx = a.x + t * (b.x - a.x);
      const cy = a.y + t * (b.y - a.y);
      const cw = rw * (cross.width ?? CROSSING_DEFAULT_WIDTH);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.atan2(b.y - a.y, b.x - a.x));
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
    const ux = (b.x - a.x) / segLen, uy = (b.y - a.y) / segLen;
    const px = -uy, py = ux;
    const rw = roadWidth(seg, scale);
    const pocketW = rw * POCKET_WIDTH_FACTOR * 0.45;
    const halfLen = BUS_STOP_LENGTH_T * segLen * 0.5;
    const taperLen = halfLen * 0.35;

    for (const stop of stops) {
      const cx = a.x + stop.t * (b.x - a.x);
      const cy = a.y + stop.t * (b.y - a.y);
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
    const ux = (b.x - a.x) / segLen, uy = (b.y - a.y) / segLen;
    const px = -uy, py = ux;
    const rw = roadWidth(seg, scale);
    const pocketW = rw * POCKET_WIDTH_FACTOR * 0.45;

    for (const space of spaces) {
      const halfLen = space.length * segLen * 0.5;
      const taperLen = halfLen * 0.25;
      const cx = a.x + space.t * (b.x - a.x);
      const cy = a.y + space.t * (b.y - a.y);
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
    const ux = (b.x - a.x) / segLen,
      uy = (b.y - a.y) / segLen;
    const px = -uy,
      py = ux;
    const hsA = hsMap.get(seg.fromId) ?? 0;
    const hsB = hsMap.get(seg.toId) ?? 0;
    const margin = 8 * scale;
    const sx = a.x + ux * (hsA + margin),
      sy = a.y + uy * (hsA + margin);
    const ex = b.x - ux * (hsB + margin),
      ey = b.y - uy * (hsB + margin);
    const drawnLen = dist({ x: sx, y: sy }, { x: ex, y: ey });
    if (drawnLen < 30 * scale) continue;

    const rw = roadWidth(seg, scale);
    const r = Math.max(6, 8 * scale);
    const n = coeffs.length;

    const roadAngle = Math.atan2(b.y - a.y, b.x - a.x);

    for (let ci = 0; ci < n; ci++) {
      const c = coeffs[ci];
      const cfg = COEFF[c.type];
      const t = n === 1 ? 0.5 : 0.15 + (0.7 * ci) / (n - 1);
      const baseX = sx + (ex - sx) * t;
      const baseY = sy + (ey - sy) * t;
      const offset = rw / 2 + r + 3 * scale;
      const mx = baseX + px * offset;
      const my = baseY + py * offset;

      ctx.beginPath();
      ctx.moveTo(baseX + px * (rw / 2), baseY + py * (rw / 2));
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
      const handleAngle = nodeOrientationAngle(nodeId, segments, nodeMap);

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

  // ── Hovered segment highlight ──
  if (hoveredSegId) {
    const seg = segments.find((s) => s.id === hoveredSegId);
    if (seg) {
      const a = nodeMap.get(seg.fromId),
        b = nodeMap.get(seg.toId);
      if (a && b) {
        ctx.lineCap = "butt";
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
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
        ctx.lineCap = "butt";
        ctx.setLineDash([8 * scale, 6 * scale]);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = "rgba(80,220,120,0.35)";
        ctx.lineWidth = roadWidth(seg, scale) + 14 * scale;
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }
}
