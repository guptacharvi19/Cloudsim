"""API routes for Tasks (Cloudlets)."""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
import asyncio

from core.database import get_db
from core.executor import get_executor
from models.orm_models import Task, TaskStatus, VM, VMStatus
from models.schemas import TaskCreate, TaskResponse

router = APIRouter()


def gen_id():
    import uuid
    return "T" + str(uuid.uuid4())[:6].upper()


@router.get("/", response_model=list[TaskResponse])
async def list_tasks(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Task).order_by(Task.submitted_at.desc()))
    return result.scalars().all()


@router.post("/", response_model=TaskResponse, status_code=201)
async def create_task(
    payload: TaskCreate,
    background: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Submit a new task/cloudlet for execution."""
    task = Task(
        id=gen_id(),
        name=payload.name,
        vm_id=payload.vm_id,
        script=payload.script,
        priority=payload.priority,
        cpu_requirement=payload.cpu_requirement,
        memory_requirement=payload.memory_requirement,
        timeout=payload.timeout,
        status=TaskStatus.PENDING,
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)

    # Execute in background
    background.add_task(_run_task, task.id)
    return task


async def _run_task(task_id: str):
    """Background task executor."""
    from core.database import AsyncSessionLocal
    async with AsyncSessionLocal() as session:
        task = await session.get(Task, task_id)
        if not task:
            return

        task.status = TaskStatus.RUNNING
        task.started_at = datetime.utcnow()
        task.waiting_time = (task.started_at - task.submitted_at).total_seconds()
        task.response_time = task.waiting_time
        await session.commit()

        executor = get_executor()
        result = await executor.execute(
            task.script,
            timeout=task.timeout,
            cpu_limit=task.cpu_requirement,
            memory_limit_mb=task.memory_requirement,
            vm_id=task.vm_id,
        )

        task.completed_at = datetime.utcnow()
        task.turnaround_time = (task.completed_at - task.submitted_at).total_seconds()

        if result.exit_code == 0:
            task.status = TaskStatus.COMPLETED
            task.output = result.output
        else:
            task.status = TaskStatus.FAILED
            task.error = result.stderr or result.output

        await session.commit()


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(task_id: str, db: AsyncSession = Depends(get_db)):
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    return task


@router.delete("/{task_id}", status_code=204)
async def delete_task(task_id: str, db: AsyncSession = Depends(get_db)):
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    await db.delete(task)
    await db.commit()
