"use client"

import { AnalysisResult, GWRow } from "@/lib/types"

const CLUSTER_BADGE: Record<string, string> = {
  Conservative: "badge-conservative",
  Volatile:     "badge-volatile",
  Aggressive:   "badge-aggressive",
}

function computeInsights(rows: GWRow[], summary: AnalysisResult["summary"], clusterLabels: Record<string, string>, clusters: Record<number, number>): string[] {
  const insights: string[] = []

  // Rolling (no transfer) weeks vs average
  const rollGws = rows.filter((r) => r.transfers === 0 && !r.hit)
  if (rollGws.length >= 3) {
    const rollAvg = Math.round(rollGws.reduce((a, r) => a + r.points, 0) / rollGws.length)
    const diff = rollAvg - summary.avg_points
    if (diff >= 5)  insights.push(`You score ${diff} pts above average when rolling transfers`)
    else if (diff <= -5) insights.push(`Rolling transfers costs you ~${Math.abs(diff)} pts on average`)
  }

  // Hit week performance
  const hitGws   = rows.filter((r) => r.hit && r.hit > 0)
  const noHitGws = rows.filter((r) => !r.hit || r.hit === 0)
  if (hitGws.length >= 2 && noHitGws.length >= 2) {
    const hitAvg   = Math.round(hitGws.reduce((a, r)   => a + r.points, 0) / hitGws.length)
    const noHitAvg = Math.round(noHitGws.reduce((a, r) => a + r.points, 0) / noHitGws.length)
    const net = hitAvg - noHitAvg - 4  // net of hit cost
    if (net >= 3)  insights.push(`Hits pay off for you — net +${net} pts vs no-hit weeks`)
    else           insights.push(`Hits rarely pay — net ${net >= 0 ? "+" : ""}${net} pts after the cost`)
  }

  // Best performing cluster
  const clusterGroups: Record<string, number[]> = {}
  rows.forEach((r) => {
    const label = clusterLabels[String(clusters[r.gw])] ?? "Unknown"
    if (!clusterGroups[label]) clusterGroups[label] = []
    clusterGroups[label].push(r.points)
  })
  const best = Object.entries(clusterGroups)
    .map(([label, pts]) => ({ label, avg: Math.round(pts.reduce((a, b) => a + b, 0) / pts.length) }))
    .sort((a, b) => b.avg - a.avg)[0]
  if (best) insights.push(`${best.label} weeks are your best — ${best.avg} pts avg`)

  return insights.slice(0, 3)
}

function computeRiskScore(rows: GWRow[], summary: AnalysisResult["summary"]): number {
  const hitFreq  = (summary.hit_weeks_count / Math.max(rows.length, 1)) * 100
  const variance = rows.length > 1
    ? Math.sqrt(rows.reduce((a, r) => a + Math.pow(r.points - summary.avg_points, 2), 0) / rows.length)
    : 0
  const highTransferGws = rows.filter((r) => r.transfers >= 3).length
  const highTransferFreq = (highTransferGws / Math.max(rows.length, 1)) * 100
  return Math.min(Math.round(hitFreq * 0.5 + variance * 0.8 + highTransferFreq * 0.3), 100)
}

interface Props {
  result: AnalysisResult
  entryId: string
}

