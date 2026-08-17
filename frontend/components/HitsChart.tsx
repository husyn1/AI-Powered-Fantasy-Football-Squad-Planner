"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { GWRow } from "@/lib/types"

function CustomTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as GWRow
  return (
    <div className="card p-3 text-xs space-y-1 shadow-2xl">
      <p className="font-bold text-white">GW {d.gw}</p>
      <p style={{ color: d.hit > 0 ? "#F85149" : "#00FF80" }}>
        Hit: -{d.hit} pts
      </p>
      <p style={{ color: "#8B949E" }}>Transfers: {d.transfers}</p>
      {d.chip && <p style={{ color: "#F0B429" }}>Chip: {d.chip}</p>}
    </div>
  )
}

export default function HitsChart({ rows }: { rows: GWRow[] }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <span style={{ color: "#F85149" }}>⊘</span>
        <h2 className="text-sm font-semibold text-white">Transfer Hits Impact</h2>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={rows} margin={{ top: 4, right: 16, bottom: 0, left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1E2530" />
          <XAxis dataKey="gw" tick={{ fill: "#8B949E", fontSize: 11 }} />
          <YAxis tick={{ fill: "#8B949E", fontSize: 11 }} allowDecimals={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
          <Bar dataKey="hit" radius={[4, 4, 0, 0]}>
            {rows.map((r) => (
              <Cell
                key={r.gw}
                fill={r.hit > 0 ? (r.hit <= 4 ? "#F0B429" : "#F85149") : "rgba(0,255,128,0.15)"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex gap-4 mt-3 text-xs" style={{ color: "#8B949E" }}>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "rgba(0,255,128,0.15)" }} />
          No hit
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm inline-block bg-[#F0B429]" />
          −4 pts
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm inline-block bg-[#F85149]" />
          −8+ pts
        </span>
      </div>
    </div>
  )
}
