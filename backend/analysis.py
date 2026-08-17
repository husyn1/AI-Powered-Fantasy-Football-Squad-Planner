import numpy as np
from sklearn.cluster import KMeans
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import StandardScaler

CLUSTER_NAMES = ["Conservative", "Volatile", "Aggressive"]


def _build_features(rows: list[dict]) -> np.ndarray:
    points = [r["points"] for r in rows]
    X = []
    for i, r in enumerate(rows):
        prev_rank = rows[i - 1].get("overall_rank") if i > 0 else None
        curr_rank = r.get("overall_rank")
        rank_delta = (prev_rank - curr_rank) if (prev_rank and curr_rank) else 0

        start = max(0, i - 2)
        rolling_avg = float(np.mean(points[start : i + 1]))

        chip_flag = 1.0 if r.get("chip") else 0.0

        X.append(
            [
                float(r["points"]),
                float(r["transfers"] or 0),
                float(r["hit"] or 0),
                float(rank_delta),
                rolling_avg,
                chip_flag,
            ]
        )
    return np.array(X, dtype=float)


def run_analysis(rows: list[dict]) -> dict:
    if len(rows) < 3:
        return {"error": "Not enough data — need at least 3 completed gameweeks."}

    X = _build_features(rows)
    scaler = StandardScaler()
    Xs = scaler.fit_transform(X)

    n_clusters = min(3, len(rows))
    km = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    labels = km.fit_predict(Xs)

    cluster_hit_mean: dict[int, list[float]] = {}
    for i, row in enumerate(rows):
        c = int(labels[i])
        cluster_hit_mean.setdefault(c, []).append(float(row["hit"] or 0))

    sorted_clusters = sorted(cluster_hit_mean.keys(), key=lambda c: np.mean(cluster_hit_mean[c]))
    cluster_labels: dict[str, str] = {}
    for rank, c in enumerate(sorted_clusters):
        cluster_labels[str(c)] = CLUSTER_NAMES[rank]

    clusters: dict[int, int] = {rows[i]["gw"]: int(labels[i]) for i in range(len(rows))}

    k = min(4, len(rows))
    nn = NearestNeighbors(n_neighbors=k, metric="cosine")
    nn.fit(Xs)
    distances, indices = nn.kneighbors([Xs[-1]])

    similar_weeks = []
    for dist, idx in zip(distances[0], indices[0]):
        if int(idx) == len(rows) - 1:
            continue
        similar_weeks.append({"gw": rows[int(idx)]["gw"], "distance": round(float(dist), 4)})
        if len(similar_weeks) >= 3:
            break

    pts = [r["points"] for r in rows]
    hits = [r["hit"] or 0 for r in rows]
    summary = {
        "avg_points": round(float(np.mean(pts)), 1),
        "total_hits": int(sum(hits)),
        "hit_weeks_count": int(sum(1 for h in hits if h > 0)),
        "best_gw": int(rows[int(np.argmax(pts))]["gw"]),
        "worst_gw": int(rows[int(np.argmin(pts))]["gw"]),
    }

    return {
        "rows": rows,
        "clusters": clusters,
        "cluster_labels": cluster_labels,
        "similar_weeks": similar_weeks,
        "summary": summary,
    }
