"""API routes for Virtual Machine management."""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
import random

from core.database import get_db
from core.simulator import CloudSimulator
from models.orm_models import VM, VMStatus, Host
from models.schemas import VMCreate, VMResponse, VMMigrateRequest

router = APIRouter()
simulator = CloudSimulator()


def generate_id():
    import uuid
    return "VM" + str(uuid.uuid4())[:6].upper()


@router.get("/", response_model=list[VMResponse])
async def list_vms(db: AsyncSession = Depends(get_db)):
    """List all virtual machines."""
    result = await db.execute(select(VM).order_by(VM.created_at.desc()))
    return result.scalars().all()


@router.post("/", response_model=VMResponse, status_code=201)
async def create_vm(
    payload: VMCreate,
    background: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Create a new virtual machine and allocate it to a host."""
    vm = VM(
        id=generate_id(),
        name=payload.name,
        cpu_cores=payload.cpu_cores,
        ram_mb=payload.ram_mb,
        storage_gb=payload.storage_gb,
        os_image=payload.os_image,
        status=VMStatus.CREATING,
        host_id=payload.host_id,
    )
    db.add(vm)
    await db.commit()
    await db.refresh(vm)

    # Allocate in background
    async def allocate():
        host_id = await simulator.allocate_vm_to_host(vm.id, payload.host_id)
        if not host_id:
            async with __import__("core.database", fromlist=["AsyncSessionLocal"]).AsyncSessionLocal() as s:
                v = await s.get(VM, vm.id)
                if v:
                    v.status = VMStatus.ERROR
                    await s.commit()

    background.add_task(allocate)
    return vm


@router.get("/{vm_id}", response_model=VMResponse)
async def get_vm(vm_id: str, db: AsyncSession = Depends(get_db)):
    """Get a specific VM by ID."""
    vm = await db.get(VM, vm_id)
    if not vm:
        raise HTTPException(status_code=404, detail="VM not found")
    return vm


@router.delete("/{vm_id}", status_code=204)
async def delete_vm(vm_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a VM and release its resources."""
    vm = await db.get(VM, vm_id)
    if not vm:
        raise HTTPException(status_code=404, detail="VM not found")
    await simulator.release_vm_resources(vm_id)
    await db.delete(vm)
    await db.commit()


@router.post("/{vm_id}/start", response_model=VMResponse)
async def start_vm(vm_id: str, db: AsyncSession = Depends(get_db)):
    """Start a stopped VM."""
    vm = await db.get(VM, vm_id)
    if not vm:
        raise HTTPException(status_code=404, detail="VM not found")
    vm.status = VMStatus.RUNNING
    vm.cpu_usage = random.uniform(5, 20)
    vm.ram_usage = random.uniform(15, 35)
    await db.commit()
    await db.refresh(vm)
    return vm


@router.post("/{vm_id}/stop", response_model=VMResponse)
async def stop_vm(vm_id: str, db: AsyncSession = Depends(get_db)):
    """Stop a running VM."""
    vm = await db.get(VM, vm_id)
    if not vm:
        raise HTTPException(status_code=404, detail="VM not found")
    vm.status = VMStatus.STOPPED
    vm.cpu_usage = 0
    vm.ram_usage = 0
    await db.commit()
    await db.refresh(vm)
    return vm


@router.post("/{vm_id}/migrate", response_model=VMResponse)
async def migrate_vm(
    vm_id: str, payload: VMMigrateRequest, db: AsyncSession = Depends(get_db)
):
    """Migrate VM to a different host."""
    success = await simulator.migrate_vm(vm_id, payload.target_host_id)
    if not success:
        raise HTTPException(
            status_code=400,
            detail="Migration failed: target host may not have enough resources"
        )
    vm = await db.get(VM, vm_id)
    return vm
