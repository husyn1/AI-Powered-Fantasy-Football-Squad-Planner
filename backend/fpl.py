import concurrent.futures
import requests

FPL_BASE = "https://fantasy.premierleague.com/api"

FDR_LABEL = {1: "very easy", 2: "easy", 3: "medium", 4: "hard", 5: "very hard"}
POS_MAP = {1: "GK", 2: "DEF", 3: "MID", 4: "FWD"}


def get_fpl_history(entry_id: int) -> list[dict]:
    url = f"{FPL_BASE}/entry/{entry_id}/history/"
    resp = requests.get(url, timeout=10)
    resp.raise_for_status()
    data = resp.json()

    chip_lookup = {chip["event"]: chip["name"] for chip in data.get("chips", [])}

    rows = []
    for gw in data.get("current", []):
        rows.append(
            {
                "gw": gw["event"],
                "points": gw["points"],
                "transfers": gw["event_transfers"],
                "hit": gw["event_transfers_cost"],
                "overall_rank": gw.get("overall_rank"),
                "team_value": gw.get("value"),
                "bank": gw.get("bank"),
                "chip": chip_lookup.get(gw["event"]),
            }
        )
    return rows


def get_current_squad(entry_id: int) -> str:
    entry_resp = requests.get(f"{FPL_BASE}/entry/{entry_id}/", timeout=10)
    entry_resp.raise_for_status()
    entry_data = entry_resp.json()

    current_event = entry_data.get("current_event") or entry_data.get("summary_event")
    if not current_event:
        return ""

    picks_resp = requests.get(f"{FPL_BASE}/entry/{entry_id}/event/{current_event}/picks/", timeout=10)
    picks_resp.raise_for_status()
    picks_data = picks_resp.json()

    bootstrap_resp = requests.get(f"{FPL_BASE}/bootstrap-static/", timeout=15)
    bootstrap_resp.raise_for_status()
    bootstrap = bootstrap_resp.json()

    team_map = {t["id"]: t["short_name"] for t in bootstrap.get("teams", [])}
    player_map = {p["id"]: p for p in bootstrap.get("elements", [])}

    bank = (picks_data.get("entry_history", {}).get("bank") or 0) / 10
    squad_value = (picks_data.get("entry_history", {}).get("value") or 0) / 10

    lines = []
    for pick in picks_data.get("picks", []):
        pid = pick["element"]
        p = player_map.get(pid, {})
        name = p.get("web_name", "?")
        pos = POS_MAP.get(p.get("element_type"), "?")
        team = team_map.get(p.get("team"), "?")
        now_cost = (p.get("now_cost") or 0) / 10
        sell_price = (pick.get("selling_price") or p.get("now_cost") or 0) / 10
        is_captain = " (C)" if pick.get("is_captain") else ""
        is_vice = " (V)" if pick.get("is_vice_captain") else ""
        multiplier = pick.get("multiplier", 1)
        bench = " [BENCH]" if multiplier == 0 else ""
        status = p.get("status", "a")
        news = f" ⚠️{p.get('news','')}" if status in ("i", "d", "s") else ""

        lines.append(
            f"  {pos} {name} ({team}) £{now_cost}m sell:£{sell_price}m{is_captain}{is_vice}{bench}{news}"
        )

    return "\n".join([
        f"[CURRENT SQUAD — GW{current_event}]",
        f"Bank: £{bank:.1f}m | Squad value: £{squad_value:.1f}m",
        "Starting XI + bench (sell prices shown):",
        *lines,
    ])


def _fetch_bootstrap_and_fixtures() -> tuple[dict, dict, dict]:
    bootstrap = requests.get(f"{FPL_BASE}/bootstrap-static/", timeout=15)
    bootstrap.raise_for_status()
    data = bootstrap.json()

    team_map: dict[int, str] = {t["id"]: t["short_name"] for t in data.get("teams", [])}

    events = data.get("events", [])
    next_gw = next((e["id"] for e in events if e.get("is_next")), None)
    upcoming = set(filter(None, [next_gw, (next_gw + 1) if next_gw else None, (next_gw + 2) if next_gw else None]))

    fix_resp = requests.get(f"{FPL_BASE}/fixtures/", timeout=15)
    fix_resp.raise_for_status()
    team_fix: dict[int, list] = {}
    for fix in fix_resp.json():
        if fix.get("event") not in upcoming or fix.get("finished"):
            continue
        for tid, opp, fdr in [
            (fix["team_h"], fix["team_a"], fix["team_h_difficulty"]),
            (fix["team_a"], fix["team_h"], fix["team_a_difficulty"]),
        ]:
            team_fix.setdefault(tid, []).append((fix["event"], team_map.get(opp, "?"), fdr))

    return data, team_map, team_fix


