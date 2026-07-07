import gspread
import os
import json
from google.oauth2.service_account import Credentials
from datetime import datetime
from typing import List
from models.schemas import Business, AuditResult

SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]

LEADS_COLS = ["Company Name", "Phone", "Address", "Category", "Website",
              "Rating", "Maps Link", "Priority", "Website Status", "Date Added"]
AUDIT_COLS = ["Company Name", "Website", "Overall", "SEO", "Performance",
              "Mobile", "Design", "UX", "Conversion", "Lead Quality", "Audit Date"]


def _client():
    # Read env vars here (at call time), NOT at module import time,
    # so that load_dotenv() in main.py has already run.
    sa_json = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", "")
    if not sa_json:
        raise ValueError("GOOGLE_SERVICE_ACCOUNT_JSON is not set in environment")

    info = json.loads(sa_json)

    # Use the modern gspread v6+ API (gspread.authorize is deprecated)
    return gspread.service_account_from_dict(info)


def _sheet(spreadsheet, title, headers):
    try:
        return spreadsheet.worksheet(title)
    except gspread.WorksheetNotFound:
        ws = spreadsheet.add_worksheet(title=title, rows=2000, cols=len(headers))
        ws.append_row(headers)
        return ws


async def append_leads(businesses: List[Business]) -> dict:
    try:
        sheet_id = os.getenv("GOOGLE_SHEETS_ID", "")
        if not sheet_id:
            return {"success": False, "error": "GOOGLE_SHEETS_ID is not set in environment"}

        client = _client()
        ss     = client.open_by_key(sheet_id)
        ws     = _sheet(ss, "Leads", LEADS_COLS)

        existing = set(v.strip().lower() for v in ws.col_values(1)[1:] if v)
        new_rows = []
        for b in businesses:
            if b.name.strip().lower() in existing:
                continue
            existing.add(b.name.strip().lower())
            
            # Prefix with single quote to prevent formula parse errors in Google Sheets
            phone_val = f"'{b.phone}" if b.phone else ""
            
            new_rows.append([
                b.name, phone_val, b.address, b.category,
                b.website or "", b.rating, b.maps_url, b.priority,
                "Has Website" if b.website else "No Website",
                datetime.now().strftime("%Y-%m-%d %H:%M"),
            ])
        if new_rows:
            ws.append_rows(new_rows, value_input_option="USER_ENTERED")
        return {"success": True, "added": len(new_rows), "skipped": len(businesses) - len(new_rows)}
    except json.JSONDecodeError:
        return {"success": False, "error": "GOOGLE_SERVICE_ACCOUNT_JSON is invalid JSON — check your .env file"}
    except PermissionError:
        return {"success": False, "error": "Google Sheets API is disabled or service account lacks access. Enable it at: https://console.developers.google.com/apis/api/sheets.googleapis.com"}
    except Exception as e:
        msg = str(e) or type(e).__name__
        return {"success": False, "error": msg}


async def append_audit(audit: AuditResult) -> dict:
    try:
        sheet_id = os.getenv("GOOGLE_SHEETS_ID", "")
        if not sheet_id:
            return {"success": False, "error": "GOOGLE_SHEETS_ID is not set in environment"}

        client = _client()
        ss     = client.open_by_key(sheet_id)
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
