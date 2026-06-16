"""API routes for Datacenters."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from core.database import get_db
from models.orm_models import Datacenter, Host, VM, VMStatus
from models.schemas import DatacenterCreate, DatacenterResponse, InfrastructureGraph, NodeData, EdgeData

router = APIRouter()


@router.get("/", response_model=list[DatacenterResponse])
async def list_datacenters(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Datacenter))
    return result.scalars().all()


@router.post("/", response_model=DatacenterResponse, status_code=201)
async def create_datacenter(payload: DatacenterCreate, db: AsyncSession = Depends(get_db)):
    dc = Datacenter(name=payload.name, location=payload.location,
                    total_cpu=0, total_ram=0, total_storage=0)
    db.add(dc)
    await db.commit()
    await db.refresh(dc)
    return dc


@router.get("/graph", response_model=InfrastructureGraph)
async def get_infrastructure_graph(db: AsyncSession = Depends(get_db)):
    """Return nodes and edges for the infrastructure visualization graph."""
    nodes = []
    edges = []

    dc_result = await db.execute(select(Datacenter))
    datacenters = dc_result.scalars().all()

    for dc in datacenters:
        nodes.append(NodeData(id=dc.id, label=dc.name, type="datacenter"))

        host_result = await db.execute(select(Host).where(Host.datacenter_id == dc.id))
        hosts = host_result.scalars().all()

        for host in hosts:
            cpu_pct = (host.cpu_used / max(1, host.cpu_cores)) * 100
            ram_pct = (host.ram_used / max(1, host.ram_mb)) * 100
            nodes.append(NodeData(
                id=host.id, label=host.name, type="host",
                status="online" if host.is_online else "offline",
                cpu_usage=round(cpu_pct, 1), ram_usage=round(ram_pct, 1),
                cpu_cores=host.cpu_cores, ram_mb=host.ram_mb
            ))
            edges.append(EdgeData(id=f"{dc.id}-{host.id}", source=dc.id, target=host.id))

            vm_result = await db.execute(select(VM).where(VM.host_id == host.id))
            vms = vm_result.scalars().all()

            for vm in vms:
                nodes.append(NodeData(
                    id=vm.id, label=vm.name, type="vm",
                    status=vm.status.value if vm.status else "unknown",
                    cpu_usage=round(vm.cpu_usage, 1), ram_usage=round(vm.ram_usage, 1),
                    cpu_cores=vm.cpu_cores, ram_mb=vm.ram_mb
                ))
                edges.append(EdgeData(id=f"{host.id}-{vm.id}", source=host.id, target=vm.id))

    return InfrastructureGraph(nodes=nodes, edges=edges)


@router.get("/{dc_id}/summary")
async def get_datacenter_summary(dc_id: str, db: AsyncSession = Depends(get_db)):
    dc = await db.get(Datacenter, dc_id)
    if not dc:
        raise HTTPException(status_code=404, detail="Datacenter not found")

    host_result = await db.execute(select(Host).where(Host.datacenter_id == dc_id))
    hosts = host_result.scalars().all()

    total_cpu_used = sum(h.cpu_used for h in hosts)
    total_cpu = sum(h.cpu_cores for h in hosts)
    total_ram_used = sum(h.ram_used for h in hosts)
    total_ram = sum(h.ram_mb for h in hosts)

    vm_result = await db.execute(
        select(VM).join(Host).where(Host.datacenter_id == dc_id)
    )
    vms = vm_result.scalars().all()
    running_vms = [v for v in vms if v.status == VMStatus.RUNNING]

    return {
        "id": dc.id,
        "name": dc.name,
        "location": dc.location,
        "host_count": len(hosts),
        "vm_count": len(vms),
        "running_vms": len(running_vms),
        "cpu_usage_pct": round((total_cpu_used / max(1, total_cpu)) * 100, 1),
        "ram_usage_pct": round((total_ram_used / max(1, total_ram)) * 100, 1),
        "total_cpu": total_cpu,
        "total_ram_gb": round(total_ram / 1024, 1),
    }
