"use client"

import { useEffect, useState, } from "react"
import { getWeeklyPlan } from "@/lib/api"
import { WeeklyPlan, CaptainPick, ChipAdvice, RoadmapGW, SuggestedMove } from "@/lib/types"
import MoveCard from "./MoveCard"
import PlayerAvatar from "./PlayerAvatar"

type Tab = "captain" | "transfers" | "chips" | "roadmap"

// ── Captain tab ──────────────────────────────────────────────────────────────

function StatPill({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className={`flex flex-col items-center px-2 py-1.5 rounded-lg ${highlight ? "bg-[rgba(0,255,128,0.08)] border border-[rgba(0,255,128,0.2)]" : "bg-[#0B0E13]"}`}>
      <span className="text-[9px] text-[#8B949E] uppercase tracking-wide">{label}</span>
      <span className={`text-xs font-bold mt-0.5 ${highlight ? "text-[#00FF80]" : "text-white"}`}>{value}</span>
    </div>
  )
}

function CaptainCard({ pick, rank }: { pick: CaptainPick; rank: number }) {
  const p = pick.player
  const scoreColor = pick.score >= 9 ? "text-emerald-400" : pick.score >= 7 ? "text-yellow-400" : "text-[#8B949E]"

  return (
    <div className={`card p-4 ${rank === 0 ? "ring-1 ring-[rgba(0,255,128,0.3)]" : ""}`}>
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="relative shrink-0">
          <PlayerAvatar name={p.name} team={p.team} pos={p.pos} status={p.status} size="md" />
          {rank === 0 && (
            <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center text-[10px]">🏆</div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-bold text-white text-sm leading-tight">{p.name}</p>
              <p className="text-xs text-[#8B949E]">{p.pos} · {p.team} · £{p.price}m</p>
            </div>
            <div className="text-right shrink-0">
              <p className={`text-lg font-extrabold ${scoreColor}`}>{pick.score}</p>
              <p className="text-[10px] text-[#8B949E]">score</p>
            </div>
          </div>

          {/* Next fixture */}
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${pick.next_fix_difficulty <= 2 ? "bg-emerald-900/60 text-emerald-400" : pick.next_fix_difficulty >= 4 ? "bg-red-900/60 text-red-400" : "bg-yellow-900/60 text-yellow-400"}`}>
              fdr {pick.next_fix_difficulty}
            </span>
            <span className="text-xs text-[#8B949E]">
              vs {pick.next_opponent} {pick.is_home ? "(H)" : "(A)"}
            </span>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-1.5 mt-3">
        <StatPill label="Form" value={p.form} highlight />
        <StatPill label="xP" value={p.ep_next} highlight />
        <StatPill label="Last 5" value={pick.last5_avg} />
        <StatPill label="Pts" value={p.total_pts} />
      </div>
      <div className="grid grid-cols-4 gap-1.5 mt-1.5">
        <StatPill label="Home" value={pick.avg_home} />
        <StatPill label="Away" value={pick.avg_away} />
        <StatPill label="vs Easy" value={pick.avg_vs_easy} />
        <StatPill label="vs Hard" value={pick.avg_vs_hard} />
      </div>

      {/* Reasoning */}
      <p className="mt-2.5 text-xs text-[#8B949E] leading-relaxed border-t border-[#1E2530] pt-2.5">
        {pick.reasoning}
      </p>
    </div>
  )
}

// ── Chips tab ────────────────────────────────────────────────────────────────

const URGENCY_STYLE: Record<string, string> = {
  use:     "bg-emerald-900/60 text-emerald-300 border-emerald-700",
  consider:"bg-yellow-900/60 text-yellow-300 border-yellow-700",
  think:   "bg-blue-900/60 text-blue-300 border-blue-700",
  save:    "bg-[#0B0E13] text-[#8B949E] border-slate-700",
}
const URGENCY_LABEL: Record<string, string> = {
  use: "Use now", consider: "Consider", think: "Think about it", save: "Save it",
}

function ChipCard({ chip }: { chip: ChipAdvice }) {
  return (
    <div className="card p-4 flex gap-3 items-start">
      <div className="text-2xl shrink-0">{chip.emoji}</div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-bold text-white">{chip.name}</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${URGENCY_STYLE[chip.urgency]}`}>
            {URGENCY_LABEL[chip.urgency]}
          </span>
        </div>
        <p className="text-xs text-[#8B949E] leading-relaxed">{chip.reasoning}</p>
      </div>
    </div>
  )
}

// ── Roadmap tab ──────────────────────────────────────────────────────────────

const PRIORITY_STYLE: Record<string, string> = {
  high:   "bg-red-900/50 text-red-300 border border-red-800",
  medium: "bg-yellow-900/50 text-yellow-300 border border-yellow-800",
  low:    "bg-[#0B0E13] text-[#8B949E] border border-slate-700",
}

function RoadmapCard({ gw }: { gw: RoadmapGW }) {
  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-bold text-white">GW{gw.gw}</span>
          <span className="text-xs text-[#8B949E] ml-2">{gw.label}</span>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${PRIORITY_STYLE[gw.priority]}`}>
          {gw.priority.toUpperCase()}
        </span>
      </div>

      {/* Actions */}
      <div className="space-y-1.5">
        {gw.actions.map((a, i) => (
          <p key={i} className="text-xs text-white leading-relaxed">{a}</p>
        ))}
      </div>

      {/* Good / Bad fixtures */}
      {gw.good_fixtures.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wide mb-1">✦ Attack these fixtures</p>
          <div className="flex flex-wrap gap-1">
            {gw.good_fixtures.map((f, i) => (
              <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-300">{f}</span>
            ))}
          </div>
        </div>
      )}
      {gw.bad_fixtures.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wide mb-1">✦ Avoid captaining</p>
          <div className="flex flex-wrap gap-1">
            {gw.bad_fixtures.map((f, i) => (
              <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-red-900/40 text-red-300">{f}</span>
            ))}
          </div>
        </div>
      )}
      {gw.blanks.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-[#8B949E] uppercase tracking-wide mb-1">⊘ No fixture</p>
          <p className="text-[10px] text-[#8B949E]">{gw.blanks.join(", ")}</p>
        </div>
      )}
    </div>
  )
}

// ── Main panel ───────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: "captain",   label: "Captain",   emoji: "🎯" },
  { id: "transfers", label: "Transfers", emoji: "🔄" },
  { id: "chips",     label: "Chips",     emoji: "💊" },
  { id: "roadmap",   label: "Roadmap",   emoji: "📅" },
]

export default function WeeklyPlanPanel({ entryId }: { entryId: string }) {
  const [plan, setPlan] = useState<WeeklyPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [tab, setTab] = useState<Tab>("captain")

  function load() {
    setLoading(true); setError("")
    getWeeklyPlan(entryId)
      .then(setPlan)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [entryId])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div>
          <h2 className="text-sm font-bold text-white">Weekly Plan</h2>
          <p className="text-xs text-[#8B949E]">
            {plan ? `GW${plan.gw} · Next: GW${plan.next_gw}` : "Loading…"}
          </p>
        </div>
        {!loading && (
          <button onClick={load} className="text-xs text-[#8B949E] hover:text-[#00FF80] transition-colors">↺</button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-3 shrink-0 rounded-xl p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex flex-col items-center py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
              tab === t.id
                ? "bg-[#00FF80] text-[#0B0E13]"
                : "text-[#8B949E] hover:text-white"
            }`}
          >
            <span className="text-sm">{t.emoji}</span>
            <span className="mt-0.5">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
        {loading && (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <div className="w-6 h-6 border-2 border-[#00FF80] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-[#8B949E]">Analysing squad, fetching player stats…</p>
          </div>
        )}

        {error && (
          <div className="card p-4 text-center">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {!loading && !error && plan && (
          <>
            {tab === "captain" && plan.captain_picks.map((pick, i) => (
              <CaptainCard key={pick.player.id} pick={pick} rank={i} />
            ))}

            {tab === "transfers" && (
              plan.transfers.length === 0
                ? <div className="card p-6 text-center"><p className="text-2xl mb-2">🏆</p><p className="text-sm text-white font-semibold">No urgent transfers</p></div>
                : plan.transfers.map((move, i) => <MoveCard key={i} move={move} index={i} />)
            )}

            {tab === "chips" && plan.chip_advice.map((c, i) => (
              <ChipCard key={i} chip={c} />
            ))}

            {tab === "roadmap" && plan.roadmap.map((gw) => (
              <RoadmapCard key={gw.gw} gw={gw} />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
