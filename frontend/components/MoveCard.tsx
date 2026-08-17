"use client"

import { SuggestedMove, PlayerData } from "@/lib/types"
import PlayerAvatar from "./PlayerAvatar"

function PlayerCard({ player, label }: { player: PlayerData; label: "OUT" | "IN" }) {
  const isOut = label === "OUT"

  return (
    <div className={`flex-1 rounded-xl p-3 ${isOut ? "bg-red-950/30 border border-red-900/40" : "bg-emerald-950/30 border border-emerald-900/40"}`}>
      <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${isOut ? "text-red-400" : "text-emerald-400"}`}>
        {label}
      </p>

      {/* Avatar */}
      <div className="flex justify-center mb-2">
        <PlayerAvatar name={player.name} team={player.team} pos={player.pos} status={player.status} size="md" />
      </div>

      {/* Player info */}
      <p className="text-sm font-bold text-slate-100 text-center truncate">{player.name}</p>
      <p className="text-xs text-slate-500 text-center">{player.pos} · {player.team}</p>

      {/* Stats */}
      <div className="mt-2 space-y-0.5 text-xs">
        <div className="flex justify-between">
          <span className="text-slate-500">{isOut ? "Sell" : "Buy"}</span>
          <span className="text-slate-200 font-semibold">£{isOut ? player.sell_price : player.price}m</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Form</span>
          <span className={`font-semibold ${player.form >= 6 ? "text-emerald-400" : player.form >= 3 ? "text-yellow-400" : "text-red-400"}`}>
            {player.form}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">xP next</span>
          <span className="text-[#00FF80] font-semibold">{player.ep_next}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Pts</span>
          <span className="text-slate-300">{player.total_pts}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">G/A</span>
          <span className="text-slate-300">{player.goals}/{player.assists}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Owned</span>
          <span className="text-slate-300">{player.owned_pct}%</span>
        </div>
      </div>

      {/* Fixtures */}
      {player.fixes && player.fixes !== "TBD" && (
        <p className="mt-2 text-[10px] text-slate-500 leading-relaxed">{player.fixes}</p>
      )}

      {/* Injury news */}
      {player.news && (
        <p className="mt-1 text-[10px] text-red-400 leading-relaxed">{player.news}</p>
      )}
    </div>
  )
}

export default function MoveCard({ move, index }: { move: SuggestedMove; index: number }) {
  const { player_out, player_in, financial, pros, cons } = move
  const netCost = financial.buy_price - financial.sell_price

  return (
    <div className="card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Move {index + 1}
        </span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${financial.affordable ? "bg-emerald-900/50 text-emerald-400" : "bg-red-900/50 text-red-400"}`}>
          {financial.affordable ? "✓ Affordable" : `£${financial.shortfall}m short`}
        </span>
      </div>

      {/* Player cards */}
      <div className="flex gap-2 items-stretch">
        <PlayerCard player={player_out} label="OUT" />
        <div className="flex items-center text-slate-600 text-lg font-bold px-0.5">→</div>
        <PlayerCard player={player_in} label="IN" />
      </div>

      {/* Financial summary */}
      <div className="bg-[#0B0E13] rounded-xl p-2.5 flex items-center justify-between text-xs">
        <div className="text-slate-400">
          Sell <span className="text-slate-200 font-semibold">£{financial.sell_price}m</span>
          {" → "}Buy <span className="text-slate-200 font-semibold">£{financial.buy_price}m</span>
          <span className={`ml-1 font-bold ${netCost > 0 ? "text-red-400" : "text-emerald-400"}`}>
            ({netCost > 0 ? "+" : ""}{netCost.toFixed(1)}m)
          </span>
        </div>
        <div className={`font-semibold ${financial.bank_after < 0 ? "text-red-400" : financial.bank_after < 0.3 ? "text-yellow-400" : "text-emerald-400"}`}>
          Bank: £{financial.bank_after}m
        </div>
      </div>

      {/* Pros */}
      {pros.length > 0 && (
        <div className="space-y-1">
          {pros.map((p, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-emerald-300">
              <span className="mt-0.5 shrink-0">✓</span>
              <span>{p}</span>
            </div>
          ))}
        </div>
      )}

      {/* Cons */}
      {cons.length > 0 && (
        <div className="space-y-1">
          {cons.map((c, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-red-300">
              <span className="mt-0.5 shrink-0">✗</span>
              <span>{c}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
