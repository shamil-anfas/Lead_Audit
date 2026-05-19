from fastapi import APIRouter, HTTPException
from models.schemas import SheetRequest
from services.sheets_service import append_leads

router = APIRouter()

@router.post("/append")
async def append(req: SheetRequest):
    """Append leads to Google Sheets with deduplication."""
    if not req.businesses:
        raise HTTPException(400, "No businesses provided")
    result = await append_leads(req.businesses)
    if not result.get("success"):
        raise HTTPException(500, result.get("error", "Sheets write failed"))
    return result
