'use client'
import { useState, useRef, useCallback, memo, useMemo } from 'react'
import { Search, Globe, AlertCircle, CheckCircle, Download, ExternalLink, MapPin, Phone, Star, Zap, TrendingUp, Smartphone, Palette, Users, ShoppingCart, RefreshCw, Sheet, Eye } from 'lucide-react'
import { Business, AuditResult, TabKey } from '@/types'
import { searchBusinesses, auditWebsite, saveToSheets } from '@/lib/api'
import { generatePDF, viewPDF } from '@/lib/pdf'

interface Toast { id: number; message: string; type: 'success' | 'error' | 'info' }

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

function scoreColor(n: number) {
  if (n >= 75) return '#10b981'
  if (n >= 45) return '#f59e0b'
  return '#f87171'
}

function ScoreChip({ label, value }: { label: string; value: number }) {
  const color = scoreColor(value)
  return (
    <div style={{ borderColor: color + '44' }} className="flex flex-col items-center rounded-lg border px-2 py-1.5 gap-0.5 min-w-[52px]">
      <span style={{ color }} className="text-xs font-bold leading-none">{value}</span>
      <span className="text-[9px] font-medium uppercase tracking-wide" style={{ color: '#6666aa' }}>{label}</span>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border p-4 space-y-3 animate-fade-in" style={{ background: 'var(--surface-card)', borderColor: 'var(--surface-border)' }}>
      <div className="skeleton h-4 w-2/3" />
      <div className="skeleton h-3 w-1/2" />
      <div className="flex gap-2">
        {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-10 w-12 rounded-lg" />)}
      </div>
    </div>
  )
}

const BusinessCard = memo(function BusinessCard({ biz, audit, onAudit, onDownload, onViewPDF }: {
  biz: Business
  audit?: AuditResult
  onAudit: () => void
  onDownload: () => void
  onViewPDF: () => void
}) {
  const hasWebsite = !!biz.website
  const isAuditing = audit?.status === 'auditing'
  const isDone = audit?.status === 'done'
  const isError = audit?.status === 'error'

  return (
    <div className="rounded-xl border card-lift animate-slide-up overflow-hidden" style={{ background: 'var(--surface-card)', borderColor: 'var(--surface-border)' }}>
      {/* Priority stripe */}
      <div className="h-1" style={{ background: hasWebsite ? 'var(--brand-500)' : '#f87171' }} />
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{biz.name}</h3>
            {biz.category && <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{biz.category}</p>}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {biz.rating && (
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: '#f59e0b22', color: '#f59e0b' }}>
                <Star size={10} fill="#f59e0b" /> {biz.rating}
              </span>
            )}
            {hasWebsite
              ? <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--brand-500)22', color: 'var(--brand-400)' }}>Has Site</span>
              : <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#f8717122', color: '#f87171' }}>No Site</span>
            }
          </div>
        </div>

        {/* Details */}
        <div className="space-y-1">
          {biz.address && (
            <p className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <MapPin size={11} className="shrink-0" /> <span className="truncate">{biz.address}</span>
            </p>
          )}
          {biz.phone && (
            <p className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <Phone size={11} className="shrink-0" /> {biz.phone}
            </p>
          )}
          {biz.website && (
            <a href={biz.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs hover:underline" style={{ color: 'var(--brand-400)' }}>
              <Globe size={11} className="shrink-0" /> <span className="truncate">{biz.website.replace(/^https?:\/\//, '')}</span>
              <ExternalLink size={9} />
            </a>
          )}
          {biz.maps_url && (
            <a href={biz.maps_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs hover:underline" style={{ color: 'var(--text-muted)' }}>
              <MapPin size={11} /> View on Maps
            </a>
          )}
        </div>

        {/* Audit area */}
        {hasWebsite && (
          <div className="pt-2 border-t" style={{ borderColor: 'var(--surface-border)' }}>
            {isAuditing && (
              <div className="space-y-2">
                <p className="text-xs flex items-center gap-2" style={{ color: 'var(--brand-400)' }}>
                  <span className="inline-block w-3 h-3 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--brand-500)', borderTopColor: 'transparent' }} />
                  Auditing website…
                </p>
                <div className="flex gap-2">
                  {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-10 w-12 rounded-lg" />)}
                </div>
              </div>
            )}
            {isDone && audit && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold" style={{ color: scoreColor(audit.scores.overall) }}>
                    Overall: {audit.scores.overall}/100
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{
                      background: audit.lead_quality === 'Hot' ? '#f8717122' : audit.lead_quality === 'Medium' ? '#f59e0b22' : '#10b98122',
                      color: audit.lead_quality === 'Hot' ? '#f87171' : audit.lead_quality === 'Medium' ? '#f59e0b' : '#10b981',
                    }}>
                    {audit.lead_quality} Lead
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <ScoreChip label="SEO" value={audit.scores.seo} />
                  <ScoreChip label="Perf" value={audit.scores.performance} />
                  <ScoreChip label="Mobile" value={audit.scores.mobile} />
                  <ScoreChip label="Design" value={audit.scores.design} />
                  <ScoreChip label="UX" value={audit.scores.ux} />
                  <ScoreChip label="Conv" value={audit.scores.conversion} />
                </div>
                {audit.executive_summary && (
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{audit.executive_summary}</p>
                )}
                <button onClick={onViewPDF} className="btn-glow flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg font-medium w-full justify-center"
                  style={{ background: 'linear-gradient(135deg,#1e1b4b,#312e81)', color: '#a5b4fc', border: '1px solid #312e8188' }}>
                  <Eye size={12} /> View PDF Report
                </button>
                <button onClick={onDownload} className="btn-glow flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg font-medium w-full justify-center"
                  style={{ background: 'linear-gradient(135deg,var(--brand-600),var(--brand-500))', color: '#fff' }}>
                  <Download size={12} /> Download PDF Report
                </button>
              </div>
            )}
            {isError && (
              <div className="space-y-2">
                <p className="text-xs flex items-center gap-1.5" style={{ color: '#f87171' }}>
                  <AlertCircle size={12} /> {audit?.error || 'Audit failed'}
                </p>
                <button onClick={onAudit} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border"
                  style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>
                  <RefreshCw size={11} /> Retry Audit
                </button>
              </div>
            )}
            {!audit && (
              <button onClick={onAudit} className="btn-glow flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg font-medium border"
                style={{ borderColor: 'var(--brand-500)44', color: 'var(--brand-400)', background: 'var(--brand-500)11' }}>
                <Zap size={11} /> Run Audit
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}, (prev, next) => prev.biz === next.biz && prev.audit === next.audit && prev.onViewPDF === next.onViewPDF)

export default function HomePage() {
  const [keyword, setKeyword] = useState('')
  const [maxResults, setMaxResults] = useState(10)
  const [searching, setSearching] = useState(false)
  const [status, setStatus] = useState('')
  const [progress, setProgress] = useState(0)
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [audits, setAudits] = useState<Record<string, AuditResult>>({})
  const [tab, setTab] = useState<TabKey>('all')
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastId = useRef(0)
  const queueRef = useRef<Business[]>([])
  const processingRef = useRef(false)

  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = ++toastId.current
    setToasts(t => [...t, { id, message, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
  }, [])

  const processQueue = useCallback(async () => {
    if (processingRef.current) return
    processingRef.current = true
    while (queueRef.current.length > 0) {
      const biz = queueRef.current.shift()!
      if (!biz.website) continue
      setAudits(a => ({ ...a, [biz.id]: { ...({} as AuditResult), business_id: biz.id, name: biz.name, website: biz.website!, status: 'auditing', scores: { seo:0, performance:0, mobile:0, design:0, ux:0, conversion:0, overall:0 }, lead_quality:'', executive_summary:'', design_analysis:'', ux_analysis:'', performance_analysis:'', mobile_analysis:'', seo_analysis:'', conversion_analysis:'', strengths:[], weaknesses:[], missing:[], recommendations:[], final_verdict:'' } }))
      try {
        const result = await auditWebsite(biz.id, biz.name, biz.website!)
        setAudits(a => ({ ...a, [biz.id]: result }))
      } catch (e: unknown) {
        const err = e as Error
        setAudits(a => ({ ...a, [biz.id]: { ...a[biz.id], status: 'error', error: err.message } }))
      }
      if (queueRef.current.length > 0) await sleep(3000)
    }
    processingRef.current = false
  }, [])

  const handleSearch = async () => {
    if (!keyword.trim()) return
    setSearching(true)
    setStatus('')
    setProgress(0)
    setBusinesses([])
    setAudits({})
    queueRef.current = []
    processingRef.current = false
    setTab('all')

    await searchBusinesses(keyword, maxResults, {
      onStatus: msg => setStatus(msg),
      onProgress: n => setProgress(n),
      onResults: async list => {
        setBusinesses(list)
        setSearching(false)
        // Save to Sheets
        try {
          const r = await saveToSheets(list)
          if (r.success) addToast(`Saved to Google Sheets: ${r.added} added, ${r.skipped} skipped`, 'success')
          else addToast(`Sheets: ${r.error}`, 'error')
        } catch { addToast('Could not save to Sheets', 'error') }
        // Queue website businesses
        const withSite = list.filter(b => b.website)
        queueRef.current = [...withSite]
        processQueue()
      },
      onError: msg => {
        addToast(msg, 'error')
        setSearching(false)
      },
    })
  }

  const rerunAudit = async (biz: Business) => {
    if (!biz.website) return
    queueRef.current = [biz, ...queueRef.current]
    processQueue()
  }

  const filtered = useMemo(() => businesses.filter(b => {
    if (tab === 'no-website') return !b.website
    if (tab === 'has-website') return !!b.website
    if (tab === 'audited') return audits[b.id]?.status === 'done'
    return true
  }), [businesses, tab, audits])

  const counts = useMemo(() => ({
    all: businesses.length,
    'no-website': businesses.filter(b => !b.website).length,
    'has-website': businesses.filter(b => !!b.website).length,
    audited: Object.values(audits).filter(a => a.status === 'done').length,
  }), [businesses, audits])

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'all',         label: 'All Leads',     icon: <Users size={13} /> },
    { key: 'no-website',  label: 'No Website',    icon: <AlertCircle size={13} /> },
    { key: 'has-website', label: 'Has Website',   icon: <Globe size={13} /> },
    { key: 'audited',     label: 'Audited',        icon: <CheckCircle size={13} /> },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-bg)' }}>
      {/* ── Toasts ── */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map(t => (
          <div key={t.id} className="toast-enter glass rounded-xl px-4 py-3 flex items-center gap-3 shadow-xl max-w-xs" style={{ borderColor: t.type === 'success' ? '#10b98133' : t.type === 'error' ? '#f8717133' : 'var(--surface-border)' }}>
            {t.type === 'success' && <CheckCircle size={16} color="#10b981" />}
            {t.type === 'error' && <AlertCircle size={16} color="#f87171" />}
            {t.type === 'info' && <Zap size={16} color="var(--brand-400)" />}
            <p className="text-xs" style={{ color: 'var(--text-primary)' }}>{t.message}</p>
          </div>
        ))}
      </div>

      {/* ── Header ── */}
      <header className="border-b" style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-card)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,var(--brand-600),var(--brand-500))' }}>
              <TrendingUp size={18} color="#fff" />
            </div>
            <div>
              <h1 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>LeadAudit <span style={{ color: 'var(--brand-400)' }}>Pro</span></h1>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>AI-powered lead generation & website auditing</p>
            </div>
          </div>
          {/* <div className="hidden sm:flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span className="flex items-center gap-1.5"><Zap size={11} color="var(--brand-400)" /> Groq AI</span>
            <span className="flex items-center gap-1.5"><Smartphone size={11} color="var(--brand-400)" /> PageSpeed</span>
            <span className="flex items-center gap-1.5"><Sheet size={11} color="var(--brand-400)" /> Sheets</span>
          </div> */}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* ── Search Box ── */}
        <div className="glass rounded-2xl p-6 space-y-4">
          <div>
            <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Find Your Next Clients</h2>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Search Google Maps for businesses, auto-audit their websites, and generate lead reports.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
              <input
                id="search-input"
                type="text"
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !searching && handleSearch()}
                placeholder='e.g. "clinics in Kerala" or "restaurants in Mumbai"'
                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition-all"
                style={{ background: 'var(--surface-elevated)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }}
              />
            </div>
            <select
              id="max-results-select"
              value={maxResults}
              onChange={e => setMaxResults(Number(e.target.value))}
              className="px-4 py-3 rounded-xl text-sm outline-none"
              style={{ background: 'var(--surface-elevated)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }}
            >
              <option value={10}>10 results</option>
              <option value={25}>25 results</option>
              {/* <option value={50}>50 results</option> */}
              {/* <option value={100}>100 results</option> */}
              {/* <option value={150}>150 results</option> */}
              {/* <option value={200}>200 results</option> */}
              {/* <option value={250}>250 results</option> */}
              {/* <option value={500}>500 results</option> */}
            </select>
            <button
              id="search-btn"
              onClick={handleSearch}
              disabled={searching || !keyword.trim()}
              className="btn-glow w-full sm:w-auto px-6 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg,var(--brand-600),var(--brand-500))', color: '#fff', minWidth: 120 }}
            >
              {searching ? (
                <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Searching…</>
              ) : (
                <><Search size={15} /> Search</>
              )}
            </button>
          </div>

          {/* Progress */}
          {searching && (
            <div className="space-y-2 animate-fade-in">
              <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
                <span>{status || 'Initializing…'}</span>
                {progress > 0 && <span>{progress} businesses found</span>}
              </div>
              <div className="w-full rounded-full overflow-hidden" style={{ background: 'var(--surface-elevated)', height: 3 }}>
                <div className="progress-bar" style={{ width: progress > 0 ? `${Math.min(100, (progress / maxResults) * 100)}%` : '30%' }} />
              </div>
            </div>
          )}
        </div>

        {/* ── Stats ── */}
        {businesses.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-fade-in">
            {[
              { label: 'Total Leads', value: counts.all, icon: <Users size={18} />, color: 'var(--brand-400)' },
              { label: 'No Website', value: counts['no-website'], icon: <AlertCircle size={18} />, color: '#f87171' },
              { label: 'Has Website', value: counts['has-website'], icon: <Globe size={18} />, color: 'var(--brand-400)' },
              { label: 'Audited', value: counts.audited, icon: <CheckCircle size={18} />, color: '#10b981' },
            ].map(s => (
              <div key={s.label} className="glass rounded-xl p-4 flex items-center gap-3">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: s.color + '22', color: s.color }}>
                  {s.icon}
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{s.value}</div>
                  <div className="text-[10px] sm:text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Tabs + Grid ── */}
        {businesses.length > 0 && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex gap-0 border-b overflow-x-auto hide-scrollbar" style={{ borderColor: 'var(--surface-border)' }}>
              {tabs.map(t => (
                <button
                  key={t.key}
                  id={`tab-${t.key}`}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center whitespace-nowrap gap-2 px-4 py-3 text-sm font-medium transition-colors ${tab === t.key ? 'tab-active' : 'tab-inactive'}`}
                >
                  {t.icon} {t.label}
                  <span className="px-1.5 py-0.5 rounded-full text-xs" style={{ background: 'var(--surface-elevated)', color: 'var(--text-muted)' }}>
                    {counts[t.key]}
                  </span>
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
                <Globe size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No results in this tab</p>
              </div>
            ) : (
              <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
                {filtered.map(biz => (
                  <BusinessCard
                    key={biz.id}
                    biz={biz}
                    audit={audits[biz.id]}
                    onAudit={() => rerunAudit(biz)}
                    onDownload={() => {
                      const a = audits[biz.id]
                      if (a?.status === 'done') generatePDF(biz, a)
                    }}
                    onViewPDF={() => {
                      const a = audits[biz.id]
                      if (a?.status === 'done') viewPDF(biz, a)
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Empty state ── */}
        {!searching && businesses.length === 0 && (
          <div className="text-center py-24 animate-fade-in">
            <div className="w-20 h-20 rounded-2xl mx-auto mb-6 flex items-center justify-center" style={{ background: 'var(--surface-card)', border: '1px solid var(--surface-border)' }}>
              <Search size={32} style={{ color: 'var(--brand-500)' }} />
            </div>
            <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Search for Leads</h2>
            <p className="text-sm max-w-md mx-auto" style={{ color: 'var(--text-secondary)' }}>
              Enter a keyword like <span style={{ color: 'var(--brand-400)' }}>"dental clinics in Kerala"</span> to scrape Google Maps, auto-audit websites, and generate premium reports.
            </p>
            <div className="flex flex-wrap justify-center gap-4 sm:gap-6 mt-8 text-xs" style={{ color: 'var(--text-muted)' }}>
              {[
                { icon: <MapPin size={14} />, label: 'Google Maps Scraping' },
                { icon: <Palette size={14} />, label: 'AI Website Auditing' },
                { icon: <ShoppingCart size={14} />, label: 'PDF Lead Reports' },
              ].map(f => (
                <div key={f.label} className="flex items-center gap-2">
                  <span style={{ color: 'var(--brand-400)' }}>{f.icon}</span> {f.label}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
