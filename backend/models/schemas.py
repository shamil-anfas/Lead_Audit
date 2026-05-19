from pydantic import BaseModel
from typing import Optional, List


class Business(BaseModel):
    id: str
    name: str
    category: Optional[str] = ""
    address: Optional[str] = ""
    phone: Optional[str] = ""
    rating: Optional[str] = ""
    website: Optional[str] = None
    maps_url: Optional[str] = ""
    city: Optional[str] = ""
    priority: Optional[str] = ""


class SearchRequest(BaseModel):
    keyword: str
    max_results: int = 200


class AuditRequest(BaseModel):
    business_id: str
    name: str
    website: str


class AuditScores(BaseModel):
    seo: int = 0
    performance: int = 0
    mobile: int = 0
    design: int = 0
    ux: int = 0
    conversion: int = 0
    overall: int = 0


class AuditRecommendation(BaseModel):
    type: str
    title: str
    description: str
    impact: str
    effort: str


class AuditResult(BaseModel):
    business_id: str
    name: str
    website: str
    scores: AuditScores
    lead_quality: str = "Medium"
    executive_summary: str = ""
    design_analysis: str = ""
    ux_analysis: str = ""
    performance_analysis: str = ""
    mobile_analysis: str = ""
    seo_analysis: str = ""
    conversion_analysis: str = ""
    strengths: List[str] = []
    weaknesses: List[str] = []
    missing: List[str] = []
    recommendations: List[AuditRecommendation] = []
    final_verdict: str = ""
    status: str = "done"
    error: Optional[str] = None


class SheetRequest(BaseModel):
    businesses: List[Business]
