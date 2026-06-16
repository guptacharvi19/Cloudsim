# ☁️ CloudSim Platform

A browser-based Cloud Computing Simulation Platform inspired by AWS/Azure/OpenStack — built for education and research.

![CloudSim Dashboard](https://img.shields.io/badge/status-active-22c55e?style=flat-square)
![Python](https://img.shields.io/badge/Python-3.11-0ea5e9?style=flat-square&logo=python)
![React](https://img.shields.io/badge/React-18-0ea5e9?style=flat-square&logo=react)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-22c55e?style=flat-square)

---

## 🚀 Features

- **Dashboard** — Real-time CPU, RAM, storage monitoring
- **Infrastructure Graph** — Interactive datacenter → host → VM tree
- **VM Management** — Create, start, stop, migrate VMs
- **Cloudlets** — Submit Python tasks with real execution
- **5 Schedulers** — FCFS, Round Robin, Priority, Min-Min, Max-Min
- **Terminal** — Browser-based VM terminal
- **Monitoring** — Live recharts graphs
- **Research Mode** — Export CSV/JSON, auto-generate reports

---

## 📁 Project Structure

```
cloudsim/
├── backend/                  # Python FastAPI server
│   ├── main.py               # App entry point
│   ├── core/
│   │   ├── database.py       # SQLAlchemy + SQLite
│   │   ├── simulator.py      # VM allocation engine
│   │   ├── scheduler.py      # 5 scheduling algorithms
│   │   ├── executor.py       # Secure Python execution
│   │   └── monitor.py        # Background resource monitor
│   ├── models/
│   │   ├── orm_models.py     # DB tables
│   │   └── schemas.py        # Pydantic schemas
│   ├── api/routers/          # REST API endpoints
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/                 # React + TypeScript UI
│   ├── src/
│   │   ├── App.tsx           # Router + layout
│   │   ├── App.css           # Design system
│   │   ├── pages/            # All page components
│   │   ├── types/            # TypeScript types
│   │   └── utils/api.ts      # API client
│   ├── package.json
│   └── Dockerfile
│
├── .github/workflows/        # CI/CD pipeline
│   └── deploy.yml
├── docker-compose.yml        # Local development
└── .env.example
```

---

## 🖥️ Run Locally (Docker)

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/cloudsim.git
cd cloudsim

# 2. Copy environment file
cp .env.example .env

# 3. Start everything
docker compose up --build

# 4. Open in browser
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

---

## 🌐 Deploy to the Internet (Free)

### Backend → Railway

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click **New Project** → **Deploy from GitHub repo**
3. Select this repo, set **Root Directory** to `backend`
4. Add environment variable: `DATABASE_URL=sqlite:///./cloudsim.db`
5. Copy your Railway URL (e.g. `https://cloudsim.up.railway.app`)

### Frontend → Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **Add New Project** → import this repo
3. Set **Root Directory** to `frontend`
4. Add environment variable:
   ```
   REACT_APP_API_URL=https://cloudsim.up.railway.app
   ```
5. Click Deploy

### GitHub Secrets (for auto-deploy on push)

Go to your repo → **Settings** → **Secrets and variables** → **Actions**, and add:

| Secret Name | Where to get it |
|---|---|
| `RAILWAY_TOKEN` | Railway dashboard → Account → Tokens |
| `VERCEL_TOKEN` | Vercel dashboard → Settings → Tokens |
| `VERCEL_ORG_ID` | Vercel dashboard → Settings → General |
| `VERCEL_PROJECT_ID` | Vercel project → Settings → General |
| `REACT_APP_API_URL` | Your Railway backend URL |

After this, every `git push` to `main` automatically redeploys both frontend and backend.

---

## 📡 API Reference

The full interactive API docs are at: `http://localhost:8000/docs`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/datacenters/` | List datacenters |
| GET | `/api/datacenters/graph` | Infrastructure graph |
| GET | `/api/hosts/` | List hosts |
| GET | `/api/vms/` | List VMs |
| POST | `/api/vms/` | Create VM |
| POST | `/api/vms/{id}/start` | Start VM |
| POST | `/api/vms/{id}/stop` | Stop VM |
| POST | `/api/vms/{id}/migrate` | Migrate VM |
| DELETE | `/api/vms/{id}` | Delete VM |
| GET | `/api/tasks/` | List tasks |
| POST | `/api/tasks/` | Submit task |
| GET | `/api/metrics/overview` | Dashboard metrics |
| GET | `/api/metrics/history/{id}` | Metric history |
| POST | `/api/scheduler/run` | Run scheduler |
| POST | `/api/terminal/execute` | Execute command |
| GET | `/api/research/report` | Generate report |
| GET | `/api/research/export/tasks/csv` | Export CSV |

---

## 🎓 Educational Use

This platform simulates:
- **VM allocation** using First Fit Decreasing
- **Load balancing** across physical hosts
- **Scheduling algorithms** with visual comparison
- **Real Python execution** in isolated subprocesses
- **Resource monitoring** with realistic fluctuation simulation

---

## 📄 License

MIT — free to use for education and research.
