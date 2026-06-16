"""
ResourceMonitor - Background task that simulates real-time resource fluctuations
Updates CPU/RAM usage periodically to simulate a live cloud environment
"""

import asyncio
import random
import logging
from datetime import datetime

from core.database import AsyncSessionLocal
from models.orm_models import VM, Host, VMStatus, MetricSnapshot

logger = logging.getLogger(__name__)


class ResourceMonitor:
    """
    Simulates dynamic resource usage changes for VMs and hosts.
    Runs as a background task, updating metrics every 3 seconds.
    """

    def __init__(self):
        self.running = False
        self._snapshots = []  # In-memory rolling window of snapshots

    async def start(self):
        """Start the monitoring loop."""
        self.running = True
        logger.info("Resource monitor started")
        while self.running:
            try:
                await self._update_metrics()
                await asyncio.sleep(3)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Monitor error: {e}")
                await asyncio.sleep(5)

    async def _update_metrics(self):
        """Update simulated resource usage for all running VMs and hosts."""
        async with AsyncSessionLocal() as session:
            from sqlalchemy import select

            # Update VM metrics
            vm_result = await session.execute(
                select(VM).where(VM.status == VMStatus.RUNNING)
            )
            vms = vm_result.scalars().all()

            for vm in vms:
                # Simulate realistic CPU/RAM fluctuations
                vm.cpu_usage = max(1.0, min(95.0,
                    vm.cpu_usage + random.gauss(0, 5)))
                vm.ram_usage = max(10.0, min(90.0,
                    vm.ram_usage + random.gauss(0, 2)))

                # Record metric snapshot
                snapshot = MetricSnapshot(
                    vm_id=vm.id,
                    cpu_usage=vm.cpu_usage,
                    ram_usage=vm.ram_usage,
                    network_rx=random.uniform(0.1, 50.0),
                    network_tx=random.uniform(0.1, 20.0),
                    disk_read=random.uniform(0.0, 10.0),
                    disk_write=random.uniform(0.0, 5.0),
                    timestamp=datetime.utcnow()
                )
                session.add(snapshot)

            # Update Host aggregated metrics
            host_result = await session.execute(select(Host))
            hosts = host_result.scalars().all()

            for host in hosts:
                if host.vms:
                    # Host CPU = weighted avg of its VMs + base overhead
                    pass  # Hosts derive metrics from VMs

                snapshot = MetricSnapshot(
                    host_id=host.id,
                    cpu_usage=min(95, host.cpu_used / max(1, host.cpu_cores) * 100 + random.uniform(-5, 10)),
                    ram_usage=min(95, host.ram_used / max(1, host.ram_mb) * 100 + random.uniform(-3, 5)),
                    network_rx=random.uniform(1.0, 200.0),
                    network_tx=random.uniform(1.0, 100.0),
                    disk_read=random.uniform(0.5, 50.0),
                    disk_write=random.uniform(0.5, 30.0),
                    timestamp=datetime.utcnow()
                )
                session.add(snapshot)

            await session.commit()

    async def get_recent_metrics(self, entity_id: str, limit: int = 20):
        """Get recent metric snapshots for a host or VM."""
        async with AsyncSessionLocal() as session:
            from sqlalchemy import select, or_
            result = await session.execute(
                select(MetricSnapshot)
                .where(or_(
                    MetricSnapshot.host_id == entity_id,
                    MetricSnapshot.vm_id == entity_id
                ))
                .order_by(MetricSnapshot.timestamp.desc())
                .limit(limit)
            )
            return result.scalars().all()
