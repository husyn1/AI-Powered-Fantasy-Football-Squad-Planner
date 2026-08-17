"use client"

import { FormEvent, useEffect, useState } from "react"
import { analyzeEntry, syncEntry } from "@/lib/api"
import { AnalysisResult } from "@/lib/types"
import ChatPanel from "@/components/ChatPanel"
import WeeklyPlanPanel from "@/components/WeeklyPlanPanel"
import BrainPanel from "@/components/BrainPanel"
import PointsChart from "@/components/PointsChart"
import HitsChart from "@/components/HitsChart"

type View = "input" | "loading" | "done" | "error"

const LAST_ENTRY_KEY = "fpl_last_entry_id"

const STEPS = [
  "Fetching FPL history…",
  "Syncing to Backboard memory…",
  "Running ML analysis…",
  "Loading dashboard…",
]

function NeonBrainIcon({ size = 40 }: { size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-2xl shrink-0"
      style={{ width: size, height: size, background: "#00FF80" }}
    >
      <span style={{ fontSize: size * 0.55, lineHeight: 1 }}>🧠</span>
    </div>
  )
}

export default function Home() {
  const [view, setView]       = useState<View>("input")
  const [entryId, setEntryId] = useState("")
  const [step, setStep]       = useState(0)
  const [data, setData]       = useState<AnalysisResult | null>(null)
  const [error, setError]     = useState("")
  const [statsOpen, setStatsOpen] = useState(false)

  // Pre-fill the last used entry ID on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LAST_ENTRY_KEY)
      if (saved) setEntryId(saved)
    } catch {}
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const id = entryId.trim()
    if (!id) return
    setView("loading"); setStep(0); setError("")
    try {
      setStep(0); await syncEntry(id)
      setStep(2); const result = await analyzeEntry(id)
      setStep(3); setData(result); setView("done")
      try { localStorage.setItem(LAST_ENTRY_KEY, id) } catch {}
    } catch (err: any) {
      setError(err.message ?? "Unknown error"); setView("error")
    }
  }

  /* ── Input / Error ───────────────────────────────────────────────────────── */
  if (view === "input" || view === "error") {
    return (
      <main className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg)" }}>
        <div className="w-full max-w-sm">
          {/* Hero */}
          <div className="flex flex-col items-center mb-8 gap-3">
            <NeonBrainIcon size={56} />
            <div className="text-center">
              <h1 className="text-2xl font-extrabold text-white tracking-tight">FPL Season Brain</h1>
              <p className="text-sm mt-1" style={{ color: "#8B949E" }}>Memory-driven FPL Strategy Assistant</p>
            </div>
          </div>

          {/* Card */}
          <div className="card p-6 space-y-4">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#8B949E" }}>
                FPL Team ID
              </span>
              <input
                type="number"
                min={1}
                placeholder="e.g., 123456"
                value={entryId}
                onChange={(e) => setEntryId(e.target.value)}
                className="mt-2 w-full rounded-xl px-4 py-3 text-sm text-white placeholder-[#8B949E]
                           focus:outline-none focus:ring-2 focus:ring-[#00FF80]/50 transition-all"
                style={{ background: "#0B0E13", border: "1px solid var(--border)" }}
              />
            </label>

            <button
              type="button"
              onClick={(e) => handleSubmit(e as any)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit(e as any)}
              className="w-full py-3 rounded-xl font-bold text-sm tracking-wide transition-all
                         hover:brightness-110 active:scale-[0.98]"
              style={{ background: "#00FF80", color: "#0B0E13" }}
            >
              Load Season
            </button>

            {view === "error" && (
              <p className="text-xs text-center rounded-lg p-2" style={{ color: "#F85149", background: "rgba(248,81,73,0.1)" }}>
                {error}
              </p>
            )}

            {/* Info box */}
            <div className="rounded-xl p-3.5 space-y-1" style={{ background: "#0B0E13", border: "1px solid var(--border)" }}>
              <p className="text-xs font-semibold text-white">Where to find your Team ID:</p>
              <p className="text-xs" style={{ color: "#8B949E" }}>
                Go to the FPL website → Points → Your team URL will be
              </p>
              <p className="text-xs font-medium" style={{ color: "#00FF80" }}>
                fantasy.premierleague.com/entry/[YOUR-ID]
              </p>
            </div>
          </div>
        </div>
      </main>
    )
  }

  /* ── Loading ─────────────────────────────────────────────────────────────── */
  if (view === "loading") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-6 px-4" style={{ background: "var(--bg)" }}>
        <NeonBrainIcon size={52} />
        <div className="space-y-2.5 text-center">
          {STEPS.map((s, i) => (
            <p key={s} className="text-sm transition-all flex items-center justify-center gap-2">
              <span style={{ color: i < step ? "#00FF80" : i === step ? "#FFFFFF" : "#3A4455" }}>
                {i < step ? "✓" : i === step ? "→" : "·"}
              </span>
              <span style={{ color: i < step ? "#00FF80" : i === step ? "#FFFFFF" : "#3A4455", fontWeight: i === step ? 600 : 400 }}>
                {s}
              </span>
            </p>
          ))}
        </div>
      </main>
    )
  }

  /* ── Dashboard ───────────────────────────────────────────────────────────── */
  if (view === "done" && data) {
    const lastGw = data.rows[data.rows.length - 1]?.gw
    return (
      <main className="min-h-screen flex flex-col max-w-7xl mx-auto px-3 py-0 gap-0"
            style={{ background: "var(--bg)" }}>

        {/* ── Navbar ── */}
        <header className="flex items-center justify-between px-1 py-4 mb-3 sticky top-0 z-20"
                style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
          <div>
            <h1 className="text-sm font-semibold text-white tracking-tight">FPL Season Brain</h1>
            <p className="text-[11px] mt-0.5" style={{ color: "#8B949E" }}>
              Entry #{entryId} · GW{lastGw} · {data.rows.length} weeks
            </p>
          </div>
          <button
            onClick={() => { setView("input"); setData(null); setEntryId("") }}
            className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors hover:text-white"
            style={{ background: "var(--card)", border: "1px solid var(--border)", color: "#8B949E" }}
          >
            Switch team
          </button>
        </header>

        {/* ── Chat + Weekly Plan ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_440px] gap-3 mb-3" style={{ height: "640px" }}>
          <ChatPanel entryId={entryId} />
          <div className="card p-4 overflow-hidden flex flex-col">
            <WeeklyPlanPanel entryId={entryId} />
          </div>
        </div>

        {/* ── Season Analytics (collapsible) ── */}
        <div className="card overflow-hidden mb-6">
          <button
            onClick={() => setStatsOpen((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-white
                       hover:bg-[var(--surface-hover)] transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-neon">📊</span>
              <span>Season Analytics</span>
            </div>
            <span className="text-xs" style={{ color: "#8B949E" }}>{statsOpen ? "▲ Hide" : "▼ Show"}</span>
          </button>

          {statsOpen && (
            <div style={{ borderTop: "1px solid var(--border)" }} className="px-4 pb-5 pt-4 space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
                <div className="space-y-4">
                  <PointsChart rows={data.rows} clusters={data.clusters} clusterLabels={data.cluster_labels} />
                  <HitsChart rows={data.rows} />
                </div>
                <BrainPanel result={data} entryId={entryId} />
              </div>
            </div>
          )}
        </div>
      </main>
    )
  }

  return null
}
