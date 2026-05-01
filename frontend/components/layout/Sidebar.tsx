"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Ship, Map, Database, TrendingUp, BookOpen, Activity
} from "lucide-react";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/vessels", label: "Vessel Flows", icon: Ship },
  { href: "/map", label: "Map", icon: Map },
  { href: "/storage", label: "Storage & Terminals", icon: Database },
  { href: "/market", label: "Market Drivers", icon: TrendingUp },
  { href: "/methodology", label: "Methodology", icon: BookOpen },
];

export default function Sidebar() {
  const path = usePathname();
  return (
    <aside className="w-56 bg-surface border-r border-border flex flex-col shrink-0">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-400" />
          <span className="font-semibold text-sm text-white">LNG Intelligence</span>
        </div>
        <p className="text-xs text-text-muted mt-1">US LNG Flow Monitor</p>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
              path === href || path.startsWith(href + "/")
                ? "bg-blue-600/20 text-blue-300 font-medium"
                : "text-text-muted hover:text-slate-200 hover:bg-surface-2"
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="p-3 border-t border-border">
        <p className="text-xs text-text-muted">v1.0 · Sample data mode</p>
      </div>
    </aside>
  );
}
