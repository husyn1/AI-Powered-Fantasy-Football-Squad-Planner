export interface GWRow {
  gw: number
  points: number
  transfers: number
  hit: number
  overall_rank: number | null
  team_value: number | null
  bank: number | null
  chip: string | null
}

export interface AnalysisResult {
  rows: GWRow[]
  clusters: Record<number, number>
  cluster_labels: Record<string, string>
  similar_weeks: Array<{ gw: number; distance: number }>
  summary: {
    avg_points: number
    total_hits: number
    hit_weeks_count: number
    best_gw: number
    worst_gw: number
  }
}

export interface PlayerData {
  id: number
  name: string
  team: string
  pos: string
  price: number
  sell_price: number
  photo_url: string
  form: number
  ep_next: number
  total_pts: number
  minutes: number
  goals: number
  assists: number
  clean_sheets: number
  bonus: number
  ict: number
  owned_pct: number
  transfers_in: number
  transfers_out: number
  status: string
  news: string
  is_captain: boolean
  is_vice: boolean
  is_bench: boolean
  avg_fdr: number
  fixes: string
}

export interface MoveFinancial {
  sell_price: number
  buy_price: number
  bank_before: number
  bank_after: number
  affordable: boolean
  shortfall: number
}

export interface SuggestedMove {
  player_out: PlayerData
  player_in: PlayerData
  financial: MoveFinancial
  pros: string[]
  cons: string[]
}

export interface CaptainPick {
  player: PlayerData
  score: number
  reasoning: string
  last5_avg: number
  avg_home: number
  avg_away: number
  avg_vs_easy: number
  avg_vs_hard: number
  next_fix_difficulty: number
  is_home: boolean
  next_opponent: string
}

export interface ChipAdvice {
  chip: string
  name: string
  emoji: string
  urgency: "use" | "consider" | "think" | "save"
  reasoning: string
}

export interface RoadmapGW {
  gw: number
  label: string
  priority: "high" | "medium" | "low"
  good_fixtures: string[]
  bad_fixtures: string[]
  blanks: string[]
  actions: string[]
}

export interface WeeklyPlan {
  gw: number | null
  next_gw: number | null
  captain_picks: CaptainPick[]
  chip_advice: ChipAdvice[]
  transfers: SuggestedMove[]
  roadmap: RoadmapGW[]
}