def _player_dict(p: dict, team_map: dict, team_fix: dict, pick: dict | None = None) -> dict:
    tid = p.get("team")
    code = p.get("code", 0)
    fixes = sorted(team_fix.get(tid, []), key=lambda x: x[0])[:3]
    avg_fdr_val = sum(f[2] for f in fixes) / max(len(fixes), 1)
    fix_str = ", ".join(f"GW{g} {o}(fdr:{d})" for g, o, d in fixes) if fixes else "TBD"

    now_cost = (p.get("now_cost") or 0) / 10
    if pick:
        sell_price = (pick.get("selling_price") or p.get("now_cost") or 0) / 10
        is_captain = bool(pick.get("is_captain"))
        is_vice = bool(pick.get("is_vice_captain"))
        is_bench = pick.get("multiplier", 1) == 0
    else:
        sell_price = now_cost
        is_captain = is_vice = is_bench = False

    return {
        "id": p["id"],
        "name": p.get("web_name", "?"),
        "team": team_map.get(tid, "?"),
        "team_id": tid,
        "pos": POS_MAP.get(p.get("element_type"), "?"),
        "price": round(now_cost, 1),
        "sell_price": round(sell_price, 1),
        "photo_url": f"https://resources.premierleague.com/premierleague/photos/players/110x140/p{code}.png",
        "form": float(p.get("form") or 0),
        "ep_next": float(p.get("ep_next") or 0),
        "total_pts": p.get("total_points", 0),
        "minutes": p.get("minutes", 0),
        "goals": p.get("goals_scored", 0),
        "assists": p.get("assists", 0),
        "clean_sheets": p.get("clean_sheets", 0),
        "bonus": p.get("bonus", 0),
        "ict": float(p.get("ict_index") or 0),
        "owned_pct": float(p.get("selected_by_percent") or 0),
        "transfers_in": p.get("transfers_in_event", 0),
        "transfers_out": p.get("transfers_out_event", 0),
        "status": p.get("status", "a"),
        "news": p.get("news", ""),
        "is_captain": is_captain,
        "is_vice": is_vice,
        "is_bench": is_bench,
        "avg_fdr": round(avg_fdr_val, 2),
        "fixes": fix_str,
    }


def get_squad_data(entry_id: int) -> dict:
    entry = requests.get(f"{FPL_BASE}/entry/{entry_id}/", timeout=10)
    entry.raise_for_status()
    current_event = entry.json().get("current_event") or entry.json().get("summary_event")
    if not current_event:
        raise ValueError("Could not determine current GW")

    picks_resp = requests.get(f"{FPL_BASE}/entry/{entry_id}/event/{current_event}/picks/", timeout=10)
    picks_resp.raise_for_status()
    picks_data = picks_resp.json()

    bootstrap_data, team_map, team_fix = _fetch_bootstrap_and_fixtures()
    player_map = {p["id"]: p for p in bootstrap_data.get("elements", [])}

    bank = (picks_data.get("entry_history", {}).get("bank") or 0) / 10
    squad_value = (picks_data.get("entry_history", {}).get("value") or 0) / 10

    players = []
    for pick in picks_data.get("picks", []):
        p = player_map.get(pick["element"])
        if p:
            players.append(_player_dict(p, team_map, team_fix, pick))

    return {"gw": current_event, "bank": round(bank, 1), "squad_value": round(squad_value, 1), "players": players}


