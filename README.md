# RetailCRM to Supabase Analytics Platform

A real-time analytics dashboard that synchronizes order data from RetailCRM to a Supabase database and visualizes performance metrics through a React-based interface.

## Overview

This project consists of two main components:
1.  **Data Synchronization Engine:** A Python-based service that pulls order information from RetailCRM and pushes it to Supabase for persistent storage and fast querying.
2.  **Analytics Dashboard:** A modern, premium React dashboard (Vite + Tailwind CSS) that visualizes revenue, order volume, and performance metrics in real-time.

## Tech Stack

- **Backend:** Python, Supabase Python Client, RetailCRM Client
- **Frontend:** React, TypeScript, Vite, Tailwind CSS, Recharts, Lucide React
- **Database:** Supabase (PostgreSQL)

## Project Structure

```text
.
├── dashboard/              # React Analytics Dashboard
│   ├── src/                # Frontend source code
│   └── .env.example        # Dashboard environment template
├── load.py                 # Synchronization script (RetailCRM -> Supabase)
├── order_ingestion.py      # Script to populate RetailCRM (Mock data)
├── mock_orders.json        # Source data for ingestion
├── .env.example            # Root environment template
└── .gitignore              # Project-wide ignore rules
```

## Setup Instructions

### 1. Prerequisites
- Python 3.8+
- Node.js 18+
- Supabase Account & Project
- RetailCRM Account & API Key

### 2. Environment Configuration
Copy the example environment files and fill in your credentials:

**Root directory:**
```bash
cp .env.example .env
```

**Dashboard directory:**
```bash
cp dashboard/.env.example dashboard/.env
```

### 3. Backend Setup
```bash
# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate  # Linux/macOS

# Install dependencies
pip install -r requirements.txt  # If requirements.txt exists, or install manually:
pip install python-dotenv retailcrm supabase
```

### 4. Dashboard Setup
```bash
cd dashboard
npm install
npm run dev
```

## Usage

1.  **Ingest Mock Data:** Run `python3 order_ingestion.py` to push data from `mock_orders.json` to your RetailCRM instance.
2.  **Sync Data:** Run `python3 load.py` to synchronize orders from RetailCRM to your Supabase project.
3.  **View Dashboard:** Navigate to the dev server URL (typically `http://localhost:5173`) to view the real-time analytics.

## Security

Sensitive information like API keys and database credentials should never be committed. Ensure that your `.env` files are ignored by Git (already configured in `.gitignore`).
