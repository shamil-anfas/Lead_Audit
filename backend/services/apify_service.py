import httpx
import asyncio
import os
import uuid
import json
from typing import AsyncGenerator
from models.schemas import Business

APIFY_KEY = os.getenv("APIFY_API_KEY", "")
ACTOR_ID  = "compass~crawler-google-places"
BASE      = "https://api.apify.com/v2"


async def start_run(keyword: str, max_results: int) -> str:
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(
            f"{BASE}/acts/{ACTOR_ID}/runs",
            params={"token": APIFY_KEY},
            json={
                "searchStringsArray": [keyword],
                "maxCrawledPlacesPerSearch": max_results,
                "language": "en",
                "countryCode": "in",
            },
        )
        r.raise_for_status()
        return r.json()["data"]["id"]


async def fetch_dataset(dataset_id: str, limit: int = 500) -> list:
    async with httpx.AsyncClient(timeout=40) as c:
        r = await c.get(
            f"{BASE}/datasets/{dataset_id}/items",
            params={"token": APIFY_KEY, "limit": limit, "format": "json"},
        )
        r.raise_for_status()
        return r.json()


def to_business(raw: dict) -> Business:
    site = raw.get("website") or None
    if site and not site.startswith("http"):
        site = "https://" + site
    if site and "google.com/maps" in site:
        site = None

    addr  = raw.get("address") or ""
    parts = addr.split(",")
    city  = raw.get("city") or (parts[-2].strip() if len(parts) >= 2 else "")
    priority = "No Website – HIGH Priority" if not site else "Has Website – Secondary"

    return Business(
        id=str(uuid.uuid4()),
        name=raw.get("title") or raw.get("name") or "Unknown",
        category=raw.get("categoryName") or "",
        address=addr,
        phone=raw.get("phone") or "",
        rating=str(raw.get("totalScore") or ""),
        website=site,
        maps_url=raw.get("url") or "",
        city=city,
        priority=priority,
    )


def sse(event: str, data: dict) -> str:
    return f"data: {json.dumps({'event': event, 'data': data})}\n\n"


async def search_stream(keyword: str, max_results: int = 200) -> AsyncGenerator[str, None]:
    if not APIFY_KEY:
        yield sse("error", {"message": "APIFY_API_KEY not set in .env"})
        return

    try:
        yield sse("status", {"message": f"Starting Google Maps search for '{keyword}'…"})
        run_id = await start_run(keyword, max_results)
        yield sse("status", {"message": "Scraper running, collecting results…"})

        dataset_id = None
        elapsed = 0

        async with httpx.AsyncClient(timeout=15) as client:
            while elapsed < 210:
                await asyncio.sleep(5)
                elapsed += 5
                try:
                    r = await client.get(f"{BASE}/actor-runs/{run_id}", params={"token": APIFY_KEY})
                    run = r.json()["data"]
                    status  = run.get("status", "")
                    scraped = run.get("stats", {}).get("crawledItems", 0)

                    yield sse("progress", {"message": f"Scraped {scraped} businesses…", "scraped": scraped})

                    if status == "SUCCEEDED":
                        dataset_id = run["defaultDatasetId"]
                        break
                    elif status in ("FAILED", "ABORTED", "TIMED-OUT"):
                        yield sse("error", {"message": f"Apify run {status}. Please try again."})
                        return
                except Exception:
                    pass

        if not dataset_id:
            yield sse("error", {"message": "Could not retrieve dataset. Try again."})
            return

        yield sse("status", {"message": "Fetching all results…"})
        raw_items  = await fetch_dataset(dataset_id, limit=max_results + 100)
        businesses = [to_business(r) for r in raw_items if r.get("title") or r.get("name")]
        businesses = businesses[:max_results]  # enforce the requested limit

        yield sse("status", {"message": f"Found {len(businesses)} businesses!"})
        yield sse("results", {"businesses": [b.model_dump() for b in businesses]})

    except httpx.HTTPStatusError as e:
        code = e.response.status_code
        if code == 401:
            yield sse("error", {"message": "Invalid Apify API key."})
        elif code == 429:
            yield sse("error", {"message": "Apify rate limit. Wait and try again."})
        else:
            yield sse("error", {"message": f"Apify error {code}."})
    except Exception as e:
        yield sse("error", {"message": f"Unexpected error: {str(e)}"})