def get_suggested_moves(entry_id: int, max_moves: int = 3) -> list[dict]:
    squad = get_squad_data(entry_id)
    bank = squad["bank"]
    my_ids = {p["id"] for p in squad["players"]}

    bootstrap_data, team_map, team_fix = _fetch_bootstrap_and_fixtures()
    all_players = [_player_dict(p, team_map, team_fix) for p in bootstrap_data.get("elements", [])]

    def weakness(p: dict) -> float:
        s = 0.0
        if p["status"] == "u": s += 14
        if p["status"] == "i": s += 10
        if p["status"] == "s": s += 8
        if p["status"] == "d": s += 5
        s += max(0.0, 5.0 - p["form"]) * 1.5
        s += max(0.0, p["avg_fdr"] - 2.5) * 1.2
        s += max(0.0, 4.0 - p["ep_next"])
        if p["is_bench"]: s *= 0.4
        return s

    moves = []
    used: set[int] = set()

    for weak in sorted(squad["players"], key=weakness, reverse=True):
        if len(moves) >= max_moves:
            break

        budget = weak["sell_price"] + bank
        candidates = [
            p for p in all_players
            if p["pos"] == weak["pos"]
            and p["id"] not in my_ids
            and p["id"] not in used
            and p["price"] <= budget + 0.05
            and p["status"] != "u"
        ]
        if not candidates:
            continue

        def _candidate_score(p: dict) -> float:
            return p["ep_next"] * 0.40 + p["form"] * 0.30 + (5 - p["avg_fdr"]) * 0.30

        best = max(candidates, key=_candidate_score)
        if _candidate_score(best) <= _candidate_score(weak) and weak["status"] == "a":
            continue

        used.add(best["id"])
        bank_after = round(bank + weak["sell_price"] - best["price"], 1)

        pros: list[str] = []
        cons: list[str] = []

        if best["ep_next"] > weak["ep_next"] + 0.5:
            pros.append(f"Higher xP next GW — {best['ep_next']} vs {weak['ep_next']}")
        if best["form"] > weak["form"] + 1:
            pros.append(f"Better recent form — {best['form']} vs {weak['form']}")
        if best["avg_fdr"] < weak["avg_fdr"] - 0.3:
            pros.append(f"Easier fixtures — avg fdr {best['avg_fdr']} vs {weak['avg_fdr']}")
        if weak["status"] in ("i", "d", "s"):
            pros.append(f"Removes injury risk — {(weak['news'] or weak['status'])[:50]}")
        if best["price"] < weak["sell_price"]:
            pros.append(f"Saves £{round(weak['sell_price'] - best['price'], 1)}m in the bank")
        if best["transfers_in"] > 50_000:
            pros.append(f"Trending — {best['transfers_in']:,} managers bringing him in")
        if not pros:
            pros.append(f"Overall upgrade in expected output ({best['ep_next']} vs {weak['ep_next']})")

        if bank_after < -0.05:
            cons.append(f"£{abs(bank_after)}m short — need to raise funds first")
        elif bank_after < 0.2:
            cons.append(f"Very tight bank after (£{bank_after}m)")
        if best["form"] < 3.5:
            cons.append(f"{best['name']} not in great form ({best['form']})")
        if best["avg_fdr"] > 3.5:
            cons.append(f"Tough fixtures for {best['team']} coming up")
        if best["owned_pct"] > 40:
            cons.append(f"Popular template pick — {best['owned_pct']}% owned")
        if best["minutes"] < 500:
            cons.append(f"Minutes concern — only {best['minutes']} this season")

        moves.append({
            "player_out": weak,
            "player_in": best,
            "financial": {
                "sell_price": weak["sell_price"],
                "buy_price": best["price"],
                "bank_before": bank,
                "bank_after": bank_after,
                "affordable": bank_after >= -0.05,
                "shortfall": round(max(0.0, -bank_after), 1),
            },
            "pros": pros[:4],
            "cons": cons[:3],
        })

    return moves


