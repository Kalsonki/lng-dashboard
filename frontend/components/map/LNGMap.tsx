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
        // Add terminals as circles
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

        // Add vessels
        const vesselFeatures = voyages
          .filter(v => v.lat !== null && v.lon !== null)
          .map(v => ({
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: [v.lon!, v.lat!] },
            properties: {
              name: v.vessel_name, mmsi: v.mmsi,
              origin: v.origin_terminal_name,
              destination: v.inferred_destination_name || v.inferred_destination_region,
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
            "circle-radius": 7,
            "circle-color": ["get", "color"],
            "circle-opacity": 0.9,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#fff",
          },
        });

        // Vessel popups
        map.on("click", "vessels-circle", (e) => {
          const f = e.features?.[0];
          if (!f) return;
          const p = f.properties as Record<string, string | number>;
          new maplibregl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(`
              <div style="font-size:12px">
                <strong style="font-size:13px">${p.name}</strong><br/>
                <span style="color:#8892a4">MMSI: ${p.mmsi}</span><br/><br/>
                <strong>Origin:</strong> ${p.origin}<br/>
                <strong>Destination:</strong> ${p.destination}<br/>
                <strong>Confidence:</strong> ${p.confidence}%<br/>
                ${p.speed ? `<strong>Speed:</strong> ${Number(p.speed).toFixed(1)} kn` : ""}
              </div>
            `)
            .addTo(map);
        });

        // Terminal popups
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
  }, []);  // Only init once

  return <div ref={mapRef} className="w-full h-full" />;
}
