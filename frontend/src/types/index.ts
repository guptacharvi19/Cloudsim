// CloudSim TypeScript Type Definitions

export type VMStatus = 'creating' | 'running' | 'stopped' | 'migrating' | 'error';
export type TaskStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed';
export type SchedulerAlgorithm = 'fcfs' | 'round_robin' | 'priority' | 'min_min' | 'max_min';

export interface Datacenter {
  id: string;
  name: string;
  location: string;
  total_cpu: number;
  total_ram: number;
  total_storage: number;
  created_at: string;
}

export interface Host {
  id: string;
  name: string;
  datacenter_id: string;
  cpu_cores: number;
  ram_mb: number;
  storage_gb: number;
  cpu_used: number;
  ram_used: number;
  storage_used: number;
  is_online: boolean;
  created_at: string;
}

export interface VM {
  id: string;
  name: string;
  host_id: string | null;
  cpu_cores: number;
  ram_mb: number;
  storage_gb: number;
  os_image: string;
  status: VMStatus;
  cpu_usage: number;
  ram_usage: number;
  ip_address: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  name: string;
  vm_id: string | null;
  script: string;
  priority: number;
  cpu_requirement: number;
  memory_requirement: number;
  timeout: number;
  status: TaskStatus;
  output: string | null;
  error: string | null;
  submitted_at: string;
  started_at: string | null;
  completed_at: string | null;
  waiting_time: number | null;
  turnaround_time: number | null;
  response_time: number | null;
}

export interface OverviewMetrics {
  total_vms: number;
  running_vms: number;
  total_hosts: number;
  running_tasks: number;
  completed_tasks: number;
  cpu_usage_pct: number;
  ram_usage_pct: number;
  storage_usage_pct: number;
  avg_vm_cpu: number;
  avg_vm_ram: number;
  total_cpu_cores: number;
  total_ram_gb: number;
  total_storage_tb: number;
}

export interface MetricPoint {
  timestamp: string;
  cpu_usage: number;
  ram_usage: number;
  network_rx: number;
  network_tx: number;
  disk_read: number;
  disk_write: number;
}

export interface GraphNode {
  id: string;
  label: string;
  type: 'datacenter' | 'host' | 'vm';
  status?: string;
  cpu_usage?: number;
  ram_usage?: number;
  cpu_cores?: number;
  ram_mb?: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
}

export interface InfrastructureGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface SchedulerAlgorithmInfo {
  id: SchedulerAlgorithm;
  name: string;
  description: string;
  complexity: string;
}

export interface ScheduleResult {
  algorithm: string;
  scheduled: Array<{
    task_id: string;
    task_name: string;
    vm_id: string;
    order: number;
    priority?: number;
    completion_time?: number;
    reason: string;
  }>;
  total_tasks: number;
  total_vms: number;
}

export interface CloudMetrics {
  makespan: number;
  throughput: number;
  resource_utilization: number;
  sla_violations: number;
  energy_consumption: number;
  avg_waiting_time: number;
  avg_turnaround_time: number;
  avg_response_time: number;
}

export interface ResearchReport {
  report_generated_at: string;
  summary: {
    total_vms: number;
    total_tasks: number;
    task_status_breakdown: Record<string, number>;
  };
  performance_metrics: CloudMetrics;
  recommendations: string[];
}
