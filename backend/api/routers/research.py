"""Research mode: export metrics and generate reports."""

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
import csv
import json
import io

from core.database import get_db
from models.orm_models import Task, VM, Host, MetricSnapshot

router = APIRouter()


@router.get("/export/tasks/csv")
async def export_tasks_csv(db: AsyncSession = Depends(get_db)):
    """Export all task metrics as CSV."""
    result = await db.execute(select(Task).order_by(Task.submitted_at))
    tasks = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "id", "name", "status", "priority", "cpu_req", "mem_req",
        "submitted_at", "started_at", "completed_at",
        "waiting_time", "turnaround_time", "response_time"
    ])
    for t in tasks:
        writer.writerow([
            t.id, t.name, t.status.value if t.status else "",
            t.priority, t.cpu_requirement, t.memory_requirement,
            t.submitted_at, t.started_at, t.completed_at,
            t.waiting_time, t.turnaround_time, t.response_time
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=cloudsim_tasks.csv"}
    )


@router.get("/export/infrastructure/json")
async def export_infrastructure_json(db: AsyncSession = Depends(get_db)):
    """Export full infrastructure state as JSON."""
    dc_result = await db.execute(select(Host))
    hosts = dc_result.scalars().all()
    vm_result = await db.execute(select(VM))
    vms = vm_result.scalars().all()
    task_result = await db.execute(select(Task))
    tasks = task_result.scalars().all()

    data = {
        "exported_at": datetime.utcnow().isoformat(),
        "hosts": [
            {
                "id": h.id, "name": h.name, "datacenter_id": h.datacenter_id,
                "cpu_cores": h.cpu_cores, "ram_mb": h.ram_mb, "storage_gb": h.storage_gb,
                "cpu_used": h.cpu_used, "ram_used": h.ram_used,
            }
            for h in hosts
        ],
        "vms": [
            {
                "id": v.id, "name": v.name, "host_id": v.host_id,
                "cpu_cores": v.cpu_cores, "ram_mb": v.ram_mb, "os_image": v.os_image,
                "status": v.status.value if v.status else "", "ip_address": v.ip_address,
            }
            for v in vms
        ],
        "tasks": [
            {
                "id": t.id, "name": t.name, "vm_id": t.vm_id, "status": t.status.value if t.status else "",
                "priority": t.priority, "waiting_time": t.waiting_time,
                "turnaround_time": t.turnaround_time, "response_time": t.response_time,
            }
            for t in tasks
        ],
    }

    return StreamingResponse(
        iter([json.dumps(data, indent=2)]),
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=cloudsim_infrastructure.json"}
    )


@router.get("/report")
async def generate_report(db: AsyncSession = Depends(get_db)):
    """Generate a summary research report."""
    from core.scheduler import get_scheduler
    sched = get_scheduler()
    metrics = await sched.calculate_metrics()

    task_result = await db.execute(select(Task))
    tasks = task_result.scalars().all()

    vm_result = await db.execute(select(VM))
    vms = vm_result.scalars().all()

    status_counts = {}
    for t in tasks:
        key = t.status.value if t.status else "unknown"
        status_counts[key] = status_counts.get(key, 0) + 1

    return {
        "report_generated_at": datetime.utcnow().isoformat(),
        "summary": {
            "total_vms": len(vms),
            "total_tasks": len(tasks),
            "task_status_breakdown": status_counts,
        },
        "performance_metrics": metrics,
        "recommendations": _generate_recommendations(metrics, vms, tasks),
    }


def _generate_recommendations(metrics, vms, tasks) -> list:
    recs = []
    if metrics["resource_utilization"] < 30:
        recs.append("Resource utilization is low. Consider consolidating VMs to reduce costs.")
    if metrics["sla_violations"] > 0:
        recs.append(f"{metrics['sla_violations']} SLA violations detected. Review task timeouts and VM sizing.")
    if metrics["avg_waiting_time"] > 10:
        recs.append("High average waiting time. Consider switching to Priority or Min-Min scheduling.")
    if len([v for v in vms if v.status == "running"]) < 2:
        recs.append("Consider running more VMs in parallel to improve throughput.")
    if not recs:
        recs.append("System is operating within normal parameters.")
    return recs
