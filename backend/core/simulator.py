"""
CloudSimulator - Core simulation engine
Manages datacenter/host/VM lifecycle and resource allocation
"""

import asyncio
import random
import logging
from datetime import datetime
from typing import Optional

from core.database import AsyncSessionLocal
from models.orm_models import Datacenter, Host, VM, VMStatus

logger = logging.getLogger(__name__)


class CloudSimulator:
    """
    Core simulation engine that manages cloud infrastructure.
    Uses simulated resources instead of real hardware.
    """

    async def seed_infrastructure(self):
        """Create default datacenter + hosts if DB is empty."""
        async with AsyncSessionLocal() as session:
            from sqlalchemy import select
            result = await session.execute(select(Datacenter))
            if result.scalars().first():
                return  # Already seeded

            logger.info("Seeding initial cloud infrastructure...")

            # Create 2 datacenters
            datacenters = [
                Datacenter(id="DC01", name="US-East Datacenter", location="us-east-1",
                           total_cpu=256, total_ram=524288, total_storage=10000),
                Datacenter(id="DC02", name="EU-West Datacenter", location="eu-west-1",
                           total_cpu=128, total_ram=262144, total_storage=5000),
            ]
            session.add_all(datacenters)
            await session.flush()

            # Create hosts for each datacenter
            hosts_data = [
                # DC01 hosts
                ("H001", "Host-Alpha", "DC01", 32, 65536, 2000),
                ("H002", "Host-Beta", "DC01", 32, 65536, 2000),
                ("H003", "Host-Gamma", "DC01", 16, 32768, 1000),
                ("H004", "Host-Delta", "DC01", 16, 32768, 1000),
                # DC02 hosts
                ("H005", "Host-Epsilon", "DC02", 16, 32768, 1000),
                ("H006", "Host-Zeta", "DC02", 16, 32768, 1000),
            ]

            for hid, hname, dc_id, cpu, ram, storage in hosts_data:
                host = Host(id=hid, name=hname, datacenter_id=dc_id,
                            cpu_cores=cpu, ram_mb=ram, storage_gb=storage,
                            cpu_used=random.uniform(5, 20),
                            ram_used=random.uniform(10, 30))
                session.add(host)

            # Create some demo VMs on hosts
            demo_vms = [
                ("VM001", "WebServer-1", "H001", 4, 8192, 50, "ubuntu-22.04"),
                ("VM002", "Database-1", "H001", 8, 16384, 200, "ubuntu-22.04"),
                ("VM003", "APIServer-1", "H002", 2, 4096, 30, "debian-11"),
                ("VM004", "Cache-1", "H003", 2, 4096, 20, "ubuntu-22.04"),
            ]

            for vid, vname, hid, cpu, ram, storage, img in demo_vms:
                vm = VM(id=vid, name=vname, host_id=hid,
                        cpu_cores=cpu, ram_mb=ram, storage_gb=storage,
                        os_image=img, status=VMStatus.RUNNING,
                        cpu_usage=random.uniform(5, 60),
                        ram_usage=random.uniform(20, 70),
                        ip_address=f"10.0.{random.randint(1,255)}.{random.randint(1,254)}")
                session.add(vm)

            await session.commit()
            logger.info("Infrastructure seeded successfully!")

    async def allocate_vm_to_host(
        self, vm_id: str, preferred_host_id: Optional[str] = None
    ) -> Optional[str]:
        """
        Allocate a VM to the best available host using First Fit Decreasing.
        Returns host_id if successful, None otherwise.
        """
        async with AsyncSessionLocal() as session:
            from sqlalchemy import select

            vm_result = await session.execute(select(VM).where(VM.id == vm_id))
            vm = vm_result.scalars().first()
            if not vm:
                return None

            if preferred_host_id:
                host_result = await session.execute(
                    select(Host).where(Host.id == preferred_host_id, Host.is_online == True)
                )
                host = host_result.scalars().first()
                if host and self._host_can_fit(host, vm):
                    return await self._assign_vm_to_host(session, vm, host)

            # Auto-select: pick host with most available resources
            hosts_result = await session.execute(
                select(Host).where(Host.is_online == True)
            )
            hosts = hosts_result.scalars().all()

            best_host = None
            best_score = -1
            for host in hosts:
                if self._host_can_fit(host, vm):
                    avail_cpu = host.cpu_cores - host.cpu_used
                    avail_ram = host.ram_mb - host.ram_used
                    score = (avail_cpu / host.cpu_cores) + (avail_ram / host.ram_mb)
                    if score > best_score:
                        best_score = score
                        best_host = host

            if best_host:
                return await self._assign_vm_to_host(session, vm, best_host)

            return None

    def _host_can_fit(self, host: Host, vm: VM) -> bool:
        """Check if host has enough resources for the VM."""
        avail_cpu = host.cpu_cores - host.cpu_used
        avail_ram = host.ram_mb - host.ram_used
        avail_storage = host.storage_gb - host.storage_used
        return (avail_cpu >= vm.cpu_cores and
                avail_ram >= vm.ram_mb and
                avail_storage >= vm.storage_gb)

    async def _assign_vm_to_host(self, session, vm: VM, host: Host) -> str:
        """Assign VM to host and update resource usage."""
        vm.host_id = host.id
        vm.status = VMStatus.RUNNING
        vm.ip_address = f"10.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,254)}"
        vm.cpu_usage = random.uniform(5, 30)
        vm.ram_usage = random.uniform(20, 50)

        host.cpu_used = min(host.cpu_cores, host.cpu_used + vm.cpu_cores)
        host.ram_used = min(host.ram_mb, host.ram_used + vm.ram_mb)
        host.storage_used = min(host.storage_gb, host.storage_used + vm.storage_gb)

        await session.commit()
        return host.id

    async def release_vm_resources(self, vm_id: str):
        """Release resources when VM is deleted."""
        async with AsyncSessionLocal() as session:
            from sqlalchemy import select
            vm_result = await session.execute(select(VM).where(VM.id == vm_id))
            vm = vm_result.scalars().first()
            if not vm or not vm.host_id:
                return

            host_result = await session.execute(select(Host).where(Host.id == vm.host_id))
            host = host_result.scalars().first()
            if host:
                host.cpu_used = max(0, host.cpu_used - vm.cpu_cores)
                host.ram_used = max(0, host.ram_used - vm.ram_mb)
                host.storage_used = max(0, host.storage_used - vm.storage_gb)
                await session.commit()

    async def migrate_vm(self, vm_id: str, target_host_id: str) -> bool:
        """Migrate a VM from current host to target host."""
        async with AsyncSessionLocal() as session:
            from sqlalchemy import select

            vm_result = await session.execute(select(VM).where(VM.id == vm_id))
            vm = vm_result.scalars().first()
            if not vm:
                return False

            target_result = await session.execute(
                select(Host).where(Host.id == target_host_id)
            )
            target = target_result.scalars().first()
            if not target or not self._host_can_fit(target, vm):
                return False

            # Release from current host
            if vm.host_id:
                src_result = await session.execute(select(Host).where(Host.id == vm.host_id))
                src = src_result.scalars().first()
                if src:
                    src.cpu_used = max(0, src.cpu_used - vm.cpu_cores)
                    src.ram_used = max(0, src.ram_used - vm.ram_mb)
                    src.storage_used = max(0, src.storage_used - vm.storage_gb)

            # Set migrating state briefly
            vm.status = VMStatus.MIGRATING
            await session.commit()

            # Simulate migration delay
            await asyncio.sleep(1)

            vm.host_id = target_host_id
            vm.status = VMStatus.RUNNING
            target.cpu_used = min(target.cpu_cores, target.cpu_used + vm.cpu_cores)
            target.ram_used = min(target.ram_mb, target.ram_used + vm.ram_mb)
            target.storage_used = min(target.storage_gb, target.storage_used + vm.storage_gb)

            await session.commit()
            return True
