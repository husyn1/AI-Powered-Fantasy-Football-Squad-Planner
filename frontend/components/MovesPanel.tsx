"use client"

import { useEffect, useState } from "react"
import { getSuggestedMoves } from "@/lib/api"
import { SuggestedMove } from "@/lib/types"
import MoveCard from "./MoveCard"

export default function MovesPanel({ entryId }: { entryId: string }) {
  const [moves, setMoves] = useState<SuggestedMove[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    getSuggestedMoves(entryId)
      .then((data) => setMoves(data.moves))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [entryId])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-1 pb-3 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-sm font-bold text-slate-100 tracking-tight">Suggested Moves</h2>
          <p className="text-xs text-slate-500 mt-0.5">Based on form · fixtures · availability · budget</p>
        </div>
        {!loading && !error && (
          <button
            onClick={() => { setLoading(true); setError(""); getSuggestedMoves(entryId).then(d => setMoves(d.moves)).catch(e => setError(e.message)).finally(() => setLoading(false)) }}
            className="text-xs text-slate-500 hover:text-violet-400 transition-colors"
          >
            ↺ Refresh
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-0.5">
        {loading && (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-500">Analysing your squad…</p>
          </div>
        )}

        {error && (
          <div className="card p-4 text-center">
            <p className="text-xs text-red-400">{error}</p>
            <p className="text-xs text-slate-500 mt-1">Make sure your entry ID is synced first.</p>
          </div>
        )}

        {!loading && !error && moves.length === 0 && (
          <div className="card p-6 text-center">
            <p className="text-2xl mb-2">🏆</p>
            <p className="text-sm text-slate-300 font-semibold">Squad looks strong!</p>
            <p className="text-xs text-slate-500 mt-1">No urgent transfers suggested right now.</p>
          </div>
        )}

        {!loading && moves.map((move, i) => (
          <MoveCard key={i} move={move} index={i} />
        ))}
      </div>
    </div>
  )
}
