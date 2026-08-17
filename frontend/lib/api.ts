import { AnalysisResult, SuggestedMove, WeeklyPlan } from "./types"

const BASE =
  process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") ?? "http://localhost:8000"

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.detail ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export async function syncEntry(entryId: string): Promise<{ synced: number; total: number }> {
  const res = await fetch(`${BASE}/api/sync/${entryId}`, {
    method: "POST",
    signal: AbortSignal.timeout(60_000),
  })
  return handleResponse(res)
}

export async function analyzeEntry(entryId: string): Promise<AnalysisResult> {
  const res = await fetch(`${BASE}/api/analyze/${entryId}`, {
    signal: AbortSignal.timeout(30_000),
  })
  return handleResponse(res)
}

export async function chatWithBrain(
  entryId: string,
  message: string
): Promise<{ reply: string }> {
  const res = await fetch(`${BASE}/api/chat/${entryId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
    signal: AbortSignal.timeout(60_000),
  })
  return handleResponse(res)
}

export async function getSuggestedMoves(entryId: string): Promise<{ moves: SuggestedMove[] }> {
  const res = await fetch(`${BASE}/api/suggest-moves/${entryId}`, {
    signal: AbortSignal.timeout(30_000),
  })
  return handleResponse(res)
}

export async function getWeeklyPlan(entryId: string): Promise<WeeklyPlan> {
  const res = await fetch(`${BASE}/api/weekly-plan/${entryId}`, {
    signal: AbortSignal.timeout(60_000),
  })
  return handleResponse(res)
}
