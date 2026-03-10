import L from "leaflet";
import { MAP_ZOOM } from "../constants";
import type { Vec2, RoadNode, ScreenNode } from "../types";

/** Combined scale from zoom and user slider. Roads scale with map zoom, x userScale. */
export function getScale(zoom: number, userScale: number): number {
  return Math.pow(2, (zoom - MAP_ZOOM) / 2) * userScale;
}

let _id = 0;
export const uid = () => `n${++_id}`;

export function toScreen(map: L.Map, node: RoadNode): ScreenNode {
  const pt = map.latLngToContainerPoint([node.lat, node.lng]);
  return { id: node.id, x: pt.x, y: pt.y };
}

export function toGeo(map: L.Map, pos: Vec2): { lat: number; lng: number } {
  const ll = map.containerPointToLatLng(L.point(pos.x, pos.y));
  return { lat: ll.lat, lng: ll.lng };
}
