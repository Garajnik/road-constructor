import type { RoadSegment, CoefficientType } from "../types";
import { COEFF } from "../constants";
import { totalLanes } from "./geometry";

/** Base capacity per lane at 60 km/h under ideal conditions (veh/h). HCM-inspired. */
const BASE_CAPACITY_PER_LANE = 1800;

/** Surface capacity factor (0..1). Affects road element capacity. */
const SURFACE_CAPACITY: Record<string, number> = {
  asphalt: 1.0,
  concrete: 0.92,
  gravel: 0.72,
  dirt: 0.55,
};

/**
 * Get capacity multiplier from a coefficient. Each obstacle/road modifier
 * reduces capacity. Returns value in (0, 1].
 */
function coeffCapacityFactor(type: CoefficientType, value: number, speedLimit: number): number {
  const cfg = COEFF[type];
  const norm = (v: number) => Math.max(0, Math.min(1, (v - cfg.min) / (cfg.max - cfg.min || 1)));
  switch (type) {
    case "speed_limit":
      return Math.min(1, value / Math.max(20, speedLimit));
    case "road_condition":
      return 0.5 + 0.5 * (value / 100);
    case "road_slope":
      return 1 - Math.abs(value) * 0.02; // ~0.7 at ±15°
    case "turning_radius":
      return 0.6 + 0.4 * norm(value); // 5m→0.6, 500m→1
    case "pedestrian_crossing":
      return value === 1 ? 0.88 : 1; // present = 12% reduction
    case "parking":
      return 1 - 0.004 * value; // 0→1, 100→0.6
    case "bus_stop":
      return value === 1 ? 0.9 : 1;
    case "maneuver":
      return 0.85 + 0.15 * value; // 0→0.85, 1→1
    case "lane_width":
      return 0.75 + 0.25 * norm(value); // 2m→0.75, 5m→1
    default:
      return 1;
  }
}

/** Speed adjustment: capacity scales with speed up to ~90 km/h, then plateaus. */
function speedFactor(speed: number): number {
  if (speed <= 30) return 0.6 + (speed / 30) * 0.3;
  if (speed <= 90) return 0.9 + (speed - 30) * 0.002; // up to 1.02
  return 1.02 - (speed - 90) * 0.001; // gradual decline above 90
}

/**
 * Compute road element capacity P (cars per hour).
 * Each obstacle and road section modifier affects this.
 */
export function computeCapacity(seg: RoadSegment): number {
  const lanes = totalLanes(seg);
  const surfaceFactor = SURFACE_CAPACITY[seg.surface] ?? 1;
  const spdFactor = speedFactor(seg.speedLimit);

  let P = lanes * BASE_CAPACITY_PER_LANE * surfaceFactor * spdFactor;

  for (const c of seg.coefficients ?? []) {
    P *= coeffCapacityFactor(c.type, c.value, seg.speedLimit);
  }

  const crossings = seg.pedestrianCrossings?.length ?? 0;
  P *= Math.pow(0.92, crossings);

  const busStops = seg.busStops?.length ?? 0;
  P *= Math.pow(0.90, busStops);

  const parkingSpaces = seg.parkingSpaces?.length ?? 0;
  P *= Math.pow(0.95, parkingSpaces);

  return Math.max(1, Math.round(P));
}

/**
 * Service Level from Congestion: Z = N/P
 * N = traffic intensity (cars/h), P = capacity (cars/h)
 */
export function computeServiceLevel(N: number, P: number): number | null {
  if (P <= 0 || N < 0) return null;
  return N / P;
}

/** Service level rating and color from Z. */
export function getServiceLevelRating(Z: number): { letter: string; color: string } {
  if (Z < 0.2) return { letter: "A", color: "#22dd22" };   // bright green
  if (Z < 0.45) return { letter: "B", color: "#44aa44" };   // green
  if (Z < 0.7) return { letter: "C", color: "#ddcc22" };   // yellow
  if (Z < 0.9) return { letter: "D", color: "#dd8833" };    // orange
  if (Z <= 1) return { letter: "E", color: "#dd4444" };     // red
  return { letter: "F", color: "#881111" };                 // dark red
}
