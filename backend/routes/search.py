from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from models.schemas import SearchRequest
from services.apify_service import search_stream

router = APIRouter()

@router.post("/stream")
async def search(req: SearchRequest):
    """Stream search progress + results via Server-Sent Events."""
    kw = req.keyword.strip()
    if not kw:
        raise HTTPException(400, "keyword is required")
    if len(kw) > 250:
        raise HTTPException(400, "keyword too long")
    return StreamingResponse(
        search_stream(kw, req.max_results),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
