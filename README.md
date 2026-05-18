# Goal Setting & Tracking Portal

A robust, enterprise-ready platform designed for managing team and individual objectives across an organization. It allows employees to create, track, and update their goals while enabling managers and administrators to review, approve, and oversee progress.

## Architecture

The application is built using a modern, scalable stack:

- **Frontend:** Next.js, React, TailwindCSS
- **Backend:** Python, FastAPI, SQLAlchemy (Async)
- **Database:** PostgreSQL
- **Assistant:** AI-powered and deterministic natural language assistant for quickly creating goals and logging check-ins.

![System architecture flow diagram for the Goal Setting and Tracking Portal on a light gray background. At the top, User connects downward to Next.js Frontend with the label Interacts with UI. From Next.js Frontend, one arrow labeled REST API Calls goes to FastAPI Backend on the right, and a dotted connector leads into a large Frontend Layer box on the left. Inside Frontend Layer are three modules: Auth Context, Dashboard and Workflows, and Chat Assistant UI. FastAPI Backend connects by a dotted arrow into a large Backend Layer box below and to the right. Inside Backend Layer are API Endpoints v1, Goal and Tracking Services, and AI slash Deterministic Parser. A downward arrow labeled asyncpg connects Backend Layer to a cylindrical PostgreSQL Database at the bottom. The visual tone is structured, technical, and orderly, emphasizing clear separation between frontend, backend, and database components and the flow of user interaction and API communication.](<User Input to Citation-2026-05-18-185318.png>)

## Features

- **Goal Governance:** Cycle-based planning and tracking windows.
- **Role-Based Workflows:** Distinct permissions and views for Employees, Managers, and Admins.
- **Goal Approval Lifecycle:** Draft -> Submitted (Pending Approval) -> Approved or Returned.
- **Tracking & Analytics:** Log check-ins across quarters and track progress through weighted score calculations.
- **Chat Assistant:** Quickly log check-ins, create goals, and query policy windows using conversational prompts.

## Demo Accounts

The database comes pre-seeded with synthetic data and a set of demo accounts to test out different roles and capabilities.

**Universal Password:** `password123`

### 1. Administrative Controls

- **Email:** `admin@company.com`
- **Role:** Admin
- **Features:** Full access to Goal Cycles, tracking windows, overall organization analytics, and approvals.

### 2. Manager Workflows

- **Email:** `manager@company.com`
- **Role:** Manager
- **Features:** Reviews goal submissions from employees, approves or returns objectives with feedback, tracks team performance.

### 3. Employee Workflows

- **Emails:** `demo1@company.com`, `demo2@company.com`, `demo3@company.com`, `demo4@company.com`, `demo5@company.com`
- **Role:** Employee
- **Features:** Defines personal goals, manages weightages, logs quarterly progress check-ins, and tracks feedback.

## Getting Started

### Prerequisites

- Node.js
- Python 3.10+
- PostgreSQL

### Setup

1. **Database:** Ensure PostgreSQL is running and update the `DATABASE_URL` in `backend/.env`.
2. **Backend:**
   ```bash
   cd backend
   pip install -r requirements.txt
   alembic upgrade head
   python -m scripts.seed_db
   uvicorn app.main:app --reload --port 8000
   ```
3. **Frontend:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
4. Access the portal at `http://localhost:3000`.
