from fastapi import APIRouter, HTTPException
from models.schemas import AuditRequest
from services.audit_service import run_audit
from services.sheets_service import append_audit

router = APIRouter()

@router.post("/run")
async def audit(req: AuditRequest):
    """Run a single website audit. Semaphore ensures one at a time."""
    url = req.website.strip()
    if not url.startswith("http"):
        url = "https://" + url
    result = await run_audit(req.business_id, req.name, url)
    if result.status == "done":
        await append_audit(result)
    return result
