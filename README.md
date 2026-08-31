# LeadAudit Pro

LeadAudit Pro is a full-stack AI-powered lead generation and website auditing application. It provides advanced website analysis, combining web scraping, artificial intelligence, and performance metrics to generate comprehensive audit reports and capture valuable leads.

## 🚀 Live Demo

**Live Application:** https://leadaudit-pro.vercel.app

## Key Features

- **AI-Powered Analysis**: Utilizes Groq-based AI analysis for in-depth insights.
- **Web Scraping**: Integrates Apify for robust website data extraction.
- **Performance Metrics**: Implements an audit queue to handle PageSpeed API rate limits and gather accurate performance data.
- **Real-Time Updates**: Features real-time Server-Sent Events (SSE) streaming for search progress and audit status.
- **Lead Storage**: Seamlessly integrates with Google Sheets to store and manage captured leads.
- **Premium Reports**: Generates downloadable, premium PDF audit reports dynamically using jsPDF.

## Tech Stack

### Frontend
- **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
- **Library**: [React](https://reactjs.org/) (v18)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **PDF Generation**: [jsPDF](https://github.com/parallax/jsPDF)

### Backend
- **Framework**: [FastAPI](https://fastapi.tiangolo.com/)
- **Server**: [Uvicorn](https://www.uvicorn.org/)
- **AI Integration**: [Groq](https://groq.com/)
- **Web Scraping**: [Apify](https://apify.com/)
- **Database/Storage**: Google Sheets API
- **Authentication/Integrations**: Google Auth, Google PageSpeed Insights API

## Setup Instructions

### Prerequisites

Ensure you have the following installed on your machine:
- [Node.js](https://nodejs.org/) (v18+)
- [Python](https://www.python.org/) (v3.9+)
- npm or yarn

### 1. Clone the repository

```bash
git clone <your-repository-url>
cd Lead_Audit
```

### 2. Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Set up environment variables:
   - Copy the `.env.example` file to `.env`:
     ```bash
     cp .env.example .env
     ```
   - Open `.env` and fill in your actual API keys and credentials:
     - `APIFY_API_KEY`: Your Apify API Key
     - `GROQ_API_KEY`: Your Groq API Key
     - `PAGESPEED_API_KEY`: Your Google PageSpeed API Key
     - `GOOGLE_SHEETS_ID`: The ID of your Google Sheet for storing leads
     - `GOOGLE_SERVICE_ACCOUNT_JSON`: Your Google Service Account JSON string for authentication
     - `FRONTEND_URL`: Usually `http://localhost:3000` for local development

5. Start the backend server:
   ```bash
   uvicorn main:app --reload
   # Or using python main.py if configured
   ```
   The backend should now be running at `http://localhost:8000`.

### 3. Frontend Setup

1. Open a new terminal and navigate to the frontend directory from the project root:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   - Copy `.env.local.example` to `.env.local`:
     ```bash
     cp .env.local.example .env.local
     ```
   - Ensure the API URL is correct:
     - `NEXT_PUBLIC_API_URL=http://localhost:8000`

4. Start the frontend development server:
   ```bash
   npm run dev
   ```
   The frontend should now be running at `http://localhost:3000`.

## Usage

1. Open your browser and navigate to `http://localhost:3000`.
2. Enter a website URL to begin the auditing process.
3. The application will scrape the site, analyze it using AI, and fetch PageSpeed metrics.
4. Progress will be streamed in real-time.
5. Once complete, you can view the detailed audit and generate a PDF report. Captured leads will be automatically sent to the configured Google Sheet.

