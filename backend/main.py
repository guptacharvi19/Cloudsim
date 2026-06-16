"""
CloudSim - Cloud Computing Simulation Platform
Main FastAPI application entry point
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
import logging

from api.routers import vms, hosts, datacenters, tasks, metrics, scheduler, terminal, research
from core.database import init_db
from core.simulator import CloudSimulator
from core.monitor import ResourceMonitor

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize and teardown application resources."""
    logger.info("Starting CloudSim Platform...")
    await init_db()
    
    # Seed initial infrastructure
    simulator = CloudSimulator()
    await simulator.seed_infrastructure()
    
    # Start background monitoring
    monitor = ResourceMonitor()
    monitor_task = asyncio.create_task(monitor.start())
    
    app.state.simulator = simulator
    app.state.monitor = monitor
    
    logger.info("CloudSim Platform ready!")
    yield
    
    logger.info("Shutting down CloudSim Platform...")
    monitor_task.cancel()
    try:
        await monitor_task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="CloudSim Platform API",
    description="A cloud computing simulation platform for education and research",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all routers
app.include_router(datacenters.router, prefix="/api/datacenters", tags=["Datacenters"])
app.include_router(hosts.router, prefix="/api/hosts", tags=["Hosts"])
app.include_router(vms.router, prefix="/api/vms", tags=["Virtual Machines"])
app.include_router(tasks.router, prefix="/api/tasks", tags=["Tasks/Cloudlets"])
app.include_router(metrics.router, prefix="/api/metrics", tags=["Metrics"])
app.include_router(scheduler.router, prefix="/api/scheduler", tags=["Scheduler"])
app.include_router(terminal.router, prefix="/api/terminal", tags=["Terminal"])
app.include_router(research.router, prefix="/api/research", tags=["Research"])


@app.get("/")
async def root():
    return {"message": "CloudSim Platform API", "version": "1.0.0", "status": "running"}


@app.get("/api/health")
async def health():
    return {"status": "healthy"}
