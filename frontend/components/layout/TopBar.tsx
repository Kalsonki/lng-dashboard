"use client";
import { useState, useEffect } from "react";
import { RefreshCw, Clock } from "lucide-react";

export default function TopBar() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const update = () => setTime(new Date().toUTCString().slice(0, 25) + " UTC");
    update();
    const t = setInterval(update, 60000);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="h-12 border-b border-border bg-surface flex items-center justify-between px-6 shrink-0">
      <h1 className="text-sm font-medium text-slate-300">
        LNG Flow Intelligence — US Export Routing Monitor
      </h1>
      <div className="flex items-center gap-4 text-xs text-text-muted">
        <span className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          {time}
        </span>
        <span className="flex items-center gap-1.5 text-amber-400">
          <RefreshCw className="w-3.5 h-3.5" />
          Sample Data Mode
        </span>
      </div>
    </header>
  );
}
