import { useEffect, useCallback } from "react";
import L from "leaflet";
import { MAP_CENTER, MAP_ZOOM } from "../constants";

const ZOOM_MIN = 3;
const ZOOM_MAX = 19;
const DISCRETE_STEP = 0.4;
const TRACKPAD_SENSITIVITY = 0.008;
const KEYBOARD_STEP = 0.5;

export function useMap(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  mapContainerRef: React.RefObject<HTMLDivElement | null>,
  mapRef: React.MutableRefObject<L.Map | null>,
  renderFromRef: (map: L.Map) => void,
) {
  // Resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const map = mapRef.current;
      map?.invalidateSize();
      if (map) renderFromRef(map);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [canvasRef, mapRef, renderFromRef]);

  // Leaflet map init
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current, {
      center: MAP_CENTER,
      zoom: MAP_ZOOM,
      zoomSnap: 0,
      zoomAnimation: false,
      fadeAnimation: false,
      zoomControl: false,
      attributionControl: true,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: ZOOM_MAX,
      updateWhenZooming: false,
      keepBuffer: 6,
    }).addTo(map);
    mapRef.current = map;

    // Deduplicate renders: Leaflet fires both "zoom" and "move" from a single
    // setZoomAround call. Using a microtask ensures we only render once after
    // both events have fired and the map state is fully consistent.
    let renderPending = false;
    map.on("move zoom", () => {
      if (!renderPending) {
        renderPending = true;
        queueMicrotask(() => {
          renderPending = false;
          renderFromRef(map);
        });
      }
    });
    renderFromRef(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [mapContainerRef, mapRef, renderFromRef]);

  // Smooth wheel zoom with trackpad detection and rAF batching
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let pendingDelta = 0;
    let lastLatlng: L.LatLng | null = null;
    let rafId = 0;

    const applyZoom = () => {
      rafId = 0;
      const map = mapRef.current;
      if (!map || pendingDelta === 0 || !lastLatlng) return;
      const cur = map.getZoom();
      const target = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, cur + pendingDelta));
      pendingDelta = 0;
      if (Math.abs(target - cur) > 0.001) {
        map.setZoomAround(lastLatlng, target, { animate: false });
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const map = mapRef.current;
      if (!map) return;

      const rect = canvas.getBoundingClientRect();
      lastLatlng = map.containerPointToLatLng(
        L.point(e.clientX - rect.left, e.clientY - rect.top),
      );

      const isTrackpad = !Number.isInteger(e.deltaY) || Math.abs(e.deltaY) < 40;
      if (isTrackpad) {
        pendingDelta += -e.deltaY * TRACKPAD_SENSITIVITY;
      } else {
        pendingDelta += e.deltaY > 0 ? -DISCRETE_STEP : DISCRETE_STEP;
      }

      if (!rafId) {
        rafId = requestAnimationFrame(applyZoom);
      }
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      canvas.removeEventListener("wheel", onWheel);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [canvasRef, mapRef]);

  const zoomBy = useCallback(
    (delta: number) => {
      const map = mapRef.current;
      if (!map) return;
      const cur = map.getZoom();
      const target = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, cur + delta));
      map.setZoomAround(map.getCenter(), target, { animate: false });
    },
    [mapRef],
  );

  const zoomIn = useCallback(() => zoomBy(KEYBOARD_STEP), [zoomBy]);
  const zoomOut = useCallback(() => zoomBy(-KEYBOARD_STEP), [zoomBy]);

  return { zoomIn, zoomOut };
}
