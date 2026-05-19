import gspread
import os
import json
from google.oauth2.service_account import Credentials
from datetime import datetime
from typing import List
from models.schemas import Business, AuditResult

SCOPES   = ["https://www.googleapis.com/auth/spreadsheets"]
SHEET_ID = os.getenv("GOOGLE_SHEETS_ID", "")
SA_JSON  = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", "")

LEADS_COLS = ["Company Name","Phone","Address","Category","Website",
              "Rating","Maps Link","Priority","Website Status","Date Added"]
AUDIT_COLS = ["Company Name","Website","Overall","SEO","Performance",
              "Mobile","Design","UX","Conversion","Lead Quality","Audit Date"]


def _client():
    if not SA_JSON:
        raise ValueError("GOOGLE_SERVICE_ACCOUNT_JSON not set")
    info  = json.loads(SA_JSON)
    creds = Credentials.from_service_account_info(info, scopes=SCOPES)
    return gspread.authorize(creds)


def _sheet(spreadsheet, title, headers):
    try:
        return spreadsheet.worksheet(title)
    except gspread.WorksheetNotFound:
        ws = spreadsheet.add_worksheet(title=title, rows=2000, cols=len(headers))
        ws.append_row(headers)
        return ws


async def append_leads(businesses: List[Business]) -> dict:
    try:
        client = _client()
        ss     = client.open_by_key(SHEET_ID)
        ws     = _sheet(ss, "Leads", LEADS_COLS)

        existing = set(v.strip().lower() for v in ws.col_values(1)[1:] if v)
        new_rows = []
        for b in businesses:
            if b.name.strip().lower() in existing:
                continue
            existing.add(b.name.strip().lower())
            new_rows.append([
                b.name, b.phone, b.address, b.category,
                b.website or "", b.rating, b.maps_url, b.priority,
                "Has Website" if b.website else "No Website",
                datetime.now().strftime("%Y-%m-%d %H:%M"),
            ])
        if new_rows:
            ws.append_rows(new_rows, value_input_option="USER_ENTERED")
        return {"success": True, "added": len(new_rows), "skipped": len(businesses)-len(new_rows)}
    except json.JSONDecodeError:
        return {"success": False, "error": "GOOGLE_SERVICE_ACCOUNT_JSON is invalid JSON"}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def append_audit(audit: AuditResult) -> dict:
    try:
        client = _client()
        ss     = client.open_by_key(SHEET_ID)
        ws     = _sheet(ss, "Audits", AUDIT_COLS)
        s      = audit.scores
        ws.append_row([
            audit.name, audit.website, s.overall, s.seo, s.performance,
            s.mobile, s.design, s.ux, s.conversion, audit.lead_quality,
            datetime.now().strftime("%Y-%m-%d %H:%M"),
        ])
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}
