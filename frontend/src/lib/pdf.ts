import { Business, AuditResult, AuditRecommendation } from '@/types'

export async function generatePDF(biz: Business, audit: AuditResult) {
  try {
    const jsPDFModule = await import('jspdf')
    const JsPDFClass = jsPDFModule.jsPDF || jsPDFModule.default
    const doc = new (JsPDFClass as any)({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const W = 210, M = 18
  let y = 0

  const C = {
    dark:  [15,15,25]    as [number,number,number],
    acc:   [124,92,252]  as [number,number,number],
    green: [16,185,129]  as [number,number,number],
    amber: [245,158,11]  as [number,number,number],
    red:   [248,113,113] as [number,number,number],
    white: [255,255,255] as [number,number,number],
    gray:  [110,108,140] as [number,number,number],
    lg:    [235,235,245] as [number,number,number],
  }
  const sc  = (n: number): [number,number,number] => n >= 75 ? C.green : n >= 45 ? C.amber : C.red
  const lqC = (q: string): [number,number,number] => q === 'Hot' ? C.red : q === 'Medium' ? C.amber : C.green

  // ── Header ──────────────────────────────────────────────────────────────────
  doc.setFillColor(...C.dark); doc.rect(0, 0, W, 42, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(22)
  doc.setTextColor(...C.white); doc.text('SITESCOPE', M, 16)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  doc.setTextColor(...C.acc); doc.text(biz.website || '', M, 25)
  doc.setTextColor(160, 160, 185); doc.setFontSize(8)
  doc.text(
    `Analyzed: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    M, 33
  )

  const cx = W - 28, cy = 21
  doc.setFillColor(...sc(audit.scores.overall)); doc.circle(cx, cy, 14, 'F')
  doc.setTextColor(...C.white); doc.setFont('helvetica', 'bold'); doc.setFontSize(17)
  doc.text(String(audit.scores.overall), cx, cy + 3, { align: 'center' })
  doc.setFontSize(6); doc.setFont('helvetica', 'normal')
  doc.text('/ 100', cx, cy + 9, { align: 'center' })

  y = 52

  // ── Executive Summary ────────────────────────────────────────────────────────
  doc.setTextColor(...C.dark); doc.setFont('helvetica', 'bold'); doc.setFontSize(13)
  doc.text('Executive Summary', M, y); y += 8
  doc.setFillColor(...lqC(audit.lead_quality))
  doc.roundedRect(M, y - 5, 52, 9, 2, 2, 'F')
  doc.setTextColor(...C.white); doc.setFontSize(8)
  doc.text(`${audit.lead_quality} Lead Opportunity`, M + 4, y + 1); y += 10
  doc.setTextColor(...C.gray); doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  const sumLines = doc.splitTextToSize(audit.executive_summary, W - M * 2)
  doc.text(sumLines, M, y); y += sumLines.length * 5 + 10

  // ── Score Chips ──────────────────────────────────────────────────────────────
  const chips = [
    { l: 'DESIGN',      v: audit.scores.design },
    { l: 'UX',          v: audit.scores.ux },
    { l: 'PERFORMANCE', v: audit.scores.performance },
    { l: 'MOBILE',      v: audit.scores.mobile },
    { l: 'SEO',         v: audit.scores.seo },
    { l: 'CONVERSION',  v: audit.scores.conversion },
  ]
  const cw = (W - M * 2 - 10) / 6
  chips.forEach(({ l, v }, i) => {
    const x = M + i * (cw + 2)
    doc.setFillColor(...C.lg); doc.roundedRect(x, y, cw, 22, 2, 2, 'F')
    doc.setFillColor(...sc(v)); doc.roundedRect(x, y, cw, 8, 2, 2, 'F')
    doc.setTextColor(...C.white); doc.setFontSize(6); doc.setFont('helvetica', 'bold')
    doc.text(l, x + cw / 2, y + 5, { align: 'center' })
    doc.setTextColor(...sc(v)); doc.setFontSize(14)
    doc.text(String(v), x + cw / 2, y + 18, { align: 'center' })
  }); y += 30

  // ── Section Helper ───────────────────────────────────────────────────────────
  const section = (score: number, title: string, body: string) => {
    if (y > 252) { doc.addPage(); y = 18 }
    doc.setFillColor(...sc(score)); doc.rect(M, y, 3, 13, 'F')
    doc.setTextColor(...C.dark); doc.setFont('helvetica', 'bold'); doc.setFontSize(11)
    doc.text(`${title}  ${score}/100`, M + 6, y + 9); y += 16
    doc.setTextColor(...C.gray); doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
    const lines = doc.splitTextToSize(body, W - M * 2)
    doc.text(lines, M, y); y += lines.length * 4.5 + 8
  }

  section(audit.scores.design,      'Design & Visual Quality',  audit.design_analysis)
  section(audit.scores.ux,          'User Experience',           audit.ux_analysis)
  section(audit.scores.performance, 'Performance Analysis',      audit.performance_analysis)
  section(audit.scores.mobile,      'Mobile Responsiveness',     audit.mobile_analysis)
  section(audit.scores.seo,         'SEO Analysis',              audit.seo_analysis)
  section(audit.scores.conversion,  'Conversion Readiness',      audit.conversion_analysis)

  // ── Strengths / Weaknesses ───────────────────────────────────────────────────
  if (y > 230) { doc.addPage(); y = 18 }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...C.dark)
  doc.text('STRENGTHS', M, y); doc.text('WEAKNESSES', W / 2 + 2, y); y += 6
  const mxSW = Math.max(audit.strengths.length, audit.weaknesses.length)
  for (let i = 0; i < mxSW; i++) {
    if (y > 272) { doc.addPage(); y = 18 }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
    if (audit.strengths[i]) {
      doc.setTextColor(...C.green)
      doc.text(`+ ${audit.strengths[i]}`, M, y, { maxWidth: W / 2 - M - 2 })
    }
    if (audit.weaknesses[i]) {
      doc.setTextColor(...C.red)
      doc.text(`✗ ${audit.weaknesses[i]}`, W / 2 + 2, y, { maxWidth: W / 2 - M - 2 })
    }
    y += 7
  }; y += 4

  // ── Recommendations ──────────────────────────────────────────────────────────
  if (y > 230) { doc.addPage(); y = 18 }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...C.dark)
  doc.text('Recommendations', M, y); y += 8

  const grps: Record<string, { label: string; color: [number,number,number] }> = {
    quick_win:   { label: 'Quick Wins',  color: C.green },
    high_impact: { label: 'High Impact', color: C.acc },
    long_term:   { label: 'Long Term',   color: C.amber },
  }
  const grouped: Record<string, AuditRecommendation[]> = {
    quick_win: [], high_impact: [], long_term: [],
  }
  audit.recommendations.forEach(r => { if (grouped[r.type]) grouped[r.type].push(r) })

  for (const [key, recs] of Object.entries(grouped)) {
    if (!recs.length) continue
    if (y > 252) { doc.addPage(); y = 18 }
    const { label, color } = grps[key]
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...color)
    doc.text(label, M, y); y += 7
    recs.forEach(r => {
      if (y > 265) { doc.addPage(); y = 18 }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...C.dark)
      doc.text(r.title, M + 4, y); y += 5
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...C.gray)
      const dl = doc.splitTextToSize(
        `${r.description} [Impact: ${r.impact} · Effort: ${r.effort}]`,
        W - M * 2 - 4
      )
      doc.text(dl, M + 4, y); y += dl.length * 4 + 4
    }); y += 2
  }

  // ── Final Verdict ────────────────────────────────────────────────────────────
  if (y > 242) { doc.addPage(); y = 18 }
  doc.setFillColor(...C.dark); doc.roundedRect(M, y, W - M * 2, 32, 3, 3, 'F')
  doc.setTextColor(...C.white); doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
  doc.text('Final Verdict', M + 6, y + 9)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(200, 200, 220)
  const vl = doc.splitTextToSize(audit.final_verdict, W - M * 2 - 10)
  doc.text(vl, M + 6, y + 17)

  // ── Footer on every page ─────────────────────────────────────────────────────
  const total = (doc as unknown as { internal: { getNumberOfPages: () => number } })
    .internal.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    doc.setPage(p); doc.setFontSize(7); doc.setTextColor(...C.gray)
    doc.text(`SiteScope — Website Analyzer    ${biz.website || ''}`, M, 292)
    doc.text(`Page ${p} of ${total}`, W - M, 292, { align: 'right' })
  }

  doc.save(`sitescope-${(biz.name || 'report').replace(/\s+/g, '-').toLowerCase()}.pdf`)
  } catch (error) {
    console.error('Error generating PDF:', error)
    alert('Failed to generate PDF report.')
  }
}

export async function viewPDF(biz: Business, audit: AuditResult) {
  try {
    const jsPDFModule = await import('jspdf')
    const JsPDFClass = jsPDFModule.jsPDF || jsPDFModule.default
    const doc = new (JsPDFClass as any)({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const W = 210, M = 18
  let y = 0

  const C = {
    dark:  [15,15,25]    as [number,number,number],
    acc:   [124,92,252]  as [number,number,number],
    green: [16,185,129]  as [number,number,number],
    amber: [245,158,11]  as [number,number,number],
    red:   [248,113,113] as [number,number,number],
    white: [255,255,255] as [number,number,number],
    gray:  [110,108,140] as [number,number,number],
    lg:    [235,235,245] as [number,number,number],
  }
  const sc  = (n: number): [number,number,number] => n >= 75 ? C.green : n >= 45 ? C.amber : C.red
  const lqC = (q: string): [number,number,number] => q === 'Hot' ? C.red : q === 'Medium' ? C.amber : C.green

  doc.setFillColor(...C.dark); doc.rect(0, 0, W, 42, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(22)
  doc.setTextColor(...C.white); doc.text('SITESCOPE', M, 16)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  doc.setTextColor(...C.acc); doc.text(biz.website || '', M, 25)
  doc.setTextColor(160, 160, 185); doc.setFontSize(8)
  doc.text(
    `Analyzed: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    M, 33
  )

  const cx = W - 28, cy = 21
  doc.setFillColor(...sc(audit.scores.overall)); doc.circle(cx, cy, 14, 'F')
  doc.setTextColor(...C.white); doc.setFont('helvetica', 'bold'); doc.setFontSize(17)
  doc.text(String(audit.scores.overall), cx, cy + 3, { align: 'center' })
  doc.setFontSize(6); doc.setFont('helvetica', 'normal')
  doc.text('/ 100', cx, cy + 9, { align: 'center' })

  y = 52

  doc.setTextColor(...C.dark); doc.setFont('helvetica', 'bold'); doc.setFontSize(13)
  doc.text('Executive Summary', M, y); y += 8
  doc.setFillColor(...lqC(audit.lead_quality))
  doc.roundedRect(M, y - 5, 52, 9, 2, 2, 'F')
  doc.setTextColor(...C.white); doc.setFontSize(8)
  doc.text(`${audit.lead_quality} Lead Opportunity`, M + 4, y + 1); y += 10
  doc.setTextColor(...C.gray); doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  const sumLines = doc.splitTextToSize(audit.executive_summary, W - M * 2)
  doc.text(sumLines, M, y); y += sumLines.length * 5 + 10

  const chips = [
    { l: 'DESIGN',      v: audit.scores.design },
    { l: 'UX',          v: audit.scores.ux },
    { l: 'PERFORMANCE', v: audit.scores.performance },
    { l: 'MOBILE',      v: audit.scores.mobile },
    { l: 'SEO',         v: audit.scores.seo },
    { l: 'CONVERSION',  v: audit.scores.conversion },
  ]
  const cw = (W - M * 2 - 10) / 6
  chips.forEach(({ l, v }, i) => {
    const x = M + i * (cw + 2)
    doc.setFillColor(...C.lg); doc.roundedRect(x, y, cw, 22, 2, 2, 'F')
    doc.setFillColor(...sc(v)); doc.roundedRect(x, y, cw, 8, 2, 2, 'F')
    doc.setTextColor(...C.white); doc.setFontSize(6); doc.setFont('helvetica', 'bold')
    doc.text(l, x + cw / 2, y + 5, { align: 'center' })
    doc.setTextColor(...sc(v)); doc.setFontSize(14)
    doc.text(String(v), x + cw / 2, y + 18, { align: 'center' })
  }); y += 30

  const section = (score: number, title: string, body: string) => {
    if (y > 252) { doc.addPage(); y = 18 }
    doc.setFillColor(...sc(score)); doc.rect(M, y, 3, 13, 'F')
    doc.setTextColor(...C.dark); doc.setFont('helvetica', 'bold'); doc.setFontSize(11)
    doc.text(`${title}  ${score}/100`, M + 6, y + 9); y += 16
    doc.setTextColor(...C.gray); doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
    const lines = doc.splitTextToSize(body, W - M * 2)
    doc.text(lines, M, y); y += lines.length * 4.5 + 8
  }

  section(audit.scores.design,      'Design & Visual Quality',  audit.design_analysis)
  section(audit.scores.ux,          'User Experience',           audit.ux_analysis)
  section(audit.scores.performance, 'Performance Analysis',      audit.performance_analysis)
  section(audit.scores.mobile,      'Mobile Responsiveness',     audit.mobile_analysis)
  section(audit.scores.seo,         'SEO Analysis',              audit.seo_analysis)
  section(audit.scores.conversion,  'Conversion Readiness',      audit.conversion_analysis)

  if (y > 230) { doc.addPage(); y = 18 }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...C.dark)
  doc.text('STRENGTHS', M, y); doc.text('WEAKNESSES', W / 2 + 2, y); y += 6
  const mxSW = Math.max(audit.strengths.length, audit.weaknesses.length)
  for (let i = 0; i < mxSW; i++) {
    if (y > 272) { doc.addPage(); y = 18 }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
    if (audit.strengths[i]) {
      doc.setTextColor(...C.green)
      doc.text(`+ ${audit.strengths[i]}`, M, y, { maxWidth: W / 2 - M - 2 })
    }
    if (audit.weaknesses[i]) {
      doc.setTextColor(...C.red)
      doc.text(`✗ ${audit.weaknesses[i]}`, W / 2 + 2, y, { maxWidth: W / 2 - M - 2 })
    }
    y += 7
  }; y += 4

  if (y > 230) { doc.addPage(); y = 18 }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...C.dark)
  doc.text('Recommendations', M, y); y += 8

  const grps: Record<string, { label: string; color: [number,number,number] }> = {
    quick_win:   { label: 'Quick Wins',  color: C.green },
    high_impact: { label: 'High Impact', color: C.acc },
    long_term:   { label: 'Long Term',   color: C.amber },
  }
  const grouped: Record<string, AuditRecommendation[]> = {
    quick_win: [], high_impact: [], long_term: [],
  }
  audit.recommendations.forEach(r => { if (grouped[r.type]) grouped[r.type].push(r) })

  for (const [key, recs] of Object.entries(grouped)) {
    if (!recs.length) continue
    if (y > 252) { doc.addPage(); y = 18 }
    const { label, color } = grps[key]
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...color)
    doc.text(label, M, y); y += 7
    recs.forEach(r => {
      if (y > 265) { doc.addPage(); y = 18 }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...C.dark)
      doc.text(r.title, M + 4, y); y += 5
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...C.gray)
      const dl = doc.splitTextToSize(
        `${r.description} [Impact: ${r.impact} · Effort: ${r.effort}]`,
        W - M * 2 - 4
      )
      doc.text(dl, M + 4, y); y += dl.length * 4 + 4
    }); y += 2
  }

  if (y > 242) { doc.addPage(); y = 18 }
  doc.setFillColor(...C.dark); doc.roundedRect(M, y, W - M * 2, 32, 3, 3, 'F')
  doc.setTextColor(...C.white); doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
  doc.text('Final Verdict', M + 6, y + 9)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(200, 200, 220)
  const vl = doc.splitTextToSize(audit.final_verdict, W - M * 2 - 10)
  doc.text(vl, M + 6, y + 17)

  const total = (doc as unknown as { internal: { getNumberOfPages: () => number } })
    .internal.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    doc.setPage(p); doc.setFontSize(7); doc.setTextColor(...C.gray)
    doc.text(`SiteScope — Website Analyzer    ${biz.website || ''}`, M, 292)
    doc.text(`Page ${p} of ${total}`, W - M, 292, { align: 'right' })
  }

  const blobUrl = doc.output('bloburl')
  window.open(blobUrl as unknown as string, '_blank')
  } catch (error) {
    console.error('Error generating PDF preview:', error)
    alert('Failed to open PDF preview.')
  }
}
