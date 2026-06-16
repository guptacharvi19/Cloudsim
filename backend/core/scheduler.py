"""
Scheduling Algorithms for CloudSim
Implements: FCFS, Round Robin, Priority, Min-Min, Max-Min
"""

import asyncio
import logging
from datetime import datetime
from typing import List, Optional
from enum import Enum

from core.database import AsyncSessionLocal
from models.orm_models import Task, VM, TaskStatus

logger = logging.getLogger(__name__)


class Algorithm(str, Enum):
    FCFS = "fcfs"
    ROUND_ROBIN = "round_robin"
    PRIORITY = "priority"
    MIN_MIN = "min_min"
    MAX_MIN = "max_min"


class TaskScheduler:
    """
    Implements multiple cloud scheduling algorithms.
    All algorithms operate on pending tasks and assign them to available VMs.
    """

    def __init__(self):
        self.current_algorithm = Algorithm.FCFS
        self.time_quantum = 2  # seconds for Round Robin
        self._rr_index = 0

    async def schedule(self, algorithm: Optional[str] = None) -> dict:
        """
        Main scheduling entry point.
        Returns scheduling result with order and metrics.
        """
        if algorithm:
            self.current_algorithm = Algorithm(algorithm)

        async with AsyncSessionLocal() as session:
            from sqlalchemy import select

            # Get pending tasks
            task_result = await session.execute(
                select(Task).where(Task.status == TaskStatus.PENDING)
                .order_by(Task.submitted_at)
            )
            tasks = task_result.scalars().all()

            # Get available VMs
            vm_result = await session.execute(
                select(VM).where(VM.status == "running")
            )
            vms = vm_result.scalars().all()

            if not tasks:
                return {"message": "No pending tasks", "scheduled": []}

            if not vms:
                return {"message": "No running VMs available", "scheduled": []}

            scheduled = []

            if self.current_algorithm == Algorithm.FCFS:
                scheduled = await self._fcfs(session, tasks, vms)
            elif self.current_algorithm == Algorithm.ROUND_ROBIN:
                scheduled = await self._round_robin(session, tasks, vms)
            elif self.current_algorithm == Algorithm.PRIORITY:
                scheduled = await self._priority(session, tasks, vms)
            elif self.current_algorithm == Algorithm.MIN_MIN:
                scheduled = await self._min_min(session, tasks, vms)
            elif self.current_algorithm == Algorithm.MAX_MIN:
                scheduled = await self._max_min(session, tasks, vms)

            await session.commit()

            return {
                "algorithm": self.current_algorithm.value,
                "scheduled": scheduled,
                "total_tasks": len(tasks),
                "total_vms": len(vms),
            }

    async def _fcfs(self, session, tasks, vms) -> List[dict]:
        """
        First Come First Serve:
        Tasks are assigned in submission order, round-robin across VMs.
        """
        scheduled = []
        for i, task in enumerate(tasks):
            vm = vms[i % len(vms)]
            task.vm_id = vm.id
            task.status = TaskStatus.QUEUED
            scheduled.append({
                "task_id": task.id,
                "task_name": task.name,
                "vm_id": vm.id,
                "order": i + 1,
                "reason": "FCFS order",
            })
        return scheduled

    async def _round_robin(self, session, tasks, vms) -> List[dict]:
        """
        Round Robin:
        Each task gets a time quantum; tasks are distributed cyclically.
        """
        scheduled = []
        vm_queue = list(vms)
        for i, task in enumerate(tasks):
            vm = vm_queue[self._rr_index % len(vm_queue)]
            self._rr_index += 1
            task.vm_id = vm.id
            task.status = TaskStatus.QUEUED
            scheduled.append({
                "task_id": task.id,
                "task_name": task.name,
                "vm_id": vm.id,
                "order": i + 1,
                "time_quantum": self.time_quantum,
                "reason": f"RR slot #{self._rr_index}",
            })
        return scheduled

    async def _priority(self, session, tasks, vms) -> List[dict]:
        """
        Priority Scheduling:
        Higher priority tasks are assigned to faster (more cores) VMs first.
        """
        sorted_tasks = sorted(tasks, key=lambda t: t.priority, reverse=True)
        sorted_vms = sorted(vms, key=lambda v: v.cpu_cores, reverse=True)
        scheduled = []
        for i, task in enumerate(sorted_tasks):
            vm = sorted_vms[i % len(sorted_vms)]
            task.vm_id = vm.id
            task.status = TaskStatus.QUEUED
            scheduled.append({
                "task_id": task.id,
                "task_name": task.name,
                "vm_id": vm.id,
                "order": i + 1,
                "priority": task.priority,
                "reason": f"Priority {task.priority} → fastest VM",
            })
        return scheduled

    async def _min_min(self, session, tasks, vms) -> List[dict]:
        """
        Min-Min Algorithm:
        Assigns task with minimum completion time on its best VM first.
        Completion time = cpu_requirement / vm.cpu_cores
        """
        # Build completion time matrix
        def completion_time(task, vm):
            return task.cpu_requirement / max(1, vm.cpu_cores) * 10  # simulated seconds

        remaining = list(tasks)
        scheduled = []
        order = 1

        while remaining:
            # For each task, find the VM that gives minimum CT
            task_best = {}
            for task in remaining:
                best_vm = min(vms, key=lambda v: completion_time(task, v))
                task_best[task.id] = (task, best_vm, completion_time(task, best_vm))

            # Pick the task with minimum CT among all best choices
            best_id = min(task_best, key=lambda tid: task_best[tid][2])
            chosen_task, chosen_vm, ct = task_best[best_id]

            chosen_task.vm_id = chosen_vm.id
            chosen_task.status = TaskStatus.QUEUED
            scheduled.append({
                "task_id": chosen_task.id,
                "task_name": chosen_task.name,
                "vm_id": chosen_vm.id,
                "order": order,
                "completion_time": round(ct, 2),
                "reason": f"Min-Min: CT={ct:.2f}s",
            })
            remaining.remove(chosen_task)
            order += 1

        return scheduled

    async def _max_min(self, session, tasks, vms) -> List[dict]:
        """
        Max-Min Algorithm:
        Assigns task with maximum completion time on its best VM first.
        Prioritizes long tasks to reduce overall makespan.
        """
        def completion_time(task, vm):
            return task.cpu_requirement / max(1, vm.cpu_cores) * 10

        remaining = list(tasks)
        scheduled = []
        order = 1

        while remaining:
            task_best = {}
            for task in remaining:
                best_vm = min(vms, key=lambda v: completion_time(task, v))
                task_best[task.id] = (task, best_vm, completion_time(task, best_vm))

            # Pick the task with MAXIMUM CT among best choices (opposite of Min-Min)
            best_id = max(task_best, key=lambda tid: task_best[tid][2])
            chosen_task, chosen_vm, ct = task_best[best_id]

            chosen_task.vm_id = chosen_vm.id
            chosen_task.status = TaskStatus.QUEUED
            scheduled.append({
                "task_id": chosen_task.id,
                "task_name": chosen_task.name,
                "vm_id": chosen_vm.id,
                "order": order,
                "completion_time": round(ct, 2),
                "reason": f"Max-Min: CT={ct:.2f}s (longest first)",
            })
            remaining.remove(chosen_task)
            order += 1

        return scheduled

    async def calculate_metrics(self) -> dict:
        """Calculate scheduling performance metrics."""
        async with AsyncSessionLocal() as session:
            from sqlalchemy import select, func

            completed = await session.execute(
                select(Task).where(Task.status == TaskStatus.COMPLETED)
            )
            tasks = completed.scalars().all()

            if not tasks:
                return {
                    "makespan": 0, "throughput": 0, "resource_utilization": 0,
                    "sla_violations": 0, "energy_consumption": 0,
                    "avg_waiting_time": 0, "avg_turnaround_time": 0, "avg_response_time": 0
                }

            waiting_times = [t.waiting_time or 0 for t in tasks]
            turnaround_times = [t.turnaround_time or 0 for t in tasks]
            response_times = [t.response_time or 0 for t in tasks]

            makespan = max(turnaround_times) if turnaround_times else 0
            throughput = len(tasks) / max(1, makespan) if makespan > 0 else 0
            sla_violations = sum(1 for t in tasks if (t.turnaround_time or 0) > t.timeout)

            return {
                "makespan": round(makespan, 2),
                "throughput": round(throughput, 4),
                "resource_utilization": round(min(95, len(tasks) * 10), 2),
                "sla_violations": sla_violations,
                "energy_consumption": round(makespan * 0.15, 2),  # simulated kWh
                "avg_waiting_time": round(sum(waiting_times) / max(1, len(tasks)), 2),
                "avg_turnaround_time": round(sum(turnaround_times) / max(1, len(tasks)), 2),
                "avg_response_time": round(sum(response_times) / max(1, len(tasks)), 2),
            }


# Singleton scheduler instance
_scheduler = None


def get_scheduler() -> TaskScheduler:
    global _scheduler
    if _scheduler is None:
        _scheduler = TaskScheduler()
    return _scheduler
