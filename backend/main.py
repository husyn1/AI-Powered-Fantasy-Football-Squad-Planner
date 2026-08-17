from dotenv import load_dotenv

load_dotenv()

import os
import time
from collections import defaultdict

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from analysis import run_analysis
from backboard import backboard_fetch_all_gws, backboard_sync_all, chat_with_assistant
from fpl import get_fpl_history, get_live_context, get_current_squad, get_suggested_moves, get_weekly_plan

app = FastAPI(
    title="FPL Season Brain API",
    version="1.0.0",
    docs_url=None if os.getenv("ENV") == "production" else "/docs",
    redoc_url=None,
)

_allowed_origin = os.getenv("ALLOWED_ORIGIN", "http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[_allowed_origin],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

_chat_timestamps: dict[str, list[float]] = defaultdict(list)
_CHAT_MAX_PER_MINUTE = int(os.getenv("CHAT_RATE_LIMIT", "10"))


def _check_rate_limit(key: str) -> None:
    now = time.time()
    window = [t for t in _chat_timestamps[key] if now - t < 60]
    _chat_timestamps[key] = window
    if len(window) >= _CHAT_MAX_PER_MINUTE:
        raise HTTPException(status_code=429, detail="Too many requests — please wait a moment.")
    _chat_timestamps[key].append(now)


@app.get("/api/history/{entry_id}")
async def get_history(entry_id: int):
    try:
        rows = get_fpl_history(entry_id)
        return {"rows": rows, "total": len(rows)}
    except Exception:
        raise HTTPException(status_code=400, detail="Could not fetch FPL history for that entry ID.")


@app.post("/api/sync/{entry_id}")
async def sync(entry_id: int):
    try:
        rows = get_fpl_history(entry_id)
        synced = backboard_sync_all(str(entry_id), rows)
        return {"synced": synced, "total": len(rows), "rows": rows}
    except Exception:
        raise HTTPException(status_code=400, detail="Sync failed. Check your entry ID and try again.")


@app.get("/api/analyze/{entry_id}")
async def analyze(entry_id: int):
    try:
        rows = backboard_fetch_all_gws(str(entry_id))
        if not rows:
            raise HTTPException(status_code=404, detail="No data found. Sync this entry first.")
        result = run_analysis(rows)
        if "error" in result:
            raise HTTPException(status_code=422, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Analysis failed. Please try again.")


@app.get("/api/suggest-moves/{entry_id}")
async def suggest_moves(entry_id: int):
    try:
        moves = get_suggested_moves(entry_id)
        return {"moves": moves}
    except Exception:
        raise HTTPException(status_code=400, detail="Could not generate transfer suggestions.")


@app.get("/api/weekly-plan/{entry_id}")
async def weekly_plan(entry_id: int):
    try:
        plan = get_weekly_plan(entry_id)
        return plan
    except Exception:
        raise HTTPException(status_code=400, detail="Could not generate weekly plan.")


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=500)


@app.post("/api/chat/{entry_id}")
async def chat(entry_id: int, body: ChatRequest, request: Request):
    client_ip = request.client.host if request.client else "unknown"
    _check_rate_limit(f"{client_ip}:{entry_id}")

    try:
        rows = backboard_fetch_all_gws(str(entry_id))
        if not rows:
            raise HTTPException(status_code=404, detail="No data synced yet for this entry.")

        pts = [r["points"] for r in rows]
        hits = [r["hit"] or 0 for r in rows]
        chips = [r["chip"] for r in rows if r.get("chip")]
        avg_pts = round(sum(pts) / len(pts), 1)
        best_gw = rows[pts.index(max(pts))]["gw"]
        worst_gw = rows[pts.index(min(pts))]["gw"]
        total_hits = sum(hits)
        latest_gw = rows[-1]["gw"]

        last3 = ", ".join(f"GW{r['gw']} ({r['points']}pts)" for r in rows[-3:])
        stats_context = (
            f"[FPL Season Context — Entry {entry_id}]\n"
            f"GWs played: {len(rows)} (latest: GW{latest_gw})\n"
            f"Avg pts/GW: {avg_pts} | Best: GW{best_gw} ({max(pts)} pts) | Worst: GW{worst_gw} ({min(pts)} pts)\n"
            f"Total hit cost: -{total_hits} pts across {sum(1 for h in hits if h > 0)} hit weeks\n"
            f"Chips used: {', '.join(chips) if chips else 'none yet'}\n"
            f"Last 3 GWs: {last3}\n"
        )

        try:
            squad_context = get_current_squad(entry_id)
        except Exception:
            squad_context = ""

        try:
            live_context = get_live_context()
        except Exception:
            live_context = ""

        try:
            algo_moves = get_suggested_moves(entry_id, max_moves=3)
            move_lines: list[str] = []
            for i, m in enumerate(algo_moves, 1):
                p_out = m["player_out"]
                p_in  = m["player_in"]
                fin   = m["financial"]
                pros  = "; ".join(m.get("pros", [])[:2])
                cons  = "; ".join(m.get("cons", [])[:2])
                affordable = "✓ affordable" if fin.get("affordable") else f"✗ £{fin.get('shortfall', 0)}m short"
                move_lines.append(
                    f"  Move {i}: {p_out['name']} ({p_out['pos']}, £{p_out.get('sell_price', p_out['price'])}m, "
                    f"form {p_out['form']}, xP {p_out['ep_next']}) → "
                    f"{p_in['name']} ({p_in['pos']}, £{p_in['price']}m, form {p_in['form']}, xP {p_in['ep_next']}) "
                    f"[{affordable}] pros: {pros} | cons: {cons}"
                )
            algo_context = (
                "[ALGORITHM'S TOP TRANSFER RECOMMENDATIONS (data-driven)]\n"
                + "\n".join(move_lines)
                + "\nNote: When the user asks about transfers, reference these suggestions. "
                "You may agree, add nuance, or explain why a different option better suits their style — "
                "but do NOT silently recommend something contradictory without acknowledging these picks."
            ) if move_lines else ""
        except Exception:
            algo_context = ""

        full_context = "\n\n".join(filter(None, [stats_context, squad_context, live_context, algo_context]))
        reply = chat_with_assistant(str(entry_id), body.message, full_context)
        return {"reply": reply}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")
