export interface Business {
  id: string
  name: string
  category: string
  address: string
  phone: string
  rating: string
  website: string | null
  maps_url: string
  city: string
  priority: string
}

export interface AuditScores {
  seo: number
  performance: number
  mobile: number
  design: number
  ux: number
  conversion: number
  overall: number
}

export interface AuditRecommendation {
  type: 'quick_win' | 'high_impact' | 'long_term'
  title: string
  description: string
  impact: string
  effort: string
}

export interface AuditResult {
  business_id: string
  name: string
  website: string
  scores: AuditScores
  lead_quality: string
  executive_summary: string
  design_analysis: string
  ux_analysis: string
  performance_analysis: string
  mobile_analysis: string
  seo_analysis: string
  conversion_analysis: string
  strengths: string[]
  weaknesses: string[]
  missing: string[]
  recommendations: AuditRecommendation[]
  final_verdict: string
  status: 'done' | 'error' | 'auditing' | 'pending'
  error?: string
}

export type TabKey = 'all' | 'no-website' | 'has-website' | 'audited'
