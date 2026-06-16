"""
Pydantic schemas for request/response validation
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class VMStatusEnum(str, Enum):
    creating = "creating"
    running = "running"
    stopped = "stopped"
    migrating = "migrating"
    error = "error"


class TaskStatusEnum(str, Enum):
    pending = "pending"
    queued = "queued"
    running = "running"
    completed = "completed"
    failed = "failed"


class SchedulerAlgorithm(str, Enum):
    fcfs = "fcfs"
    round_robin = "round_robin"
    priority = "priority"
    min_min = "min_min"
    max_min = "max_min"


# --- Datacenter Schemas ---

class DatacenterCreate(BaseModel):
    name: str
    location: str = "us-east-1"


class DatacenterResponse(BaseModel):
    id: str
    name: str
    location: str
    total_cpu: int
    total_ram: int
    total_storage: int
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Host Schemas ---

class HostCreate(BaseModel):
    name: str
    datacenter_id: str
    cpu_cores: int = Field(default=16, ge=1, le=256)
    ram_mb: int = Field(default=32768, ge=1024)
    storage_gb: int = Field(default=500, ge=10)


class HostResponse(BaseModel):
    id: str
    name: str
    datacenter_id: str
    cpu_cores: int
    ram_mb: int
    storage_gb: int
    cpu_used: float
    ram_used: float
    storage_used: float
    is_online: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# --- VM Schemas ---

class VMCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=64)
    cpu_cores: int = Field(default=2, ge=1, le=32)
    ram_mb: int = Field(default=2048, ge=512)
    storage_gb: int = Field(default=20, ge=5)
    os_image: str = Field(default="ubuntu-22.04")
    host_id: Optional[str] = None


class VMResponse(BaseModel):
    id: str
    name: str
    host_id: Optional[str]
    cpu_cores: int
    ram_mb: int
    storage_gb: int
    os_image: str
    status: VMStatusEnum
    cpu_usage: float
    ram_usage: float
    ip_address: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class VMMigrateRequest(BaseModel):
    target_host_id: str


# --- Task Schemas ---

class TaskCreate(BaseModel):
    name: str
    vm_id: Optional[str] = None
    script: str
    priority: int = Field(default=1, ge=1, le=5)
    cpu_requirement: float = Field(default=1.0, ge=0.1)
    memory_requirement: float = Field(default=256.0, ge=64.0)
    timeout: int = Field(default=30, ge=5, le=300)


class TaskResponse(BaseModel):
    id: str
    name: str
    vm_id: Optional[str]
    script: str
    priority: int
    cpu_requirement: float
    memory_requirement: float
    timeout: int
    status: TaskStatusEnum
    output: Optional[str]
    error: Optional[str]
    submitted_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    waiting_time: Optional[float]
    turnaround_time: Optional[float]
    response_time: Optional[float]

    model_config = {"from_attributes": True}


# --- Terminal Schemas ---

class TerminalCommand(BaseModel):
    vm_id: str
    command: str


class TerminalResponse(BaseModel):
    output: str
    exit_code: int
    execution_time: float


# --- Scheduler Schemas ---

class SchedulerConfig(BaseModel):
    algorithm: SchedulerAlgorithm
    time_quantum: Optional[int] = Field(default=2, ge=1)  # for round robin


# --- Metric Schemas ---

class MetricSnapshot(BaseModel):
    host_id: Optional[str]
    vm_id: Optional[str]
    cpu_usage: float
    ram_usage: float
    network_rx: float
    network_tx: float
    disk_read: float
    disk_write: float
    timestamp: datetime

    model_config = {"from_attributes": True}


class CloudMetrics(BaseModel):
    makespan: float
    throughput: float
    resource_utilization: float
    sla_violations: int
    energy_consumption: float
    avg_waiting_time: float
    avg_turnaround_time: float
    avg_response_time: float


# --- Infrastructure Graph ---

class NodeData(BaseModel):
    id: str
    label: str
    type: str  # datacenter | host | vm
    status: Optional[str] = None
    cpu_usage: Optional[float] = None
    ram_usage: Optional[float] = None
    cpu_cores: Optional[int] = None
    ram_mb: Optional[int] = None


class EdgeData(BaseModel):
    id: str
    source: str
    target: str


class InfrastructureGraph(BaseModel):
    nodes: List[NodeData]
    edges: List[EdgeData]
