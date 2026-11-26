"use client";

import { useEffect, useState } from "react";
import { fetchPlatformStats, isStatsEmpty, type PlatformStats } from "@/app/lib/platform_stats";

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; stats: PlatformStats };

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: "16px 20px", border: "1px solid #2a2f3d", borderRadius: 8 }}>
      <div style={{ fontSize: 12, opacity: 0.7 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function BarChart({ title, data }: { title: string; data: { label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 28;
  return (
    <figure style={{ margin: "24px 0" }}>
      <figcaption style={{ marginBottom: 8, fontWeight: 600 }}>{title}</figcaption>
      {data.length === 0 ? (
        <p style={{ opacity: 0.7 }}>No data yet.</p>
      ) : (
        <svg
          role="img"
          aria-label={title}
          viewBox={`0 0 ${data.length * w} 100`}
          style={{ width: "100%", maxWidth: 640, height: 160 }}
          preserveAspectRatio="none"
        >
          {data.map((d, i) => {
            const h = (d.value / max) * 90;
            return (
              <rect key={d.label} x={i * w + 3} y={100 - h} width={w - 6} height={h} fill="#6c8cff">
                <title>{`${d.label}: ${fmt(d.value)}`}</title>
              </rect>
            );
          })}
        </svg>
      )}
      <ul style={{ fontSize: 12, opacity: 0.8, display: "flex", flexWrap: "wrap", gap: 12, padding: 0, listStyle: "none" }}>
        {data.map((d) => (
          <li key={d.label}>
            {d.label}: {fmt(d.value)}
          </li>
        ))}
      </ul>
    </figure>
  );
}

export default function PlatformStatsView() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    const ctrl = new AbortController();
    fetchPlatformStats(ctrl.signal)
      .then((stats) => setState({ kind: "ready", stats }))
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return;
        setState({ kind: "error", message: e instanceof Error ? e.message : "Unknown error" });
      });
    return () => ctrl.abort();
  }, []);

  if (state.kind === "loading") return <p role="status">Loading platform statistics...</p>;
  if (state.kind === "error")
    return <p role="alert">Could not load platform statistics. {state.message}</p>;
  const s = state.stats;
  if (isStatsEmpty(s)) return <p>No platform activity yet. Check back soon.</p>;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <Stat label="Jobs created" value={fmt(s.jobsCreated)} />
        <Stat label="Total escrowed" value={fmt(s.totalEscrowed)} />
        <Stat label="Total released" value={fmt(s.totalReleased)} />
        <Stat label="Total refunded" value={fmt(s.totalRefunded)} />
        <Stat label="Dispute rate" value={`${fmt(s.disputeRate * 100)}%`} />
        <Stat
          label="Median time to resolution"
          value={s.medianResolutionHours == null ? "n/a" : `${fmt(s.medianResolutionHours)} h`}
        />
      </div>
      <BarChart title="Jobs per week" data={s.jobsPerWeek.map((d) => ({ label: d.week, value: d.count }))} />
      <BarChart title="Value by token" data={s.valueByToken.map((d) => ({ label: d.token, value: d.value }))} />
      <BarChart title="Dispute outcomes" data={s.disputeOutcomes.map((d) => ({ label: d.outcome, value: d.count }))} />
    </div>
  );
}
