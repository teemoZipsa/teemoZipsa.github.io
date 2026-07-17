import json
import os
import tempfile
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

OUTPUT_FILE = "blog/data/trends.json"
REFRESH_POLICY = "manual_on_release"

SUGGEST_URL = "https://suggestqueries.google.com/complete/search"
CAT_SEEDS = [
    "고양이 나이",
    "고양이 체중",
    "고양이 사료",
    "고양이 간식",
    "고양이 건강",
    "고양이 신장",
    "노묘",
    "원시주머니",
]

EDITORIAL_FALLBACK_KEYWORDS = [
    "고양이 나이 계산",
    "고양이 BCS 측정법",
    "츄르 권장량 하루",
    "고양이 체중 관리",
    "고양이 사료 급여량",
    "고양이 신장 질환 증상",
    "원시주머니 vs 비만",
    "다묘 가정 사료",
    "고양이 건강검진 비용",
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


def load_previous_data():
    try:
        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {}
    except json.JSONDecodeError:
        return {}


def collect_keywords():
    items = []
    seen = set()
    successful_requests = 0

    # Google Suggest exposes suggestion text and order, not search volume.
    # Keep at most two suggestions per seed so one broad seed cannot dominate.
    for seed in CAT_SEEDS:
        try:
            suggestions = fetch_suggestions(seed)
            successful_requests += 1
        except Exception:
            suggestions = []

        accepted_for_seed = 0
        for pos, suggestion in enumerate(suggestions):
            keyword = normalize_keyword(suggestion)
            if not keyword or keyword in seen or not is_cat_keyword(keyword):
                continue
            seen.add(keyword)
            items.append(
                {
                    "keyword": keyword,
                    "origin": "google_suggest",
                    "seed": seed,
                    "suggestion_position": pos + 1,
                }
            )
            accepted_for_seed += 1
            if accepted_for_seed >= 2 or len(items) >= 10:
                break
        if len(items) >= 10:
            break

    for keyword in EDITORIAL_FALLBACK_KEYWORDS:
        if len(items) >= 10:
            break
        if keyword in seen:
            continue
        seen.add(keyword)
        items.append({"keyword": keyword, "origin": "editorial_fallback"})

    for position, item in enumerate(items, start=1):
        item["position"] = position
    return items, successful_requests


def fetch_trends():
    previous_data = load_previous_data()
    items, successful_requests = collect_keywords()
    if successful_requests == 0:
        raise RuntimeError("Google Suggest requests all failed; keeping the existing trend data unchanged")
    if not any(item.get("origin") == "google_suggest" for item in items):
        raise RuntimeError("Google Suggest returned no usable cat topics; keeping the existing trend data unchanged")

    output_data = {
        "last_updated": now_kst().isoformat(timespec="seconds"),
        "refresh_policy": REFRESH_POLICY,
        "source": "google_suggest_with_editorial_fallback",
        "methodology": "Suggestion order is not search volume or popularity. Editorial keywords are fallback only.",
        "items": items,
    }

    if (
        previous_data.get("refresh_policy") == REFRESH_POLICY
        and previous_data.get("source") == output_data["source"]
        and previous_data.get("methodology") == output_data["methodology"]
        and previous_data.get("items") == items
    ):
        print(f"No topic changes; leaving {OUTPUT_FILE} untouched")
        return

    output_dir = os.path.dirname(OUTPUT_FILE) or "."
    os.makedirs(output_dir, exist_ok=True)
    temp_file = None
    try:
        with tempfile.NamedTemporaryFile(
            "w",
            encoding="utf-8",
            dir=output_dir,
            prefix=".trends-",
            suffix=".tmp",
            delete=False,
        ) as f:
            temp_file = f.name
            json.dump(output_data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        os.replace(temp_file, OUTPUT_FILE)
    finally:
        if temp_file and os.path.exists(temp_file):
            os.remove(temp_file)

    print(f"Saved {len(output_data['items'])} cat search-suggestion topics to {OUTPUT_FILE}")


if __name__ == "__main__":
    try:
        fetch_trends()
    except RuntimeError as exc:
        raise SystemExit(f"Trend update failed: {exc}") from exc
