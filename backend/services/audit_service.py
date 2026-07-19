import httpx
import asyncio
import os
import json
import re
from groq import AsyncGroq
from models.schemas import AuditResult, AuditScores, AuditRecommendation

PAGESPEED_URL = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"


def _groq_client():
    """Build Groq client at call time so the API key is always current."""
    key = os.getenv("GROQ_API_KEY", "")
    return AsyncGroq(api_key=key)

# CRITICAL: Only 1 audit at a time — prevents Groq 429 rate limit errors
_sem = asyncio.Semaphore(1)


def _extract_json(text: str) -> dict:
    """
    Robustly extract a JSON object from an AI response that may contain:
    - Markdown code fences (```json ... ``` or ``` ... ```)
    - Preamble text before the JSON
    - Trailing text or commentary after the JSON
    - Truncated responses (tries to find the largest valid {...} block)
    """
    # Step 1: strip markdown fences
    text = re.sub(r'```(?:json)?', '', text).strip()

    # Step 2: find the outermost { ... } using a brace-matching scan
    start = text.find('{')
    if start == -1:
        raise json.JSONDecodeError("No JSON object found", text, 0)

    depth = 0
    end = -1
    in_string = False
    escape = False
    for i, ch in enumerate(text[start:], start):
        if escape:
            escape = False
            continue
        if ch == '\\' and in_string:
            escape = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                end = i
                break

    if end == -1:
        # Truncated — try to parse what we have by closing open braces
        fragment = text[start:]
        open_braces = fragment.count('{') - fragment.count('}')
        fragment += '}' * open_braces
        return json.loads(fragment)

    return json.loads(text[start:end + 1])


async def get_pagespeed(url: str) -> dict:
    pagespeed_key = os.getenv("PAGESPEED_API_KEY", "")
    out = {"error": False}
    async with httpx.AsyncClient(timeout=35) as c:
        try:
            r = await c.get(PAGESPEED_URL, params={
                "url": url, "key": pagespeed_key, "strategy": "mobile",
                "category": ["performance", "seo", "accessibility", "best-practices"],
            })
            if r.status_code == 200:
                d    = r.json()
                cats = d.get("lighthouseResult", {}).get("categories", {})
                auds = d.get("lighthouseResult", {}).get("audits", {})
                def pct(cat): return round((cat.get("score") or 0) * 100) if cat else 0
                out.update({
                    "mobile_perf":    pct(cats.get("performance")),
                    "seo":            pct(cats.get("seo")),
                    "accessibility":  pct(cats.get("accessibility")),
                    "best_practices": pct(cats.get("best-practices")),
                    "lcp":  auds.get("largest-contentful-paint", {}).get("displayValue", "N/A"),
                    "fcp":  auds.get("first-contentful-paint", {}).get("displayValue", "N/A"),
                    "cls":  auds.get("cumulative-layout-shift", {}).get("displayValue", "N/A"),
                    "tbt":  auds.get("total-blocking-time", {}).get("displayValue", "N/A"),
                    "has_ssl":      url.startswith("https"),
                    "has_meta":     auds.get("meta-description", {}).get("score", 0) == 1,
                    "has_viewport": auds.get("viewport", {}).get("score", 0) == 1,
                })
        except Exception as e:
            out["error"] = True
            out["error_msg"] = str(e)

        try:
            r2 = await c.get(PAGESPEED_URL, params={
                "url": url, "key": pagespeed_key, "strategy": "desktop",
                "category": ["performance"],
            })
            if r2.status_code == 200:
                cats2 = r2.json().get("lighthouseResult", {}).get("categories", {})
                out["desktop_perf"] = round((cats2.get("performance", {}).get("score") or 0) * 100)
        except Exception:
            out["desktop_perf"] = out.get("mobile_perf", 50)
    return out


