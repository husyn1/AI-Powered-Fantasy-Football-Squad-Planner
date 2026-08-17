"use client"

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { GWRow } from "@/lib/types"

const CLUSTER_COLORS: Record<number, string> = {
  0: "#00FF80",  // Conservative — neon green
  1: "#F0B429",  // Volatile     — amber
  2: "#F85149",  // Aggressive   — red
}

interface Props {
  rows: GWRow[]
  clusters: Record<number, number>
  clusterLabels: Record<string, string>
}

function ClusterDot(props: {
  cx?: number
  cy?: number
  payload?: GWRow
  clusters: Record<number, number>
}) {
  const { cx, cy, payload, clusters } = props
  if (cx == null || cy == null || !payload) return null
  const cid   = clusters[payload.gw] ?? 0
  const color = CLUSTER_COLORS[cid] ?? "#00FF80"
  return (
    <g>
      <circle cx={cx} cy={cy} r={5} fill={color} stroke="#0B0E13" strokeWidth={1.5} />
      {payload.chip && (
        <>
          <rect x={cx - 18} y={cy - 22} width={36} height={14} rx={4}
                fill="rgba(0,255,128,0.15)" stroke="rgba(0,255,128,0.4)" strokeWidth={0.8} />
          <text x={cx} y={cy - 12} textAnchor="middle" fontSize={8} fill="#00FF80" fontWeight="700">
            GW{payload.gw}: {payload.chip.toUpperCase()}
          </text>
        </>
      )}
    </g>
  )
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as GWRow & { clusterLabel: string }
  return (
    <div className="card p-3 text-xs space-y-1 shadow-2xl" style={{ minWidth: 120 }}>
      <p className="font-bold text-white">GW {d.gw}</p>
      <p style={{ color: "#00FF80" }}>{d.points} pts</p>
      {d.chip && <p style={{ color: "#F0B429" }}>Chip: {d.chip}</p>}
      <p style={{ color: "#8B949E" }}>Style: {d.clusterLabel}</p>
      {d.overall_rank && (
        <p style={{ color: "#8B949E" }}>Rank: {d.overall_rank.toLocaleString()}</p>
      )}
    </div>
  )
}

export default function PointsChart({ rows, clusters, clusterLabels }: Props) {
  const data = rows.map((r) => ({
    ...r,
    clusterLabel: clusterLabels[String(clusters[r.gw])] ?? "—",
  }))

  const chipGws = rows.filter((r) => r.chip)

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <span style={{ color: "#00FF80" }}>∿</span>
        <h2 className="text-sm font-semibold text-white">Season Points</h2>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 20, right: 16, bottom: 0, left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1E2530" />
          <XAxis
            dataKey="gw"
            tick={{ fill: "#8B949E", fontSize: 11 }}
            label={{ value: "Gameweek", position: "insideBottomRight", offset: -4, fill: "#8B949E", fontSize: 11 }}
          />
          <YAxis tick={{ fill: "#8B949E", fontSize: 11 }} />
          <Tooltip content={<CustomTooltip />} />
          {chipGws.map((r) => (
            <ReferenceLine
              key={r.gw}
              x={r.gw}
              stroke="rgba(0,255,128,0.3)"
              strokeDasharray="4 3"
            />
          ))}
          <Line
            type="monotone"
            dataKey="points"
            stroke="#00FF80"
            strokeWidth={2}
            dot={(props) => (
              <ClusterDot key={props.payload.gw} {...props} clusters={clusters} />
            )}
            activeDot={{ r: 7, fill: "#00FF80", stroke: "#0B0E13", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-4 mt-3 text-xs">
        {Object.entries(CLUSTER_COLORS).map(([id, color]) => (
          <span key={id} className="flex items-center gap-1.5" style={{ color: "#8B949E" }}>
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: color }} />
            {clusterLabels[id] ?? `Cluster ${id}`}
          </span>
        ))}
      </div>
    </div>
  )
}
