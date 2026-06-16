"""
ORM Models for CloudSim Platform
Defines all database entities: Datacenter, Host, VM, Task, MetricSnapshot
"""

from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, Text, ForeignKey, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum

from core.database import Base


def generate_id():
    return str(uuid.uuid4())[:8].upper()


class VMStatus(str, enum.Enum):
    CREATING = "creating"
    RUNNING = "running"
    STOPPED = "stopped"
    MIGRATING = "migrating"
    ERROR = "error"


class TaskStatus(str, enum.Enum):
    PENDING = "pending"
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class Datacenter(Base):
    __tablename__ = "datacenters"

    id = Column(String, primary_key=True, default=generate_id)
    name = Column(String, nullable=False, unique=True)
    location = Column(String, default="us-east-1")
    total_cpu = Column(Integer, default=0)       # total vCPUs
    total_ram = Column(Integer, default=0)       # total RAM in MB
    total_storage = Column(Integer, default=0)   # total storage in GB
    created_at = Column(DateTime, default=datetime.utcnow)

    hosts = relationship("Host", back_populates="datacenter", cascade="all, delete-orphan")


class Host(Base):
    __tablename__ = "hosts"

    id = Column(String, primary_key=True, default=generate_id)
    name = Column(String, nullable=False)
    datacenter_id = Column(String, ForeignKey("datacenters.id"), nullable=False)
    cpu_cores = Column(Integer, default=16)         # physical cores
    ram_mb = Column(Integer, default=32768)         # 32 GB default
    storage_gb = Column(Integer, default=500)
    cpu_used = Column(Float, default=0.0)
    ram_used = Column(Float, default=0.0)
    storage_used = Column(Float, default=0.0)
    is_online = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    datacenter = relationship("Datacenter", back_populates="hosts")
    vms = relationship("VM", back_populates="host", cascade="all, delete-orphan")


class VM(Base):
    __tablename__ = "vms"

    id = Column(String, primary_key=True, default=generate_id)
    name = Column(String, nullable=False)
    host_id = Column(String, ForeignKey("hosts.id"), nullable=True)
    cpu_cores = Column(Integer, default=2)
    ram_mb = Column(Integer, default=2048)
    storage_gb = Column(Integer, default=20)
    os_image = Column(String, default="ubuntu-22.04")
    status = Column(Enum(VMStatus), default=VMStatus.CREATING)
    container_id = Column(String, nullable=True)   # Docker container ID
    cpu_usage = Column(Float, default=0.0)         # percentage
    ram_usage = Column(Float, default=0.0)         # percentage
    ip_address = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    host = relationship("Host", back_populates="vms")
    tasks = relationship("Task", back_populates="vm")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(String, primary_key=True, default=generate_id)
    name = Column(String, nullable=False)
    vm_id = Column(String, ForeignKey("vms.id"), nullable=True)
    script = Column(Text, nullable=False)
    priority = Column(Integer, default=1)          # 1=low, 5=high
    cpu_requirement = Column(Float, default=1.0)
    memory_requirement = Column(Float, default=256.0)  # MB
    timeout = Column(Integer, default=30)          # seconds
    status = Column(Enum(TaskStatus), default=TaskStatus.PENDING)
    output = Column(Text, nullable=True)
    error = Column(Text, nullable=True)
    submitted_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    waiting_time = Column(Float, nullable=True)    # seconds
    turnaround_time = Column(Float, nullable=True) # seconds
    response_time = Column(Float, nullable=True)   # seconds

    vm = relationship("VM", back_populates="tasks")


class MetricSnapshot(Base):
    __tablename__ = "metric_snapshots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    host_id = Column(String, ForeignKey("hosts.id"), nullable=True)
    vm_id = Column(String, ForeignKey("vms.id"), nullable=True)
    cpu_usage = Column(Float, default=0.0)
    ram_usage = Column(Float, default=0.0)
    network_rx = Column(Float, default=0.0)  # MB/s
    network_tx = Column(Float, default=0.0)
    disk_read = Column(Float, default=0.0)   # MB/s
    disk_write = Column(Float, default=0.0)
    timestamp = Column(DateTime, default=datetime.utcnow)
