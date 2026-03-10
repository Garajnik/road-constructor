import type { CoefficientType, SurfaceType } from "./types";

export const LANE_WIDTH = 22;
export const MIN_SEGMENT_LENGTH = 20;
export const HANDLE_OFFSET = 13;
export const HANDLE_RADIUS = 9;
export const SNAP_EXTRA = 4;
export const MAP_CENTER: [number, number] = [56.0153, 92.8932];
export const MAP_ZOOM = 13;

export const COEFF_TYPES: CoefficientType[] = [
  "speed_limit",
  "road_condition",
  "road_slope",
  "turning_radius",
  "pedestrian_crossing",
  "parking",
  "bus_stop",
  "maneuver",
  "lane_width",
];

export const COEFF: Record<
  CoefficientType,
  {
    label: string;
    symbol: string;
    color: string;
    unit: string;
    min: number;
    max: number;
    step: number;
    default: number;
  }
> = {
  speed_limit: {
    label: "Speed Limit",
    symbol: "S",
    color: "#e05050",
    unit: "km/h",
    min: 5,
    max: 200,
    step: 5,
    default: 60,
  },
  road_condition: {
    label: "Road Condition",
    symbol: "C",
    color: "#e09030",
    unit: "%",
    min: 0,
    max: 100,
    step: 5,
    default: 80,
  },
  road_slope: {
    label: "Road Slope",
    symbol: "/",
    color: "#8a6a40",
    unit: "°",
    min: -15,
    max: 15,
    step: 0.5,
    default: 0,
  },
  turning_radius: {
    label: "Turning Radius",
    symbol: "R",
    color: "#5080c0",
    unit: "m",
    min: 5,
    max: 500,
    step: 5,
    default: 50,
  },
  pedestrian_crossing: {
    label: "Ped. Crossing",
    symbol: "X",
    color: "#e0c030",
    unit: "",
    min: 0,
    max: 1,
    step: 1,
    default: 1,
  },
  parking: {
    label: "Parking",
    symbol: "P",
    color: "#40a0c0",
    unit: "spots",
    min: 0,
    max: 100,
    step: 1,
    default: 10,
  },
  bus_stop: {
    label: "Bus Stop",
    symbol: "B",
    color: "#40a060",
    unit: "",
    min: 0,
    max: 1,
    step: 1,
    default: 1,
  },
  maneuver: {
    label: "Maneuver",
    symbol: "M",
    color: "#9060c0",
    unit: "",
    min: 0,
    max: 1,
    step: 0.1,
    default: 0.5,
  },
  lane_width: {
    label: "Lane Width",
    symbol: "W",
    color: "#40a0a0",
    unit: "m",
    min: 2,
    max: 5,
    step: 0.1,
    default: 3.5,
  },
};

export const SURFACE: Record<
  SurfaceType,
  { color: string; border: string; label: string; dot: string }
> = {
  asphalt: {
    color: "#454545",
    border: "#1e1e1e",
    label: "Asphalt",
    dot: "#666",
  },
  concrete: {
    color: "#686868",
    border: "#3a3a3a",
    label: "Concrete",
    dot: "#999",
  },
  gravel: {
    color: "#6a5a40",
    border: "#3a2e1e",
    label: "Gravel",
    dot: "#8a7a50",
  },
  dirt: { color: "#8a6a40", border: "#5a3e1e", label: "Dirt", dot: "#b09060" },
};

export const SURFACE_KEYS: SurfaceType[] = [
  "asphalt",
  "concrete",
  "gravel",
  "dirt",
];

export const SPEED_PRESETS = [20, 30, 50, 70, 90, 110, 130];

export const POCKET_WIDTH_FACTOR = 0.9;
export const BUS_STOP_LENGTH_T = 0.08;
export const PARKING_DEFAULT_LENGTH_T = 0.1;
export const PARKING_MIN_LENGTH_T = 0.03;
export const PARKING_MAX_LENGTH_T = 0.5;
export const CROSSING_DEFAULT_WIDTH = 1;
export const CROSSING_MIN_WIDTH = 0.2;
export const CROSSING_MAX_WIDTH = 1;
