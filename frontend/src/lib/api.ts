import { Business, AuditResult } from '@/types'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export async function searchBusinesses(
  keyword: string,
  maxResults = 200,
  callbacks: {
    onStatus:   (msg: string) => void
    onProgress: (scraped: number) => void
    onResults:  (list: Business[]) => void
    onError:    (msg: string) => void
  }
) {
  try {
    const resp = await fetch(`${API}/api/search/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword, max_results: maxResults }),
    })
    if (!resp.ok) {
      const e = await resp.json().catch(() => ({}))
      callbacks.onError(e.detail || `Server error ${resp.status}`)
      return
    }
    const reader  = resp.body?.getReader()
    const decoder = new TextDecoder()
    if (!reader) return
    let buf = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() || ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        try {
          const { event, data } = JSON.parse(line.slice(6))
          if (event === 'status')   callbacks.onStatus(data.message)
          if (event === 'progress') callbacks.onProgress(data.scraped || 0)
          if (event === 'results')  callbacks.onResults(data.businesses || [])
          if (event === 'error')    callbacks.onError(data.message)
        } catch {}
      }
    }
  } catch (e: unknown) {
    const err = e as Error
    callbacks.onError(
      err.message?.includes('fetch')
        ? 'Cannot reach backend. Is it running on port 8000?'
        : err.message
    )
  }
}

export async function auditWebsite(
  businessId: string, name: string, website: string
): Promise<AuditResult> {
  const resp = await fetch(`${API}/api/audit/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ business_id: businessId, name, website }),
  })
  if (!resp.ok) {
    const e = await resp.json().catch(() => ({}))
    throw new Error(e.detail || `Audit failed ${resp.status}`)
  }
  return resp.json()
}

export async function saveToSheets(businesses: Business[]) {
  const resp = await fetch(`${API}/api/sheets/append`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ businesses }),
  })
  if (!resp.ok) {
    const e = await resp.json().catch(() => ({}))
    return { success: false, error: e.detail || `Server error ${resp.status}` }
  }
  return resp.json()
}