export default function BrainPanel({ result, entryId }: Props) {
  const { rows, clusters, cluster_labels, similar_weeks, summary } = result

  const latestRow     = rows[rows.length - 1]
  const latestCluster = clusters[latestRow.gw]
  const latestLabel   = cluster_labels[String(latestCluster)] ?? "Unknown"
  const badgeClass    = CLUSTER_BADGE[latestLabel] ?? "badge-volatile"
  const insights      = computeInsights(rows, summary, cluster_labels, clusters)
  const riskScore     = computeRiskScore(rows, summary)

  const rowByGw: Record<number, GWRow> = {}
  rows.forEach((r) => (rowByGw[r.gw] = r))

  return (
    <div className="card p-5 space-y-5 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0"
             style={{ background: "rgba(0,255,128,0.12)", border: "1px solid rgba(0,255,128,0.2)" }}>
          🧠
        </div>
        <div>
          <h2 className="text-sm font-bold text-white">Season Brain</h2>
          <p className="text-[11px]" style={{ color: "#8B949E" }}>Entry #{entryId}</p>
        </div>
      </div>

      {/* Latest GW Style */}
      <div className="rounded-xl p-3.5" style={{ background: "rgba(0,255,128,0.06)", border: "1px solid rgba(0,255,128,0.15)" }}>
        <p className="text-[11px] font-medium mb-1.5" style={{ color: "#8B949E" }}>
          Latest GW Style
        </p>
        <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-bold ${badgeClass}`}>
          {latestLabel}
        </span>
      </div>

      {/* Similar Weeks */}
      {similar_weeks.length > 0 && (
        <div>
          <p className="text-xs font-semibold mb-2.5" style={{ color: "#8B949E" }}>
            ∿ Similar Weeks
          </p>
          <div className="space-y-2">
            {similar_weeks.map(({ gw, distance }) => {
              const r   = rowByGw[gw]
              const pct = Math.round((1 - distance) * 100)
              return (
                <div
                  key={gw}
                  className="flex items-center justify-between rounded-xl px-3 py-2.5"
                  style={{ background: "#0B0E13", border: "1px solid var(--border)" }}
                >
                  <div>
                    <span className="text-sm font-bold text-white">GW {gw}</span>
                    {r?.chip && (
                      <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: "rgba(0,255,128,0.12)", color: "#00FF80" }}>
                        {r.chip.toUpperCase()}
                      </span>
                    )}
                    <p className="text-xs mt-0.5" style={{ color: "#8B949E" }}>
                      {r?.points ?? "—"} pts · {r?.transfers ?? 0} transfers{r?.hit ? ` · −${r.hit} hit` : ""}
                    </p>
                  </div>
                  <span
                    className="text-xs font-bold px-2.5 py-1 rounded-lg"
                    style={{ background: "rgba(0,255,128,0.12)", color: "#00FF80" }}
                  >
                    {pct}%
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* What Works For You */}
      {insights.length > 0 && (
        <div>
          <p className="text-xs font-semibold mb-2.5" style={{ color: "#8B949E" }}>
            ✦ What Works For You
          </p>
          <div className="space-y-1.5">
            {insights.map((ins, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="mt-0.5 text-[10px]" style={{ color: "#00FF80" }}>●</span>
                <p className="text-xs text-white leading-relaxed">{ins}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Risk Profile */}
      <div>
        <p className="text-xs font-semibold mb-2.5" style={{ color: "#8B949E" }}>
          ⚡ Risk Profile
        </p>
        <div className="rounded-xl p-3.5" style={{ background: "#0B0E13", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-white">Risk Score</span>
            <span className="text-lg font-extrabold" style={{ color: riskScore >= 70 ? "#F85149" : riskScore >= 40 ? "#F0B429" : "#00FF80" }}>
              {riskScore}
            </span>
          </div>
          <div className="w-full rounded-full h-1.5" style={{ background: "var(--border)" }}>
            <div
              className="h-1.5 rounded-full transition-all"
              style={{
                width: `${riskScore}%`,
                background: riskScore >= 70 ? "#F85149" : riskScore >= 40 ? "#F0B429" : "#00FF80",
              }}
            />
          </div>
          <p className="text-[10px] mt-1.5" style={{ color: "#8B949E" }}>
            {riskScore >= 70 ? "High risk — heavy hitter style" : riskScore >= 40 ? "Moderate risk — balanced approach" : "Low risk — disciplined manager"}
          </p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Avg Pts / GW",    value: String(summary.avg_points) },
          { label: "Total Hit Cost",  value: `-${summary.total_hits} pts` },
          { label: "Best GW",         value: `GW${summary.best_gw} · ${rowByGw[summary.best_gw]?.points ?? "—"}` },
          { label: "Worst GW",        value: `GW${summary.worst_gw} · ${rowByGw[summary.worst_gw]?.points ?? "—"}` },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl p-3" style={{ background: "#0B0E13", border: "1px solid var(--border)" }}>
            <p className="text-[10px]" style={{ color: "#8B949E" }}>{label}</p>
            <p className="text-sm font-bold text-white mt-0.5">{value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
