"use client";
import { useRef, useEffect } from "react";
import type { Voyage, Terminal } from "@/lib/types";
import { destinationColor } from "@/lib/utils";

interface Props {
  voyages: Voyage[];
  terminals: Terminal[];
}

declare global {
  interface Window { maplibregl: typeof import("maplibre-gl") }
}

const REGION_LABEL: Record<string, string> = {
  europe: "Europe",
  asia: "Asia",
  us_gulf: "US Gulf",
  us_east: "US East",
  mideast: "Middle East",
  uncertain: "Uncertain",
};

export default function LNGMap({ voyages, terminals }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<import("maplibre-gl").Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const initMap = async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      await import("maplibre-gl/dist/maplibre-gl.css" as unknown as string);

      const map = new maplibregl.Map({
        container: mapRef.current!,
        style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
        center: [0, 25],
        zoom: 2,
      });

      mapInstance.current = map;

      map.on("load", () => {
        // Route line source (shown when vessel is clicked)
        map.addSource("route", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#ffffff", "line-width": 2, "line-dasharray": [5, 5], "line-opacity": 0.55 },
        });

        // Terminals
        const terminalFeatures = terminals.map(t => ({
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [t.lon, t.lat] },
          properties: {
            name: t.name, type: t.terminal_type, region: t.region,
            is_us_export: t.is_us_export,
            color: t.is_us_export ? "#06b6d4" : (t.region === "europe" ? "#22c55e" : "#f59e0b"),
          },
        }));

        map.addSource("terminals", { type: "geojson", data: { type: "FeatureCollection", features: terminalFeatures } });
        map.addLayer({
          id: "terminals-circle",
          type: "circle",
          source: "terminals",
          paint: {
            "circle-radius": 5,
            "circle-color": ["get", "color"],
            "circle-opacity": 0.85,
            "circle-stroke-width": 1,
            "circle-stroke-color": "#000",
          },
        });

        // Vessels
        const vesselFeatures = voyages
          .filter(v => v.lat !== null && v.lon !== null)
          .map(v => ({
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: [v.lon!, v.lat!] },
            properties: {
              name: v.vessel_name, mmsi: v.mmsi,
              origin: v.origin_terminal_name,
              destination_name: v.inferred_destination_name,
              destination: v.inferred_destination_name || REGION_LABEL[v.inferred_destination_region ?? ""] || "Unknown",
              region: v.inferred_destination_region,
              speed: v.speed,
              confidence: Math.round((v.destination_confidence || 0) * 100),
              color: destinationColor(v.inferred_destination_region),
            },
          }));

        map.addSource("vessels", { type: "geojson", data: { type: "FeatureCollection", features: vesselFeatures } });
        map.addLayer({
          id: "vessels-circle",
          type: "circle",
          source: "vessels",
          paint: {
            "circle-radius": 8,
            "circle-color": ["get", "color"],
            "circle-opacity": 0.9,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#fff",
          },
        });

        let activePopup: import("maplibre-gl").Popup | null = null;

        map.on("click", "vessels-circle", (e) => {
          const f = e.features?.[0];
          if (!f) return;
          const p = f.properties as Record<string, string | number>;
          const coords = (f.geometry as unknown as { coordinates: [number, number] }).coordinates;

          // Find origin and destination terminals for route line
          const originT = terminals.find(t => t.name === p.origin);
          const destT = terminals.find(t => t.name === p.destination_name)
            ?? terminals.find(t => t.region === p.region && !t.is_us_export);

          const routeCoords: [number, number][] = [];
          if (originT) routeCoords.push([originT.lon, originT.lat]);
          routeCoords.push(coords);
          if (destT) routeCoords.push([destT.lon, destT.lat]);

          (map.getSource("route") as import("maplibre-gl").GeoJSONSource).setData({
            type: "FeatureCollection",
            features: routeCoords.length > 1 ? [{
              type: "Feature",
              geometry: { type: "LineString", coordinates: routeCoords },
              properties: {},
            }] : [],
          });

          const regionLabel = REGION_LABEL[p.region as string] ?? p.region ?? "Unknown";
          const destDisplay = p.destination_name || regionLabel;

          activePopup?.remove();
          activePopup = new maplibregl.Popup({ maxWidth: "300px", className: "lng-popup" })
            .setLngLat(e.lngLat)
            .setHTML(`
              <div style="background:#1e293b;color:#e2e8f0;font-family:sans-serif;font-size:12px;padding:2px">
                <div style="font-size:14px;font-weight:700;margin-bottom:4px">${p.name}</div>
                <div style="color:#64748b;margin-bottom:10px;font-size:11px">MMSI: ${p.mmsi}</div>
                <table style="width:100%;border-collapse:collapse">
                  <tr><td style="color:#94a3b8;padding:2px 0;width:90px">Origin</td><td style="font-weight:500">${p.origin || "Unknown"}</td></tr>
                  <tr><td style="color:#94a3b8;padding:2px 0">Destination</td><td style="font-weight:500">${destDisplay}</td></tr>
                  <tr><td style="color:#94a3b8;padding:2px 0">Region</td><td style="font-weight:500">${regionLabel}</td></tr>
                  <tr><td style="color:#94a3b8;padding:2px 0">Confidence</td><td style="font-weight:500">${p.confidence}%</td></tr>
                  ${p.speed ? `<tr><td style="color:#94a3b8;padding:2px 0">Speed</td><td style="font-weight:500">${Number(p.speed).toFixed(1)} kn</td></tr>` : ""}
                </table>
              </div>
            `)
            .addTo(map);
        });

        // Clear route line when map is clicked elsewhere
        map.on("click", (e) => {
          const features = map.queryRenderedFeatures(e.point, { layers: ["vessels-circle"] });
          if (!features.length) {
            (map.getSource("route") as import("maplibre-gl").GeoJSONSource).setData(
              { type: "FeatureCollection", features: [] }
            );
          }
        });

        map.on("click", "terminals-circle", (e) => {
          const f = e.features?.[0];
          if (!f) return;
          const p = f.properties as Record<string, string>;
          new maplibregl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(`<div style="font-size:12px"><strong>${p.name}</strong><br/><span style="color:#8892a4">${p.type} · ${p.region}</span></div>`)
            .addTo(map);
        });

        map.on("mouseenter", "vessels-circle", () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", "vessels-circle", () => { map.getCanvas().style.cursor = ""; });
        map.on("mouseenter", "terminals-circle", () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", "terminals-circle", () => { map.getCanvas().style.cursor = ""; });
      });
    };

    initMap();
    return () => {
      mapInstance.current?.remove();
      mapInstance.current = null;
    };
  }, []);

  return <div ref={mapRef} className="w-full h-full" />;
}
