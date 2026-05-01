import { api } from "@/lib/api";
import LNGMap from "@/components/map/LNGMap";

export const revalidate = 60;

export default async function MapPage() {
  const [voyagesData, terminals] = await Promise.all([
    api.flows.activeVoyages(),
    api.terminals(),
  ]);

  const voyages = voyagesData?.voyages ?? [];

  return (
    <div className="space-y-4 h-full">
      <div>
        <h2 className="text-xl font-semibold text-white">Map View</h2>
        <p className="text-sm text-text-muted mt-0.5">
          Active LNG vessel positions and terminal locations
        </p>
      </div>
      <div className="flex gap-4 text-xs text-text-muted">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"/> Europe-bound
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"/> Asia-bound
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-gray-500 inline-block"/> Uncertain
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 inline-block"/> US Export terminal
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 bg-green-700 inline-block"/> Import terminal
        </span>
      </div>
      <div className="rounded-lg overflow-hidden border border-border" style={{ height: "calc(100vh - 240px)" }}>
        <LNGMap voyages={voyages} terminals={terminals ?? []} />
      </div>
    </div>
  );
}