def get_live_context() -> str:
    resp = requests.get(f"{FPL_BASE}/bootstrap-static/", timeout=15)
    resp.raise_for_status()
    data = resp.json()

    team_map: dict[int, str] = {t["id"]: t["short_name"] for t in data.get("teams", [])}

    events = data.get("events", [])
    current_gw = next((e["id"] for e in events if e.get("is_current")), None)
    next_gw = next((e["id"] for e in events if e.get("is_next")), None)

    fix_resp = requests.get(f"{FPL_BASE}/fixtures/", timeout=15)
    fix_resp.raise_for_status()
    all_fixtures = fix_resp.json()

    upcoming_gws = set(filter(None, [next_gw, (next_gw + 1) if next_gw else None, (next_gw + 2) if next_gw else None]))

    team_fixtures: dict[int, list[tuple]] = {}
    for fix in all_fixtures:
        if fix.get("event") not in upcoming_gws or fix.get("finished"):
            continue
        gw_num = fix["event"]
        for tid, opp_id, fdr in [
            (fix["team_h"], fix["team_a"], fix["team_h_difficulty"]),
            (fix["team_a"], fix["team_h"], fix["team_a_difficulty"]),
        ]:
            team_fixtures.setdefault(tid, []).append((gw_num, team_map.get(opp_id, "?"), fdr))

    def fix_str(tid: int) -> str:
        fixes = sorted(team_fixtures.get(tid, []), key=lambda x: x[0])[:3]
        return ", ".join(f"GW{g} {o}(fdr:{d})" for g, o, d in fixes) if fixes else "TBD"

    def avg_fdr(tid: int) -> float:
        fixes = team_fixtures.get(tid, [])
        return sum(f[2] for f in fixes[:3]) / max(len(fixes[:3]), 1)

    players = data.get("elements", [])
    rows = []
    for p in players:
        tid = p.get("team")
        rows.append({
            "name":         p.get("web_name", "?"),
            "team":         team_map.get(tid, "?"),
            "pos":          POS_MAP.get(p.get("element_type"), "?"),
            "price":        round((p.get("now_cost") or 0) / 10, 1),
            "total_pts":    p.get("total_points", 0),
            "form":         float(p.get("form") or 0),
            "ep_next":      float(p.get("ep_next") or 0),
            "ep_this":      float(p.get("ep_this") or 0),
            "minutes":      p.get("minutes", 0),
            "goals":        p.get("goals_scored", 0),
            "assists":      p.get("assists", 0),
            "clean_sheets": p.get("clean_sheets", 0),
            "bonus":        p.get("bonus", 0),
            "bps":          p.get("bps", 0),
            "ict":          float(p.get("ict_index") or 0),
            "owned_pct":    float(p.get("selected_by_percent") or 0),
            "pts_per_m":    round((p.get("total_points") or 0) / max((p.get("now_cost") or 1) / 10, 0.1), 1),
            "transfers_in": p.get("transfers_in_event", 0),
            "transfers_out":p.get("transfers_out_event", 0),
            "status":       p.get("status", "a"),
            "news":         p.get("news", ""),
            "avg_fdr":      avg_fdr(tid),
            "fixes":        fix_str(tid),
            "tid":          tid,
        })

    top40 = sorted(
        [r for r in rows if r["status"] != "u"],
        key=lambda x: x["ep_next"],
        reverse=True,
    )[:40]

    top40_lines = []
    for r in top40:
        status_note = f" ⚠️ {r['news']}" if r["status"] in ("i", "d", "s") else ""
        top40_lines.append(
            f"  {r['name']} ({r['team']},{r['pos']}) £{r['price']}m | "
            f"Form:{r['form']} xP:{r['ep_next']} Pts:{r['total_pts']} | "
            f"G:{r['goals']} A:{r['assists']} CS:{r['clean_sheets']} Bonus:{r['bonus']} | "
            f"ICT:{r['ict']} Mins:{r['minutes']} Owned:{r['owned_pct']}% | "
            f"Fixes: {r['fixes']}{status_note}"
        )

    unavail = sorted(
        [r for r in rows if r["status"] in ("i", "s", "u", "d")],
        key=lambda x: x["owned_pct"],
        reverse=True,
    )[:35]
    unavail_lines = [
        f"  {r['name']} ({r['team']},{r['pos']}) £{r['price']}m — {r['news'] or r['status']}"
        for r in unavail
    ]

    fix_table_lines = []
    for tid, team_name in sorted(team_map.items(), key=lambda x: x[1]):
        fix_table_lines.append(f"  {team_name}: {fix_str(tid)}")

    trending_in = sorted(rows, key=lambda x: x["transfers_in"], reverse=True)[:10]
    trending_out = sorted(rows, key=lambda x: x["transfers_out"], reverse=True)[:10]
    trending_in_text = ", ".join(f"{r['name']}(+{r['transfers_in']:,})" for r in trending_in)
    trending_out_text = ", ".join(f"{r['name']}(-{r['transfers_out']:,})" for r in trending_out)

    return "\n".join([
        f"[LIVE FPL DATA — GW{current_gw} current | GW{next_gw} next | prices in £m]",
        "",
        "TOP 40 PLAYERS BY EXPECTED POINTS NEXT GW:",
        *top40_lines,
        "",
        "INJURED / SUSPENDED / DOUBTFUL (top owned):",
        *unavail_lines,
        "",
        "FIXTURE DIFFICULTY — ALL TEAMS (next 3 GWs, fdr 1=easiest 5=hardest):",
        *fix_table_lines,
        "",
        f"TRENDING IN THIS GW:  {trending_in_text}",
        f"TRENDING OUT THIS GW: {trending_out_text}",
    ])


