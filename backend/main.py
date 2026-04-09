"""
Academy Finder Backend — FastAPI Service
Proxies Google Places API to find nearby academies based on user skills.
"""

import os
import httpx
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="EliteForge API", version="1.0.0")

# CORS — allow the Express frontend (port 3000) and local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")

PLACES_NEARBY_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
PLACE_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"
PLACE_PHOTO_URL   = "https://maps.googleapis.com/maps/api/place/photo"


# ──────────────────────────────────────────────
#  Helper: build a photo URL from photo_reference
# ──────────────────────────────────────────────
def photo_url(photo_reference: str, max_width: int = 400) -> str:
    if not GOOGLE_API_KEY:
        return ""
    return (
        f"{PLACE_PHOTO_URL}"
        f"?maxwidth={max_width}"
        f"&photoreference={photo_reference}"
        f"&key={GOOGLE_API_KEY}"
    )


# ──────────────────────────────────────────────
#  GET /api/find-academies
# ──────────────────────────────────────────────
@app.get("/api/find-academies")
async def find_academies(
    lat: float = Query(..., description="User latitude"),
    lng: float = Query(..., description="User longitude"),
    skills: str = Query(..., description="Comma-separated skill list"),
    radius: int = Query(10000, description="Search radius in metres"),
):
    """
    For each skill, search Google Places for nearby academies/training
    institutes, deduplicate by place_id, and return the merged list.
    """
    if not GOOGLE_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Google API key not configured. Set GOOGLE_API_KEY in backend/.env",
        )

    skill_list = [s.strip() for s in skills.split(",") if s.strip()]
    if not skill_list:
        raise HTTPException(status_code=400, detail="No skills provided")

    seen_ids: set[str] = set()
    results: list[dict] = []

    async with httpx.AsyncClient(timeout=15) as client:
        for skill in skill_list:
            keyword = f"{skill} academy"
            params = {
                "location": f"{lat},{lng}",
                "radius": radius,
                "keyword": keyword,
                "key": GOOGLE_API_KEY,
            }
            resp = await client.get(PLACES_NEARBY_URL, params=params)
            data = resp.json()

            for place in data.get("results", []):
                pid = place.get("place_id")
                if pid and pid not in seen_ids:
                    seen_ids.add(pid)

                    # Extract first photo reference if available
                    photos = place.get("photos", [])
                    photo = photo_url(photos[0]["photo_reference"]) if photos else ""

                    results.append(
                        {
                            "name": place.get("name", ""),
                            "rating": place.get("rating", 0),
                            "user_ratings_total": place.get("user_ratings_total", 0),
                            "address": place.get("vicinity", ""),
                            "place_id": pid,
                            "photo": photo,
                            "skill": skill,
                            "location": {
                                "lat": place["geometry"]["location"]["lat"],
                                "lng": place["geometry"]["location"]["lng"],
                            },
                        }
                    )

    # Sort by rating descending
    results.sort(key=lambda x: x.get("rating", 0), reverse=True)
    return results


# ──────────────────────────────────────────────
#  GET /api/academy-details
# ──────────────────────────────────────────────
@app.get("/api/academy-details")
async def academy_details(
    place_id: str = Query(..., description="Google Place ID"),
):
    """
    Fetch full details for a single academy / place.
    """
    if not GOOGLE_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Google API key not configured. Set GOOGLE_API_KEY in backend/.env",
        )

    fields = (
        "name,formatted_address,formatted_phone_number,website,"
        "opening_hours,photos,reviews,rating,user_ratings_total,"
        "geometry,url,types"
    )

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            PLACE_DETAILS_URL,
            params={
                "place_id": place_id,
                "fields": fields,
                "key": GOOGLE_API_KEY,
            },
        )
        data = resp.json()

    result = data.get("result")
    if not result:
        raise HTTPException(status_code=404, detail="Place not found")

    # Build photo URLs
    photos = [
        photo_url(p["photo_reference"], max_width=800)
        for p in result.get("photos", [])
    ]

    # Format reviews
    reviews = [
        {
            "author": r.get("author_name", ""),
            "rating": r.get("rating", 0),
            "text": r.get("text", ""),
            "time": r.get("relative_time_description", ""),
        }
        for r in result.get("reviews", [])
    ]

    return {
        "name": result.get("name", ""),
        "address": result.get("formatted_address", ""),
        "phone": result.get("formatted_phone_number", ""),
        "website": result.get("website", ""),
        "rating": result.get("rating", 0),
        "user_ratings_total": result.get("user_ratings_total", 0),
        "opening_hours": result.get("opening_hours", {}).get("weekday_text", []),
        "is_open": result.get("opening_hours", {}).get("open_now"),
        "photos": photos,
        "reviews": reviews,
        "location": {
            "lat": result["geometry"]["location"]["lat"],
            "lng": result["geometry"]["location"]["lng"],
        },
        "maps_url": result.get("url", ""),
    }



# ══════════════════════════════════════════════
#  COMPETITION TRACKER ENDPOINTS
# ══════════════════════════════════════════════

# Mock competition data (will be replaced by DB later)
MOCK_COMPETITIONS: list[dict] = []  # Loaded from frontend mock data for now


@app.get("/api/skill-competitions")
async def skill_competitions(
    skills: str = Query(..., description="Comma-separated skill list"),
    lat: float = Query(None, description="User latitude"),
    lng: float = Query(None, description="User longitude"),
):
    """
    Return competitions related to the user's skills.
    Currently returns empty list — frontend uses its own mock data.
    When DB is added, this will query the competitions table.
    """
    skill_list = [s.strip().lower() for s in skills.split(",") if s.strip()]
    # Placeholder: will query DB in the future
    return {"skills": skill_list, "competitions": [], "source": "api_placeholder"}


@app.get("/api/search-competitions")
async def search_competitions(
    query: str = Query(..., description="Search keyword"),
):
    """
    Return competitions matching a search query.
    Currently returns empty list — frontend uses its own mock data.
    """
    return {"query": query, "competitions": [], "source": "api_placeholder"}


@app.get("/api/competition-details")
async def competition_details(
    id: str = Query(..., description="Competition ID"),
):
    """
    Return full details for a competition.
    Currently returns empty — frontend uses its own mock data.
    """
    return {"id": id, "details": None, "source": "api_placeholder"}


# ──────────────────────────────────────────────
#  Health check
# ──────────────────────────────────────────────
@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "google_api_configured": bool(GOOGLE_API_KEY),
    }
