# Shared Expenses App
CSV-first shared expense platform with anomaly detection, audit trails, temporal membership rules, historical currency conversion, and explainable balances. Built on an append-only Event Sourcing architecture. Every state change is stored as an immutable event, allowing the complete audit trail to be replayed or projections rebuilt at any time.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | FastAPI |
| ORM | Prisma Client Python |
| Database | PostgreSQL 15 |
| Auth | JWT (python-jose) + bcrypt |
| File Storage | Local disk (CSV uploads) |
| Containerization | Docker + Docker Compose |

## AI Used
This project was built in collaboration with **Antigravity** using Claude Sonnet 4.6 (Thinking). See [AI_USAGE.md](./AI_USAGE.md) for details.

## Quick Start (Docker)

```bash
# 1. Clone the repository
git clone https://github.com/ajitashwath/shared-expense.git
cd shared-expense

# 2. Start all services
docker-compose up --build

# 3. The app is now running:
#    Frontend: http://localhost:3000
#    Backend API: http://localhost:8000
#    API Docs: http://localhost:8000/docs
```

The Docker setup automatically:
- Starts PostgreSQL
- Runs database migrations (`prisma db push`)
- Seeds the 6 flatmate users with correct membership timelines
- Starts the FastAPI backend
- Starts the Next.js frontend


## Local Development Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 15 running locally

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Mac/Linux

# Install dependencies
pip install -r requirements.txt

# Set up environment
copy .env.example .env
# Edit .env: set DATABASE_URL to your local PostgreSQL

# Generate Prisma client
prisma generate

# Push schema to database
prisma db push

# Seed the database
python seed.py

# Start the server
uvicorn app.main:app --reload --port 8000
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Set up environment
copy .env.local.example .env.local
# Edit NEXT_PUBLIC_API_URL=http://localhost:8000

# Start the dev server
npm run dev
```

---

## Default Users (After Seeding)
All users have password: `password123`

| Name | Email | Role | Joined | Left |
|------|-------|------|--------|------|
| Aisha | aisha@flat.com | **ADMIN** | Feb 1 | Active |
| Rohan | rohan@flat.com | MEMBER | Feb 1 | Active |
| Priya | priya@flat.com | MEMBER | Feb 1 | Active |
| Meera | meera@flat.com | MEMBER | Feb 1 | **Mar 31** |
| Sam | sam@flat.com | MEMBER | **Apr 15** | Active |
| Dev | dev@flat.com | MEMBER | May 1 | May 5 (Goa only) |

---

## Importing the CSV
1. Log in as Aisha (Admin)
2. Navigate to **Import** page
3. Upload `expenses_export.csv`
4. Click **Detect Anomalies** — the system will find 46 anomalies
5. Review each anomaly in the **Anomaly Review** page
6. For each anomaly: choose Approve / Reject / Merge / Override
7. Click **Commit Import** to generate events and update balances

---

## API Documentation
Interactive API docs available at `http://localhost:8000/docs` (Swagger UI)

### Key Endpoints

```
POST /auth/register        — Register user
POST /auth/login           — Get JWT token
GET  /auth/me              — Current user info

POST /groups/              — Create group
GET  /groups/              — List groups
POST /groups/{id}/members  — Add member
DELETE /groups/{id}/members/{uid} — Remove member
GET  /groups/{id}/membership-timeline

POST /expenses/            — Create expense (5 split types)
GET  /expenses/            — List expenses
GET  /expenses/{id}/events — Full event trail for expense

POST /settlements/         — Record payment
GET  /settlements/         — List settlements

POST /imports/upload       — Upload CSV
POST /imports/{id}/detect-anomalies  — Detect anomalies
GET  /imports/{id}/anomalies         — View anomalies
POST /imports/anomalies/{id}/resolve — Decide
POST /imports/{id}/commit            — Commit import

GET  /balances/group/{id}            — Group balance summary
GET  /balances/breakdown/{gid}/{uid} — Per-user traceable breakdown
POST /balances/rebuild/{id}          — Rebuild from events

GET  /audit/events         — Full event history
GET  /audit/dashboard-summary
```

---

## Architecture
```
CSV Upload
    ↓
RawImportRow table (stored as-is, never deleted)
    ↓
AnomalyDetector (12+ rule checks)
    ↓
Anomaly records + AnomalyDetected events
    ↓
User Review (Approve/Reject/Merge/Override)
    ↓
AnomalyResolved events
    ↓
Event Generation (ExpenseCreated, ExpenseSplitAssigned, etc.)
    ↓
Projection Updates (balances, expenses, import_reports)
    ↓
ImportCompleted event
```

### Event Store
The event store is an append-only PostgreSQL table. Every mutation generates at least one event. Projections (read models) can be rebuilt from events at any time using `POST /balances/rebuild/{group_id}`.

### Membership Policy

Groups support two policies:
- **STRICT** (default): Members outside their active period are excluded from expense splits. This is enforced during balance calculation.
- **INCLUSIVE**: Members can be manually included/overridden. Anomalies are still flagged but can be approved.

---

## Running Tests

```bash
cd backend

# Run all tests
pytest tests/ -v

# Run specific test files
pytest tests/test_anomaly_detector.py -v
pytest tests/test_splits.py -v
pytest tests/test_currency.py -v
```

---

## Project Structure

```
shared-expense/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app
│   │   ├── config.py        # Settings
│   │   ├── database.py      # Prisma connection
│   │   ├── auth/            # JWT auth
│   │   ├── events/          # Event store + types
│   │   ├── routers/         # API endpoints
│   │   └── services/        # Business logic
│   ├── prisma/schema.prisma # DB schema
│   ├── tests/               # Unit tests
│   └── seed.py              # Seed data
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js App Router pages
│   │   ├── components/      # UI components
│   │   └── lib/             # API client, types
│   └── Dockerfile
├── docker-compose.yml
├── expenses_export.csv      
├── SCOPE.md
├── DECISIONS.md
└── AI_USAGE.md
```
