from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

load_dotenv()

from routes.search import router as search_router
from routes.audit  import router as audit_router
from routes.sheets import router as sheets_router

app = FastAPI(title="LeadAudit Pro API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        os.getenv("FRONTEND_URL", "http://localhost:3000"),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(search_router, prefix="/api/search", tags=["Search"])
app.include_router(audit_router,  prefix="/api/audit",  tags=["Audit"])
app.include_router(sheets_router, prefix="/api/sheets", tags=["Sheets"])

@app.get("/")
def root():
    return {"status": "ok", "message": "LeadAudit Pro API"}

@app.get("/health")
def health():
    return {"status": "healthy"}
