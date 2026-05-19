import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'LeadAudit Pro — AI-Powered Lead Generation & Website Auditing',
  description:
    'Scrape Google Maps leads, auto-audit websites with AI, and generate premium SiteScope-style reports. Powered by Apify, PageSpeed, and Groq.',
  keywords: 'lead generation, website audit, SEO, Google Maps scraper, AI audit',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  )
}
