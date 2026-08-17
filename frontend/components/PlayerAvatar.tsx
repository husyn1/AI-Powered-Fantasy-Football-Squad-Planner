"use client"

/**
 * IP-safe player avatar: team-coloured shirt silhouette + initials.
 * No Premier League or club imagery used.
 */

interface TeamColour {
  primary: string
  secondary: string
}

const TEAM_COLOURS: Record<string, TeamColour> = {
  ARS: { primary: "#EF0107", secondary: "#FFFFFF" },
  AVL: { primary: "#670E36", secondary: "#95BFE5" },
  BOU: { primary: "#DA291C", secondary: "#000000" },
  BRE: { primary: "#E30613", secondary: "#FFFFFF" },
  BHA: { primary: "#0057B8", secondary: "#FFCD00" },
  CHE: { primary: "#034694", secondary: "#FFFFFF" },
  CRY: { primary: "#1B458F", secondary: "#C4122E" },
  EVE: { primary: "#003399", secondary: "#FFFFFF" },
  FUL: { primary: "#2C2A29", secondary: "#FFFFFF" },
  IPS: { primary: "#0044A9", secondary: "#FFFFFF" },
  LEI: { primary: "#003090", secondary: "#FDBE11" },
  LIV: { primary: "#C8102E", secondary: "#F6EB61" },
  MCI: { primary: "#6CABDD", secondary: "#1C2C5B" },
  MUN: { primary: "#DA291C", secondary: "#FBE122" },
  NEW: { primary: "#241F20", secondary: "#FFFFFF" },
  NFO: { primary: "#DD0000", secondary: "#FFFFFF" },
  SOU: { primary: "#D71920", secondary: "#130C0E" },
  TOT: { primary: "#132257", secondary: "#FFFFFF" },
  WHU: { primary: "#7A263A", secondary: "#1BB1E7" },
  WOL: { primary: "#FDB913", secondary: "#231F20" },
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function teamKey(teamAbbr: string): string {
  // Try exact match, then uppercase, then first 3 chars
  return (
    TEAM_COLOURS[teamAbbr] ? teamAbbr :
    TEAM_COLOURS[teamAbbr.toUpperCase()] ? teamAbbr.toUpperCase() :
    teamAbbr.slice(0, 3).toUpperCase()
  )
}

interface Props {
  name: string
  team: string
  pos: string
  status?: string
  size?: "sm" | "md" | "lg"
}

const SIZE_MAP = {
  sm: { outer: 48,  font: 14, badge: 14, badgeFont: 8  },
  md: { outer: 64,  font: 18, badge: 16, badgeFont: 9  },
  lg: { outer: 80,  font: 22, badge: 18, badgeFont: 10 },
}

export default function PlayerAvatar({ name, team, pos, status = "a", size = "md" }: Props) {
  const key    = teamKey(team)
  const colour = TEAM_COLOURS[key] ?? { primary: "#4B5563", secondary: "#E5E7EB" }
  const dim    = SIZE_MAP[size]
  const w      = dim.outer
  const h      = Math.round(w * 1.2)

  // Shirt SVG path (scaled to viewBox 100×120)
  // Simple classic football shirt silhouette
  const shirtPath = [
    "M28,18",          // left collar start
    "Q50,35 72,18",    // collar arc
    "L88,42",          // right shoulder to sleeve tip
    "L72,52",          // sleeve to body
    "L72,108",         // right side down
    "L28,108",         // bottom
    "L28,52",          // left body up
    "L12,42",          // left sleeve tip
    "Z",               // close
  ].join(" ")

  // Collar notch
  const collarPath = "M36,20 Q50,33 64,20"

  const statusColour =
    status === "i" || status === "u" ? "#EF4444" :
    status === "d" ? "#F59E0B" :
    status === "s" ? "#F97316" : null

  return (
    <div className="relative inline-flex" style={{ width: w, height: h }}>
      <svg viewBox="0 0 100 120" width={w} height={h} aria-label={name}>
        {/* Shirt body */}
        <path d={shirtPath} fill={colour.primary} />
        {/* Collar stripe */}
        <path d={collarPath} stroke={colour.secondary} strokeWidth={4} fill="none" strokeLinecap="round" />
        {/* Initials */}
        <text
          x="50" y="80"
          textAnchor="middle"
          dominantBaseline="middle"
          fill={colour.secondary}
          fontSize={dim.font * 1.3}
          fontWeight="700"
          fontFamily="system-ui, sans-serif"
          style={{ userSelect: "none" }}
        >
          {initials(name)}
        </text>
      </svg>

      {/* Position badge */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full font-bold uppercase flex items-center justify-center"
        style={{
          width: dim.badge, height: dim.badge,
          fontSize: dim.badgeFont,
          background: colour.secondary,
          color: colour.primary,
          border: `1.5px solid ${colour.primary}`,
          lineHeight: 1,
        }}
      >
        {pos[0]}
      </div>

      {/* Status dot */}
      {statusColour && (
        <div
          className="absolute top-0 right-0 rounded-full border border-slate-900"
          style={{ width: 10, height: 10, background: statusColour }}
        />
      )}
    </div>
  )
}
