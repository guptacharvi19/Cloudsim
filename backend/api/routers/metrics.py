"""Metrics API router."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timedelta

from core.database import get_db
from models.orm_models import VM, Host, Task, MetricSnapshot, VMStatus, TaskStatus
from core.scheduler import get_scheduler

router = APIRouter()


@router.get("/overview")
async def get_overview(db: AsyncSession = Depends(get_db)):
    """Dashboard overview metrics."""
    vm_result = await db.execute(select(VM))
    vms = vm_result.scalars().all()
    running_vms = [v for v in vms if v.status == VMStatus.RUNNING]

    host_result = await db.execute(select(Host))
    hosts = host_result.scalars().all()

    task_result = await db.execute(select(Task))
    tasks = task_result.scalars().all()
    running_tasks = [t for t in tasks if t.status == TaskStatus.RUNNING]

    total_cpu = sum(h.cpu_cores for h in hosts)
    used_cpu = sum(h.cpu_used for h in hosts)
    total_ram = sum(h.ram_mb for h in hosts)
    used_ram = sum(h.ram_used for h in hosts)
    total_storage = sum(h.storage_gb for h in hosts)
    used_storage = sum(h.storage_used for h in hosts)

    avg_vm_cpu = sum(v.cpu_usage for v in running_vms) / max(1, len(running_vms))
    avg_vm_ram = sum(v.ram_usage for v in running_vms) / max(1, len(running_vms))

    return {
        "total_vms": len(vms),
        "running_vms": len(running_vms),
        "total_hosts": len(hosts),
        "running_tasks": len(running_tasks),
        "completed_tasks": len([t for t in tasks if t.status == TaskStatus.COMPLETED]),
        "cpu_usage_pct": round((used_cpu / max(1, total_cpu)) * 100, 1),
        "ram_usage_pct": round((used_ram / max(1, total_ram)) * 100, 1),
        "storage_usage_pct": round((used_storage / max(1, total_storage)) * 100, 1),
        "avg_vm_cpu": round(avg_vm_cpu, 1),
        "avg_vm_ram": round(avg_vm_ram, 1),
        "total_cpu_cores": total_cpu,
        "total_ram_gb": round(total_ram / 1024, 1),
        "total_storage_tb": round(total_storage / 1024, 2),
    }


@router.get("/history/{entity_id}")
async def get_metric_history(entity_id: str, limit: int = 30, db: AsyncSession = Depends(get_db)):
    """Get metric history for a VM or host."""
    from sqlalchemy import or_
    result = await db.execute(
        select(MetricSnapshot)
        .where(or_(MetricSnapshot.host_id == entity_id, MetricSnapshot.vm_id == entity_id))
        .order_by(MetricSnapshot.timestamp.desc())
        .limit(limit)
    )
    snaps = result.scalars().all()
    return [
        {
            "timestamp": s.timestamp.isoformat(),
            "cpu_usage": s.cpu_usage,
            "ram_usage": s.ram_usage,
            "network_rx": s.network_rx,
            "network_tx": s.network_tx,
            "disk_read": s.disk_read,
            "disk_write": s.disk_write,
        }
        for s in reversed(snaps)
    ]


@router.get("/compute")
async def compute_metrics():
    """Compute scheduling performance metrics."""
    sched = get_scheduler()
    return await sched.calculate_metrics()
