"""Scheduler API router."""

from fastapi import APIRouter
from models.schemas import SchedulerConfig
from core.scheduler import get_scheduler

router = APIRouter()


@router.get("/algorithms")
async def list_algorithms():
    """List available scheduling algorithms with descriptions."""
    return [
        {
            "id": "fcfs",
            "name": "First Come First Serve (FCFS)",
            "description": "Tasks are executed in the order they arrive. Simple but may cause convoy effect.",
            "complexity": "O(n)",
        },
        {
            "id": "round_robin",
            "name": "Round Robin (RR)",
            "description": "Each task gets a fixed time quantum cyclically. Fair but context-switch overhead.",
            "complexity": "O(n)",
        },
        {
            "id": "priority",
            "name": "Priority Scheduling",
            "description": "Higher priority tasks run first. May cause starvation of low-priority tasks.",
            "complexity": "O(n log n)",
        },
        {
            "id": "min_min",
            "name": "Min-Min",
            "description": "Assigns task with smallest completion time to its optimal VM first. Good for short tasks.",
            "complexity": "O(n² × m)",
        },
        {
            "id": "max_min",
            "name": "Max-Min",
            "description": "Assigns task with largest completion time to its optimal VM first. Balances large and small tasks.",
            "complexity": "O(n² × m)",
        },
    ]


@router.post("/run")
async def run_scheduler(config: SchedulerConfig):
    """Run the scheduler with selected algorithm."""
    sched = get_scheduler()
    sched.time_quantum = config.time_quantum or 2
    result = await sched.schedule(config.algorithm.value)
    return result


@router.get("/status")
async def get_scheduler_status():
    """Get current scheduler status and configuration."""
    sched = get_scheduler()
    return {
        "current_algorithm": sched.current_algorithm.value,
        "time_quantum": sched.time_quantum,
    }
