export type Tool = "road" | "select" | "delete" | "crossing" | "bus_stop" | "parking" | "split";
export type SurfaceType = "asphalt" | "concrete" | "gravel" | "dirt";
export type RoadFeatureSide = "left" | "right";

export type CoefficientType =
  | "speed_limit"
  | "road_condition"
  | "road_slope"
  | "turning_radius"
  | "pedestrian_crossing"
  | "parking"
  | "bus_stop"
  | "maneuver"
  | "lane_width";

export interface RoadCoefficient {
  id: string;
  type: CoefficientType;
  value: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface RoadNode {
  id: string;
  lat: number;
  lng: number;
}

export interface ScreenNode {
  id: string;
  x: number;
  y: number;
}

export interface PedestrianCrossing {
  id: string;
  t: number; // 0..1 position along segment from fromId to toId
  /** Width as fraction of road width (0.2–1). How wide the crossing is across the road. */
  width?: number;
}

export interface BusStop {
  id: string;
  t: number;
  side: RoadFeatureSide;
}

export interface ParkingSpace {
  id: string;
  t: number;
  side: RoadFeatureSide;
  /** Length as fraction of the segment (0.03–0.5). */
  length: number;
}

export interface RoadSegment {
  id: string;
  fromId: string;
  toId: string;
  lanesForward: number;
  lanesBackward: number;
  speedLimit: number;
  surface: SurfaceType;
  /** Per-segment display scale (0.05–2). Default 1. */
  displayScale?: number;
  /** Traffic intensity (cars per hour). Used for Service Level from Congestion Z = N/P. */
  trafficIntensity?: number;
  /** Quadratic Bézier control point in geo coordinates. Absent = straight segment. */
  cp?: { lat: number; lng: number };
  /** Obstacles/coefficients affecting vehicle behavior on this segment. */
  coefficients?: RoadCoefficient[];
  /** Pedestrian crossings at positions along this segment. */
  pedestrianCrossings?: PedestrianCrossing[];
  /** Bus stops along this segment. */
  busStops?: BusStop[];
  /** Parking spaces along this segment. */
  parkingSpaces?: ParkingSpace[];
}

export interface HoveredHandle {
  nodeId: string;
  idx: number;
}

export interface EditPanelState {
  segId: string;
  x: number;
  y: number;
  /** Position along segment (0..1) when opened by right-click, for "Add node here". */
  segmentT?: number;
}