async def analyze(name: str, url: str, ps: dict) -> dict:
    ps_text = f"""
Real PageSpeed Insights data:
- Mobile Performance : {ps.get('mobile_perf','N/A')}/100
- Desktop Performance: {ps.get('desktop_perf','N/A')}/100
- SEO Score          : {ps.get('seo','N/A')}/100
- Accessibility      : {ps.get('accessibility','N/A')}/100
- Best Practices     : {ps.get('best_practices','N/A')}/100
- LCP (load speed)   : {ps.get('lcp','N/A')}
- FCP                : {ps.get('fcp','N/A')}
- CLS (layout shift) : {ps.get('cls','N/A')}
- Total Blocking Time: {ps.get('tbt','N/A')}
- SSL (HTTPS)        : {'Yes' if ps.get('has_ssl') else 'No'}
- Meta description   : {'Present' if ps.get('has_meta') else 'Missing'}
- Mobile viewport    : {'Configured' if ps.get('has_viewport') else 'Missing'}
""" if not ps.get("error") else "PageSpeed unavailable — estimate based on URL."

    prompt = f"""You are a professional website auditor generating a SiteScope-style audit report.

Business: {name}
Website: {url}

{ps_text}

Return ONLY a raw JSON object — no markdown, no explanation, no code fences.

{{
  "scores": {{
    "seo": <integer 0-100 — use real PageSpeed SEO score>,
    "performance": <integer — average mobile and desktop perf>,
    "mobile": <integer — use real mobile_perf score>,
    "design": <integer — estimate from best_practices + accessibility>,
    "ux": <integer — estimate from performance + accessibility>,
    "conversion": <integer — estimate conversion readiness>,
    "overall": <weighted: seo*0.2 + perf*0.2 + mobile*0.2 + design*0.15 + ux*0.15 + conv*0.1>
  }},
  "lead_quality": "<Hot if overall<60, Medium if 60-75, Low if >75>",
  "executive_summary": "<3 sentences: overall health, key strength, biggest opportunity>",
  "design_analysis": "<2-3 sentences on visual design>",
  "ux_analysis": "<2-3 sentences on user experience>",
  "performance_analysis": "<2-3 sentences referencing real LCP, FCP, CLS values>",
  "mobile_analysis": "<2-3 sentences using the real mobile score>",
  "seo_analysis": "<2-3 sentences using real SEO score and meta description status>",
  "conversion_analysis": "<2-3 sentences on CTA, trust signals, lead capture>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "weaknesses": ["<weakness 1>", "<weakness 2>", "<weakness 3>"],
  "missing": ["<missing element 1>", "<missing element 2>", "<missing element 3>"],
  "recommendations": [
    {{"type":"quick_win",   "title":"<title>","description":"<desc>","impact":"high",  "effort":"low"}},
    {{"type":"quick_win",   "title":"<title>","description":"<desc>","impact":"medium","effort":"low"}},
    {{"type":"high_impact", "title":"<title>","description":"<desc>","impact":"high",  "effort":"medium"}},
    {{"type":"high_impact", "title":"<title>","description":"<desc>","impact":"high",  "effort":"high"}},
    {{"type":"long_term",   "title":"<title>","description":"<desc>","impact":"medium","effort":"high"}}
  ],
  "final_verdict": "<2-3 sentences: assessment and single most important next step>"
}}"""

    client = _groq_client()
    resp = await client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": "You are a professional website auditor. Always respond with valid JSON only. No markdown, no explanation, no code fences."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.3,
        max_tokens=4000,
        response_format={"type": "json_object"},  # forces valid JSON output
    )
    text = resp.choices[0].message.content or "{}"
    return _extract_json(text)


async def run_audit(business_id: str, name: str, website: str) -> AuditResult:
    """Runs inside semaphore — only ONE audit at a time. Never raises."""
    async with _sem:
        try:
            ps = await get_pagespeed(website)
            try:
                analysis = await analyze(name, website, ps)
            except json.JSONDecodeError:
                # AI returned garbled JSON — wait briefly and retry once
                await asyncio.sleep(5)
                analysis = await analyze(name, website, ps)
            except Exception as e:
                if "429" in str(e) or "rate_limit" in str(e).lower():
                    await asyncio.sleep(12)  # wait and retry once
                    analysis = await analyze(name, website, ps)
                else:
                    raise

            s = analysis.get("scores", {})
            def clamp(v):
                try: return max(0, min(100, int(v)))
                except: return 50

            scores = AuditScores(
                seo=clamp(s.get("seo",50)), performance=clamp(s.get("performance",50)),
                mobile=clamp(s.get("mobile",50)), design=clamp(s.get("design",50)),
                ux=clamp(s.get("ux",50)), conversion=clamp(s.get("conversion",50)),
                overall=clamp(s.get("overall",50)),
            )
            recs = [AuditRecommendation(**r) for r in analysis.get("recommendations", [])]

            return AuditResult(
                business_id=business_id, name=name, website=website,
                scores=scores,
                lead_quality=analysis.get("lead_quality","Medium"),
                executive_summary=analysis.get("executive_summary",""),
                design_analysis=analysis.get("design_analysis",""),
                ux_analysis=analysis.get("ux_analysis",""),
                performance_analysis=analysis.get("performance_analysis",""),
                mobile_analysis=analysis.get("mobile_analysis",""),
                seo_analysis=analysis.get("seo_analysis",""),
                conversion_analysis=analysis.get("conversion_analysis",""),
                strengths=analysis.get("strengths",[]),
                weaknesses=analysis.get("weaknesses",[]),
                missing=analysis.get("missing",[]),
                recommendations=recs,
                final_verdict=analysis.get("final_verdict",""),
                status="done",
            )
        except json.JSONDecodeError:
            return _err(business_id, name, website, "AI returned invalid JSON. Retry.")
        except httpx.TimeoutException:
            return _err(business_id, name, website, "PageSpeed API timed out.")
        except Exception as e:
            return _err(business_id, name, website, str(e))


def _err(bid, name, website, msg) -> AuditResult:
    return AuditResult(business_id=bid, name=name, website=website,
                       scores=AuditScores(), status="error", error=msg)