def _fetch_element_summary(player_id: int) -> tuple[int, dict]:
    try:
        r = requests.get(f"{FPL_BASE}/element-summary/{player_id}/", timeout=8)
        r.raise_for_status()
        return player_id, r.json()
    except Exception:
        return player_id, {"history": [], "fixtures": []}


def get_weekly_plan(entry_id: int) -> dict:
    squad = get_squad_data(entry_id)
    bootstrap_data, team_map, team_fix = _fetch_bootstrap_and_fixtures()
    bank = squad["bank"]
    my_ids = {p["id"] for p in squad["players"]}

    events = bootstrap_data.get("events", [])
    current_gw = next((e["id"] for e in events if e.get("is_current")), None)
    next_gw    = next((e["id"] for e in events if e.get("is_next")),    None)

    starting = [p for p in squad["players"] if not p["is_bench"]]
    bench    = [p for p in squad["players"] if     p["is_bench"]]

    try:
        chips_used = {c["name"] for c in requests.get(
            f"{FPL_BASE}/entry/{entry_id}/history/", timeout=10
        ).json().get("chips", [])}
    except Exception:
        chips_used = set()

    top_caps = sorted(starting, key=lambda x: x["ep_next"], reverse=True)[:8]
    summaries: dict[int, dict] = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        for pid, data in ex.map(lambda p: _fetch_element_summary(p["id"]), top_caps):
            summaries[pid] = data

    captain_picks = []
    for player in top_caps:
        s   = summaries.get(player["id"], {})
        hist = [h for h in s.get("history", []) if h.get("minutes", 0) > 0]
        fixs = s.get("fixtures", [])

        home_pts  = [h["total_points"] for h in hist if     h.get("was_home")]
        away_pts  = [h["total_points"] for h in hist if not h.get("was_home")]
        easy_pts  = [h["total_points"] for h in hist if h.get("difficulty", 3) <= 2]
        hard_pts  = [h["total_points"] for h in hist if h.get("difficulty", 3) >= 4]
        last5     = hist[-5:]

        avg_home    = round(sum(home_pts) / max(len(home_pts), 1), 1)
        avg_away    = round(sum(away_pts) / max(len(away_pts), 1), 1)
        avg_vs_easy = round(sum(easy_pts) / max(len(easy_pts), 1), 1)
        avg_vs_hard = round(sum(hard_pts) / max(len(hard_pts), 1), 1)
        last5_avg   = round(sum(h["total_points"] for h in last5) / max(len(last5), 1), 1)

        nxt        = fixs[0] if fixs else {}
        next_diff  = nxt.get("difficulty", 3)
        is_home    = nxt.get("is_home", False)
        opp_name   = nxt.get("opponent_short_title", "?")

        reasons: list[str] = []
        if player["ep_next"] >= 9:   reasons.append(f"Elite xP: {player['ep_next']}")
        elif player["ep_next"] >= 7: reasons.append(f"Strong xP: {player['ep_next']}")
        if player["form"] >= 8:      reasons.append(f"Exceptional form ({player['form']})")
        elif player["form"] >= 6:    reasons.append(f"Good form ({player['form']})")
        if next_diff <= 2:
            venue = "H" if is_home else "A"
            reasons.append(f"Great fixture vs {opp_name} ({venue}, fdr:{next_diff})")
        if is_home and avg_home > avg_away + 2:
            reasons.append(f"Home specialist — {avg_home} home vs {avg_away} away pts")
        if last5_avg >= 8:
            reasons.append(f"Last 5 GW avg: {last5_avg} pts")
        if avg_vs_easy >= 8 and next_diff <= 2:
            reasons.append(f"Punishes easy sides ({avg_vs_easy} avg pts vs fdr≤2)")
        if player["status"] == "d":
            reasons.append(f"⚠️ Doubt: {player['news'][:45]}")

        score = round(
            player["ep_next"] * 0.35 + player["form"] * 0.25 +
            (5 - player["avg_fdr"]) * 0.2 + last5_avg * 0.15 +
            (1.5 if is_home and avg_home > avg_away + 1 else 0) +
            (1.0 if next_diff <= 2 else -0.5 if next_diff >= 4 else 0),
            1,
        )

        captain_picks.append({
            "player": player,
            "score": score,
            "reasoning": ". ".join(reasons) or f"Solid pick ({player['ep_next']} xP)",
            "last5_avg": last5_avg,
            "avg_home": avg_home,
            "avg_away": avg_away,
            "avg_vs_easy": avg_vs_easy,
            "avg_vs_hard": avg_vs_hard,
            "next_fix_difficulty": next_diff,
            "is_home": is_home,
            "next_opponent": opp_name,
        })

    captain_picks.sort(key=lambda x: x["score"], reverse=True)

    all_players = [_player_dict(p, team_map, team_fix) for p in bootstrap_data.get("elements", [])]

    def _weakness(p: dict) -> float:
        s = 0.0
        if p["status"] == "u": s += 14
        if p["status"] == "i": s += 10
        if p["status"] == "s": s += 8
        if p["status"] == "d": s += 5
        s += max(0.0, 5.0 - p["form"]) * 1.5
        s += max(0.0, p["avg_fdr"] - 2.5) * 1.2
        s += max(0.0, 4.0 - p["ep_next"])
        if p["is_bench"]: s *= 0.4
        return s

    transfers: list[dict] = []
    used_in: set[int] = set()
    for weak in sorted(squad["players"], key=_weakness, reverse=True):
        if len(transfers) >= 3: break
        budget = weak["sell_price"] + bank
        cands = [
            p for p in all_players
            if p["pos"] == weak["pos"] and p["id"] not in my_ids
            and p["id"] not in used_in and p["price"] <= budget + 0.05
            and p["status"] != "u"
        ]
        if not cands: continue
        def _score(p: dict) -> float:
            return p["ep_next"] * 0.40 + p["form"] * 0.30 + (5 - p["avg_fdr"]) * 0.30

        best = max(cands, key=_score)
        if _score(best) <= _score(weak) and weak["status"] == "a": continue
        used_in.add(best["id"])
        ba = round(bank + weak["sell_price"] - best["price"], 1)
        pros: list[str] = []
        cons: list[str] = []
        if best["ep_next"] > weak["ep_next"] + 0.5:
            pros.append(f"Higher xP — {best['ep_next']} vs {weak['ep_next']}")
        if best["form"] > weak["form"] + 1:
            pros.append(f"Better form — {best['form']} vs {weak['form']}")
        if best["avg_fdr"] < weak["avg_fdr"] - 0.3:
            pros.append(f"Easier fixtures — avg fdr {best['avg_fdr']} vs {weak['avg_fdr']}")
        if weak["status"] in ("i", "d", "s"):
            pros.append(f"Removes risk: {(weak['news'] or weak['status'])[:50]}")
        if best["transfers_in"] > 50_000:
            pros.append(f"Trending in: {best['transfers_in']:,} managers")
        if not pros: pros.append(f"Overall upgrade ({best['ep_next']} vs {weak['ep_next']} xP)")
        if ba < -0.05:   cons.append(f"£{abs(ba)}m short — raise funds first")
        elif ba < 0.2:   cons.append(f"Very tight bank after (£{ba}m)")
        if best["form"] < 3.5:     cons.append(f"Not in great form ({best['form']})")
        if best["avg_fdr"] > 3.5:  cons.append(f"Tough fixtures for {best['team']}")
        if best["owned_pct"] > 40: cons.append(f"Template pick — {best['owned_pct']}% owned")
        transfers.append({
            "player_out": weak, "player_in": best,
            "financial": {
                "sell_price": weak["sell_price"], "buy_price": best["price"],
                "bank_before": bank, "bank_after": ba,
                "affordable": ba >= -0.05, "shortfall": round(max(0.0, -ba), 1),
            },
            "pros": pros[:4], "cons": cons[:3],
        })

    chip_advice: list[dict] = []
    top_c = captain_picks[0] if captain_picks else None
    bench_ep = round(sum(p["ep_next"] for p in bench), 1)

    if "3xc" not in chips_used:
        if top_c and top_c["player"]["ep_next"] >= 10 and top_c["next_fix_difficulty"] <= 2:
            chip_advice.append({
                "chip": "3xc", "name": "Triple Captain", "emoji": "3️⃣", "urgency": "use",
                "reasoning": f"{top_c['player']['name']} has {top_c['player']['ep_next']} xP vs {top_c['next_opponent']} (fdr:{top_c['next_fix_difficulty']}) — the TC ceiling is elite this GW.",
            })
        else:
            chip_advice.append({
                "chip": "3xc", "name": "Triple Captain", "emoji": "3️⃣", "urgency": "save",
                "reasoning": "No elite captain fixture right now. Save for when your best player faces a home fdr 1-2 game.",
            })

    if "bboost" not in chips_used:
        if bench_ep >= 18 and all(p["status"] == "a" for p in bench):
            chip_advice.append({
                "chip": "bboost", "name": "Bench Boost", "emoji": "💪", "urgency": "consider",
                "reasoning": f"Your bench has combined xP of {bench_ep} with all players available — decent BB opportunity.",
            })
        else:
            chip_advice.append({
                "chip": "bboost", "name": "Bench Boost", "emoji": "💪", "urgency": "save",
                "reasoning": f"Bench xP only {bench_ep}. Strengthen bench first or wait for a double GW.",
            })

    if "freehit" not in chips_used:
        chip_advice.append({
            "chip": "freehit", "name": "Free Hit", "emoji": "🎯", "urgency": "save",
            "reasoning": "Best used in a blank GW when most of your squad have no fixture. Don't waste it yet.",
        })

    inj_start   = sum(1 for p in starting if p["status"] in ("i", "u"))
    poor_start  = sum(1 for p in starting if p["form"] < 2.5 and p["status"] == "a")
    if inj_start >= 2 or poor_start >= 3:
        chip_advice.append({
            "chip": "wildcard", "name": "Wildcard", "emoji": "🃏",
            "urgency": "consider" if inj_start >= 3 else "think",
            "reasoning": f"{inj_start} starters out/injured, {poor_start} in very poor form — wildcard could unlock a much stronger squad.",
        })

    roadmap: list[dict] = []
    gw_base = next_gw or current_gw or 1
    for i in range(3):
        gw_num = gw_base + i
        label  = ["This GW", "Next GW", "GW+2"][i]
        good: list[str] = []
        bad:  list[str] = []
        blank: list[str] = []

        for p in starting:
            gw_fixes = [f for f in team_fix.get(p["team_id"], []) if f[0] == gw_num]
            if not gw_fixes:
                blank.append(p["name"]); continue
            fdr, opp = gw_fixes[0][2], gw_fixes[0][1]
            if fdr <= 2: good.append(f"{p['name']} vs {opp}")
            elif fdr >= 4: bad.append(f"{p['name']} vs {opp}")

        injured_now = [p["name"] for p in starting if p["status"] in ("i", "u")]
        actions: list[str] = []

        if i == 0:
            if injured_now:
                actions.append(f"🚨 Urgent: replace {', '.join(injured_now[:2])}")
            if transfers:
                t = transfers[0]
                actions.append(f"🔄 Best transfer: {t['player_out']['name']} → {t['player_in']['name']}")
            if captain_picks:
                c = captain_picks[0]
                actions.append(f"🎯 Captain: {c['player']['name']} ({c['player']['ep_next']} xP vs {c['next_opponent']})")
            if not actions:
                actions.append("✅ Squad looks solid — hold and observe")
        elif i == 1:
            best_next = sorted(
                [p for p in starting if any(f[0] == gw_num and f[2] <= 2 for f in team_fix.get(p["team_id"], []))],
                key=lambda x: x["ep_next"], reverse=True,
            )
            if best_next:
                actions.append(f"🎯 Captain candidate: {best_next[0]['name']} (great fixture)")
            actions.append("🔒 Hold unless injury/suspension forces a change")
        else:
            actions.append("👀 Monitor blank/double GW announcements")
            actions.append("💊 Preserve chips for a high-value opportunity")

        roadmap.append({
            "gw": gw_num, "label": label,
            "priority": "high" if (injured_now and i == 0) else "medium" if i == 0 else "low",
            "good_fixtures": good[:5], "bad_fixtures": bad[:3], "blanks": blank[:3],
            "actions": actions,
        })

    return {
        "gw": current_gw,
        "next_gw": next_gw,
        "captain_picks": captain_picks[:5],
        "chip_advice": chip_advice,
        "transfers": transfers,
        "roadmap": roadmap,
    }
