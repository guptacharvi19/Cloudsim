"""API routes for Hosts."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database import get_db
from models.orm_models import Host
from models.schemas import HostCreate, HostResponse

router = APIRouter()


def gen_id():
    import uuid
    return "H" + str(uuid.uuid4())[:5].upper()


@router.get("/", response_model=list[HostResponse])
async def list_hosts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Host).order_by(Host.name))
    return result.scalars().all()


@router.post("/", response_model=HostResponse, status_code=201)
async def create_host(payload: HostCreate, db: AsyncSession = Depends(get_db)):
    host = Host(
        id=gen_id(), name=payload.name, datacenter_id=payload.datacenter_id,
        cpu_cores=payload.cpu_cores, ram_mb=payload.ram_mb, storage_gb=payload.storage_gb
    )
    db.add(host)
    await db.commit()
    await db.refresh(host)
    return host


@router.get("/{host_id}", response_model=HostResponse)
async def get_host(host_id: str, db: AsyncSession = Depends(get_db)):
    host = await db.get(Host, host_id)
    if not host:
        raise HTTPException(404, "Host not found")
    return host


@router.delete("/{host_id}", status_code=204)
async def delete_host(host_id: str, db: AsyncSession = Depends(get_db)):
    host = await db.get(Host, host_id)
    if not host:
        raise HTTPException(404, "Host not found")
    await db.delete(host)
    await db.commit()
