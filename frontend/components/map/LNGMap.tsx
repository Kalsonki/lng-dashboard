"use client";
import { useRef, useEffect, useState, useCallback } from "react";
import type { Voyage, Terminal } from "@/lib/types";
import { destinationColor } from "@/lib/utils";

interface Props {
  voyages: Voyage[];
  terminals: Terminal[];
}

type SizeFilter = "all" | "small" | "medium" | "large";

function sizeCat(m3: number | null | undefined): string {
  if (m3 == null) return "unknown";
  if (m3 < 100_000) return "small";
  if (m3 <= 175_000) return "medium";
  return "large";
}

const SIZE_LABELS: Record<SizeFilter, string> = {
  all: "All sizes",
  small: "< 100k m³",
  medium: "100–175k m³",
  large: "> 175k m³",
};

const REGION_LABEL: Record<string, string> = {
  europe: "Europe", asia: "Asia", us_gulf: "US Gulf",
  us_east: "US East", mideast: "Middle East", uncertain: "Uncertain",
};

const CANAL_WAYPOINTS: Record<string, [number, number][]> = {
  "us_gulf→europe":  [[-60, 30], [-20, 38]],
  "us_east→europe":  [[-40, 42]],
  "us_gulf→asia":    [[-85, 10], [-79.9, 9.1], [-100, 15], [-140, 20]],
  "us_east→asia":    [[-79.9, 9.1], [-120, 10]],
  "mideast→europe":  [[55, 15], [43, 13], [32.5, 30.5], [28, 34]],
  "mideast→asia":    [[60, 15]],
  "asia→europe":     [[100, 5], [80, 8], [60, 12], [43, 13], [32.5, 30.5]],
};

function findTerminal(terminals: Terminal[], name: string | number | null | undefined): Terminal | undefined {
  if (!name) return undefined;
  const n = String(name).toLowerCase().trim();
  return terminals.find(t => t.name.toLowerCase() === n)
    ?? terminals.find(t => t.name.toLowerCase().includes(n) || n.includes(t.name.toLowerCase()));
}

function greatCircleArc(from: [number, number], to: [number, number], steps = 50): [number, number][] {
  const R = Math.PI / 180;
  const [ln1, lt1] = [from[0] * R, from[1] * R];
  const [ln2, lt2] = [to[0] * R, to[1] * R];
  const d = 2 * Math.asin(Math.sqrt(
    Math.sin((lt2 - lt1) / 2) ** 2 +
    Math.cos(lt1) * Math.cos(lt2) * Math.sin((ln2 - ln1) / 2) ** 2
  ));
  if (d < 0.001) return [from, to];
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(lt1) * Math.cos(ln1) + B * Math.cos(lt2) * Math.cos(ln2);
    const y = A * Math.cos(lt1) * Math.sin(ln1) + B * Math.cos(lt2) * Math.sin(ln2);
    const z = A * Math.sin(lt1) + B * Math.sin(lt2);
    pts.push([Math.atan2(y, x) / R, Math.atan2(z, Math.sqrt(x * x + y * y)) / R]);
  }
  return pts;
}

function buildRoute(
  originT: Terminal | undefined,
  destT: Terminal | undefined,
  originRegion: string,
  destRegion: string,
): [number, number][] {
  if (!originT || !destT) return [];
  const key = `${originRegion}→${destRegion}`;
  const waypoints: [number, number][] = CANAL_WAYPOINTS[key] ?? [];
  const nodes: [number, number][] = [
    [originT.lon, originT.lat],
    ...waypoints,
    [destT.lon, destT.lat],
  ];
  const route: [number, number][] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const seg = greatCircleArc(nodes[i], nodes[i + 1], 40);
    if (i > 0) seg.shift();
    route.push(...seg);
  }
  return route;
}

// Build MapLibre filter expression combining layer base filter with size category
function makeFilter(base: unknown[], cats: string[]): unknown[] {
  if (cats.length === 0) return ["==", "1", "0"]; // hide all
  const sizeExpr: unknown[] = ["in", ["get", "size_cat"], ["literal", cats]];
  return ["all", ...base.slice(1), sizeExpr];
}

const BASE_FILTERS = {
  "vessels-ais":   ["==", ["get", "data_source"], "ais_only"],
  "vessels-other": ["all", ["==", ["get", "data_source"], "voyage"], ["==", ["get", "is_us_origin"], 0]],
  "vessels-us":    ["all", ["==", ["get", "is_us_origin"], 1]],
} as const;

