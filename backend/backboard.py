import json
import os
import time
from pathlib import Path

import requests

BACKBOARD_BASE = "https://app.backboard.io/api"
ASSISTANT_MAP_FILE = Path(__file__).parent / "assistant_map.json"


def _headers() -> dict:
    key = os.environ.get("BACKBOARD_API_KEY", "")
    return {"X-API-Key": key}


def _post_with_retry(url: str, *, retries: int = 3, backoff: float = 1.5, **kwargs) -> requests.Response:
    last_exc: Exception | None = None
    for attempt in range(retries):
        try:
            resp = requests.post(url, **kwargs)
            if resp.status_code in (502, 503, 504) and attempt < retries - 1:
                time.sleep(backoff * (2 ** attempt))
                continue
            resp.raise_for_status()
            return resp
        except requests.exceptions.RequestException as exc:
            last_exc = exc
            if attempt < retries - 1:
                time.sleep(backoff * (2 ** attempt))
    raise last_exc  # type: ignore[misc]


def _load_map() -> dict:
    if ASSISTANT_MAP_FILE.exists():
        return json.loads(ASSISTANT_MAP_FILE.read_text())
    return {}


def _save_map(m: dict) -> None:
    ASSISTANT_MAP_FILE.write_text(json.dumps(m, indent=2))


FPL_SYSTEM_PROMPT = """You are a sharp, honest FPL (Fantasy Premier League) advisor.
You have access to the user's full gameweek history stored as memories — use them.
When the user asks about a transfer, captain pick, chip play, or strategy:
- Reference their actual past performance where relevant (e.g. "United players have averaged X for you")
- Be direct and concise (2-4 sentences)
- Flag risks with upcoming fixtures if you know them
- Don't hedge everything — give a clear recommendation
"""


def get_or_create_assistant(entry_id: str) -> str:
    m = _load_map()
    if entry_id in m:
        return m[entry_id]

    resp = _post_with_retry(
        f"{BACKBOARD_BASE}/assistants",
        json={"name": f"FPL Brain: {entry_id}", "system_prompt": FPL_SYSTEM_PROMPT},
        headers=_headers(),
        timeout=10,
    )
    aid = resp.json()["assistant_id"]
    m[entry_id] = aid
    _save_map(m)
    return aid


def get_or_create_thread(entry_id: str) -> str:
    thread_key = f"_thread_{entry_id}"
    m = _load_map()
    if thread_key in m:
        return m[thread_key]

    aid = get_or_create_assistant(entry_id)
    resp = _post_with_retry(
        f"{BACKBOARD_BASE}/assistants/{aid}/threads",
        json={},
        headers=_headers(),
        timeout=10,
    )
    tid = resp.json()["thread_id"]
    m[thread_key] = tid
    _save_map(m)
    return tid


def chat_with_assistant(entry_id: str, user_message: str, stats_context: str) -> str:
    thread_id = get_or_create_thread(entry_id)
    full_message = f"{stats_context}\n\nUser: {user_message}"
    resp = _post_with_retry(
        f"{BACKBOARD_BASE}/threads/{thread_id}/messages",
        headers=_headers(),
        data={"content": full_message, "stream": "false", "memory": "Auto"},
        timeout=60,
    )
    return resp.json().get("content", "Sorry, I couldn't generate a response.")


def _coerce_row(meta: dict) -> dict:
    return {
        "gw": int(meta["gw"]),
        "points": int(meta["points"]),
        "transfers": int(meta.get("transfers") or 0),
        "hit": int(meta.get("hit") or 0),
        "overall_rank": int(meta["overall_rank"]) if meta.get("overall_rank") is not None else None,
        "team_value": int(meta["team_value"]) if meta.get("team_value") is not None else None,
        "bank": int(meta["bank"]) if meta.get("bank") is not None else None,
        "chip": meta.get("chip"),
    }


def backboard_fetch_all_gws(entry_id: str) -> list[dict]:
    aid = get_or_create_assistant(entry_id)
    resp = requests.get(
        f"{BACKBOARD_BASE}/assistants/{aid}/memories",
        headers=_headers(),
        timeout=10,
    )
    resp.raise_for_status()
    memories = resp.json().get("memories", [])

    rows = []
    for mem in memories:
        meta = mem.get("metadata") or {}
        if str(meta.get("entry_id")) == str(entry_id) and meta.get("gw") is not None:
            try:
                rows.append(_coerce_row(meta))
            except (KeyError, TypeError, ValueError):
                pass

    rows.sort(key=lambda r: r["gw"])
    return rows


def backboard_upsert_gw(entry_id: str, row: dict) -> bool:
    aid = get_or_create_assistant(entry_id)
    existing_gws = {r["gw"] for r in backboard_fetch_all_gws(entry_id)}
    if row["gw"] in existing_gws:
        return False
    _write_memory(aid, entry_id, row)
    return True


def backboard_sync_all(entry_id: str, rows: list[dict]) -> int:
    aid = get_or_create_assistant(entry_id)
    existing_gws = {r["gw"] for r in backboard_fetch_all_gws(entry_id)}

    count = 0
    for row in rows:
        if row["gw"] in existing_gws:
            continue
        _write_memory(aid, entry_id, row)
        count += 1
    return count


def _write_memory(aid: str, entry_id: str, row: dict) -> None:
    chip = row.get("chip") or "none"
    content = (
        f"GW {row['gw']}: {row['points']} pts, "
        f"transfers {row['transfers']}, hit {row['hit']}, chip {chip}"
    )
    meta = {
        **row,
        "entry_id": str(entry_id),
        "tags": ["fpl", f"entry:{entry_id}", f"gw:{row['gw']}"],
    }
    _post_with_retry(
        f"{BACKBOARD_BASE}/assistants/{aid}/memories",
        json={"content": content, "metadata": meta},
        headers=_headers(),
        timeout=10,
    )
