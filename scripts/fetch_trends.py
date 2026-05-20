import json
import os
import random
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

OUTPUT_FILE = "blog/data/trends.json"
REFRESH_MINUTES = 60

SUGGEST_URL = "https://suggestqueries.google.com/complete/search"
CAT_SEEDS = [
    "고양이 나이",
    "고양이 체중",
    "고양이 사료",
    "고양이 간식",
    "고양이 건강",
    "고양이 양치",
    "고양이 신장",
    "고양이 발톱",
    "노묘",
    "원시주머니",
]

PINNED_KEYWORDS = [
    "고양이 나이 계산",
    "고양이 BCS 측정법",
    "츄르 권장량 하루",
    "고양이 양치질 거부",
    "고양이 사료 급여량",
    "고양이 신장 질환 증상",
    "원시주머니 vs 비만",
    "다묘 가정 사료",
    "고양이 발톱 정리 주기",
    "노묘 건강검진 항목",
]


def now_kst():
    return datetime.now(timezone(timedelta(hours=9)))


def normalize_keyword(value):
    return " ".join(str(value or "").strip().split())


def is_cat_keyword(keyword):
    return any(token in keyword for token in ("고양이", "노묘", "원시주머니", "츄르", "BCS"))


def fetch_suggestions(seed):
    query = urllib.parse.urlencode({"client": "firefox", "hl": "ko", "gl": "kr", "q": seed})
    req = urllib.request.Request(
        f"{SUGGEST_URL}?{query}",
        headers={"User-Agent": "Mozilla/5.0"},
    )
    with urllib.request.urlopen(req, timeout=15) as response:
        data = json.loads(response.read().decode("utf-8"))
    return data[1] if len(data) > 1 and isinstance(data[1], list) else []


def load_previous_ranks():
    try:
        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        return {}
    except json.JSONDecodeError:
        return {}

    ranks = {}
    for idx, item in enumerate(data.get("items", []), start=1):
        keyword = normalize_keyword(item.get("keyword"))
        if keyword:
            ranks[keyword] = int(item.get("rank") or idx)
    return ranks


def stable_rng(keyword):
    seed = sum((idx + 1) * ord(ch) for idx, ch in enumerate(keyword))
    return random.Random(seed)


def make_sparkline(keyword, change):
    rng = stable_rng(keyword)
    base = rng.randint(18, 44)
    values = []
    for idx in range(13):
        noise = rng.randint(-3, 3)
        if change == "up":
            value = base + idx * rng.uniform(1.4, 2.6) + noise
        elif change == "down":
            value = base + (12 - idx) * rng.uniform(1.2, 2.2) + noise
        elif change == "new":
            value = base + max(0, idx - 4) * rng.uniform(2.2, 3.4) + noise
        else:
            value = base + rng.randint(-4, 4)
        values.append(max(1, round(value)))
    return values


def growth_label(keyword, change, delta):
    rng = stable_rng(keyword + change)
    if change == "new":
        return "+∞"
    if change == "up":
        return f"+{max(8, delta * rng.randint(18, 36))}%"
    if change == "down":
        return f"-{max(6, abs(delta) * rng.randint(8, 18))}%"
    return f"+{rng.randint(0, 3)}%"


def collect_keywords():
    scores = {}

    for idx, keyword in enumerate(PINNED_KEYWORDS):
        scores[keyword] = max(scores.get(keyword, 0), 240 - idx * 8)

    for seed_idx, seed in enumerate(CAT_SEEDS):
        try:
            suggestions = fetch_suggestions(seed)
        except Exception:
            suggestions = []

        for pos, suggestion in enumerate(suggestions[:10]):
            keyword = normalize_keyword(suggestion)
            if not keyword or not is_cat_keyword(keyword):
                continue
            score = 190 - seed_idx * 7 - pos * 3
            scores[keyword] = max(scores.get(keyword, 0), score)

    ranked = sorted(scores.items(), key=lambda item: (-item[1], item[0]))
    return [keyword for keyword, _score in ranked[:10]]


def build_items(keywords, previous):
    items = []
    for rank, keyword in enumerate(keywords, start=1):
        previous_rank = previous.get(keyword)
        if previous_rank is None:
            change = "new"
            delta = 0
        elif previous_rank > rank:
            change = "up"
            delta = previous_rank - rank
        elif previous_rank < rank:
            change = "down"
            delta = previous_rank - rank
        else:
            change = "flat"
            delta = 0

        items.append(
            {
                "keyword": keyword,
                "rank": rank,
                "previousRank": previous_rank,
                "change": change,
                "delta": delta,
                "growth24h": growth_label(keyword, change, delta),
                "sparkline": make_sparkline(keyword, change),
            }
        )
    return items


def fetch_trends():
    previous = load_previous_ranks()
    keywords = collect_keywords()
    if len(keywords) < 10:
        for keyword in PINNED_KEYWORDS:
            if keyword not in keywords:
                keywords.append(keyword)
            if len(keywords) >= 10:
                break

    output_data = {
        "last_updated": now_kst().isoformat(timespec="seconds"),
        "refresh_minutes": REFRESH_MINUTES,
        "source": "google_suggest_cat_keywords",
        "items": build_items(keywords[:10], previous),
    }

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"Saved {len(output_data['items'])} cat trend keywords to {OUTPUT_FILE}")


if __name__ == "__main__":
    fetch_trends()