export default function LNGMap({ voyages, terminals }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<import("maplibre-gl").Map | null>(null);
  const [sizeFilter, setSizeFilter] = useState<SizeFilter>("all");
  const [mapReady, setMapReady] = useState(false);

  const applyFilter = useCallback((sf: SizeFilter) => {
    const map = mapInstance.current;
    if (!map) return;
    const cats = sf === "all" ? ["small", "medium", "large", "unknown"] : [sf, "unknown"];
    for (const [layer, base] of Object.entries(BASE_FILTERS)) {
      map.setFilter(layer, makeFilter([...base] as unknown[], cats) as never);
    }
  }, []);

  useEffect(() => {
    if (!mapReady) return;
    applyFilter(sizeFilter);
  }, [sizeFilter, mapReady, applyFilter]);

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
        map.addSource("route", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#ffffff", "line-width": 2, "line-dasharray": [6, 4], "line-opacity": 0.5 },
        });

        map.addSource("terminals", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: terminals.map(t => ({
              type: "Feature" as const,
              geometry: { type: "Point" as const, coordinates: [t.lon, t.lat] },
              properties: {
                name: t.name, type: t.terminal_type, region: t.region,
                color: t.is_us_export ? "#06b6d4" : t.region === "europe" ? "#22c55e" : "#f59e0b",
              },
            })),
          },
        });
        map.addLayer({
          id: "terminals-circle", type: "circle", source: "terminals",
          paint: { "circle-radius": 5, "circle-color": ["get", "color"], "circle-opacity": 0.85, "circle-stroke-width": 1, "circle-stroke-color": "#000" },
        });

        const vesselGeoJSON = {
          type: "FeatureCollection" as const,
          features: voyages.filter(v => v.lat != null && v.lon != null).map(v => ({
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: [v.lon!, v.lat!] },
            properties: {
              name: v.vessel_name, mmsi: v.mmsi,
              origin: v.origin_terminal_name,
              origin_region: v.origin_region,
              destination_name: v.inferred_destination_name,
              destination: v.inferred_destination_name || REGION_LABEL[v.inferred_destination_region ?? ""] || "Unknown",
              region: v.inferred_destination_region,
              confidence: Math.round((v.destination_confidence || 0) * 100),
              speed: v.speed,
              heading: v.heading,
              capacity: v.cargo_capacity_m3,
              size_cat: sizeCat(v.cargo_capacity_m3),
              is_us_origin: v.is_us_origin ? 1 : 0,
              data_source: v.data_source ?? "voyage",
              color: v.data_source === "ais_only"
                ? "#6b7280"
                : destinationColor(v.inferred_destination_region),
            },
          })),
        };

        map.addSource("vessels", { type: "geojson", data: vesselGeoJSON });

        map.addLayer({
          id: "vessels-ais", type: "circle", source: "vessels",
          filter: ["==", ["get", "data_source"], "ais_only"],
          paint: {
            "circle-radius": 5, "circle-color": "#6b7280",
            "circle-opacity": 0.7, "circle-stroke-width": 1, "circle-stroke-color": "#374151",
          },
        });

        map.addLayer({
          id: "vessels-other", type: "circle", source: "vessels",
          filter: ["all", ["==", ["get", "data_source"], "voyage"], ["==", ["get", "is_us_origin"], 0]],
          paint: {
            "circle-radius": 7, "circle-color": ["get", "color"],
            "circle-opacity": 0.75, "circle-stroke-width": 1.5, "circle-stroke-color": "#fff",
          },
        });

        map.addLayer({
          id: "vessels-us", type: "circle", source: "vessels",
          filter: ["==", ["get", "is_us_origin"], 1],
          paint: {
            "circle-radius": 9, "circle-color": ["get", "color"],
            "circle-opacity": 1, "circle-stroke-width": 3, "circle-stroke-color": "#fff",
          },
        });

        let activePopup: import("maplibre-gl").Popup | null = null;
        const vesselLayers = ["vessels-us", "vessels-other", "vessels-ais"];

        map.on("click", "vessels-us", handleVesselClick);
        map.on("click", "vessels-other", handleVesselClick);
        map.on("click", "vessels-ais", handleVesselClick);

        function handleVesselClick(e: import("maplibre-gl").MapMouseEvent & { features?: import("maplibre-gl").MapGeoJSONFeature[] }) {
          const f = e.features?.[0];
          if (!f) return;
          const p = f.properties as Record<string, string | number | null>;

          const originT = findTerminal(terminals, p.origin)
            ?? terminals.find(t => t.region === p.origin_region && t.is_us_export);
          const destT = findTerminal(terminals, p.destination_name)
            ?? terminals.find(t => t.region === String(p.region) && !t.is_us_export);

          const routeCoords = buildRoute(
            originT, destT,
            String(p.origin_region || ""), String(p.region || "")
          );

          (map.getSource("route") as import("maplibre-gl").GeoJSONSource).setData({
            type: "FeatureCollection",
            features: routeCoords.length > 1 ? [{
              type: "Feature",
              geometry: { type: "LineString", coordinates: routeCoords },
              properties: {},
            }] : [],
          });

          const regionLabel = REGION_LABEL[String(p.region)] ?? String(p.region) ?? "Unknown";
          const canalNote = CANAL_WAYPOINTS[`${p.origin_region}→${p.region}`]
            ? (String(p.origin_region).startsWith("us") && p.region === "asia" ? " via Panama" : " via Suez")
            : "";
          const isUS = p.is_us_origin === 1;
          const isAIS = p.data_source === "ais_only";
          const capStr = p.capacity ? `${Math.round(Number(p.capacity) / 1000)}k m³` : null;

          activePopup?.remove();
          activePopup = new maplibregl.Popup({ maxWidth: "300px" })
            .setLngLat(e.lngLat)
            .setHTML(`
              <div style="background:#1e293b;color:#e2e8f0;font-family:sans-serif;font-size:12px;padding:2px">
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
                  <div style="font-size:14px;font-weight:700">${p.name}</div>
                  ${isUS ? '<span style="background:#1d4ed8;color:#fff;font-size:10px;padding:1px 5px;border-radius:3px">US LNG</span>' : ""}
                  ${isAIS ? '<span style="background:#374151;color:#9ca3af;font-size:10px;padding:1px 5px;border-radius:3px">AIS only</span>' : ""}
                </div>
                <div style="color:#64748b;margin-bottom:10px;font-size:11px">MMSI: ${p.mmsi}</div>
                <table style="width:100%;border-collapse:collapse">
                  ${p.origin ? `<tr><td style="color:#94a3b8;padding:3px 0;width:90px">From</td><td style="font-weight:600">${p.origin}</td></tr>` : ""}
                  ${!isAIS ? `<tr><td style="color:#94a3b8;padding:3px 0">To</td><td style="font-weight:600">${p.destination || regionLabel}${canalNote}</td></tr>` : ""}
                  ${p.ais_destination ? `<tr><td style="color:#94a3b8;padding:3px 0">AIS dest</td><td>${p.ais_destination}</td></tr>` : ""}
                  ${!isAIS ? `<tr><td style="color:#94a3b8;padding:3px 0">Confidence</td><td>${p.confidence}%</td></tr>` : ""}
                  ${capStr ? `<tr><td style="color:#94a3b8;padding:3px 0">Capacity</td><td>${capStr}</td></tr>` : ""}
                  ${p.speed ? `<tr><td style="color:#94a3b8;padding:3px 0">Speed</td><td>${Number(p.speed).toFixed(1)} kn</td></tr>` : ""}
                  ${p.heading != null ? `<tr><td style="color:#94a3b8;padding:3px 0">Heading</td><td>${p.heading}°</td></tr>` : ""}
                </table>
              </div>
            `)
            .addTo(map);
        }

        map.on("click", (e) => {
          if (!map.queryRenderedFeatures(e.point, { layers: vesselLayers }).length) {
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

        for (const layer of vesselLayers) {
          map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
          map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
        }
        map.on("mouseenter", "terminals-circle", () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", "terminals-circle", () => { map.getCanvas().style.cursor = ""; });

        setMapReady(true);
      });
    };

    initMap();
    return () => { mapInstance.current?.remove(); mapInstance.current = null; };
  }, []);

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" />
      {mapReady && (
        <div className="absolute top-2 right-2 flex gap-1 bg-slate-900/90 backdrop-blur rounded-md p-1 border border-slate-700">
          {(["all", "small", "medium", "large"] as SizeFilter[]).map(sz => (
            <button
              key={sz}
              onClick={() => setSizeFilter(sz)}
              className={`px-2.5 py-1 text-xs rounded transition-colors ${
                sizeFilter === sz
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-700"
              }`}
            >
              {SIZE_LABELS[sz]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
