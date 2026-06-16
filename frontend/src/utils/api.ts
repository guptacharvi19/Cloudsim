// CloudSim API Client
// Centralized axios instance with all API calls

import axios from 'axios';
import type {
  VM, Host, Task, Datacenter, OverviewMetrics, MetricPoint,
  InfrastructureGraph, SchedulerAlgorithmInfo, ScheduleResult,
  CloudMetrics, ResearchReport, SchedulerAlgorithm
} from '../types';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// ===== Datacenters =====
export const getDatacenters = () => api.get<Datacenter[]>('/api/datacenters/').then(r => r.data);
export const getInfrastructureGraph = () => api.get<InfrastructureGraph>('/api/datacenters/graph').then(r => r.data);
export const getDatacenterSummary = (id: string) => api.get(`/api/datacenters/${id}/summary`).then(r => r.data);

// ===== Hosts =====
export const getHosts = () => api.get<Host[]>('/api/hosts/').then(r => r.data);
export const createHost = (data: Partial<Host>) => api.post<Host>('/api/hosts/', data).then(r => r.data);
export const deleteHost = (id: string) => api.delete(`/api/hosts/${id}`);

// ===== Virtual Machines =====
export const getVMs = () => api.get<VM[]>('/api/vms/').then(r => r.data);
export const getVM = (id: string) => api.get<VM>(`/api/vms/${id}`).then(r => r.data);
export const createVM = (data: {
  name: string; cpu_cores: number; ram_mb: number;
  storage_gb: number; os_image: string; host_id?: string;
}) => api.post<VM>('/api/vms/', data).then(r => r.data);
export const deleteVM = (id: string) => api.delete(`/api/vms/${id}`);
export const startVM = (id: string) => api.post<VM>(`/api/vms/${id}/start`).then(r => r.data);
export const stopVM = (id: string) => api.post<VM>(`/api/vms/${id}/stop`).then(r => r.data);
export const migrateVM = (id: string, targetHostId: string) =>
  api.post<VM>(`/api/vms/${id}/migrate`, { target_host_id: targetHostId }).then(r => r.data);

// ===== Tasks =====
export const getTasks = () => api.get<Task[]>('/api/tasks/').then(r => r.data);
export const getTask = (id: string) => api.get<Task>(`/api/tasks/${id}`).then(r => r.data);
export const createTask = (data: {
  name: string; script: string; priority: number;
  cpu_requirement: number; memory_requirement: number;
  timeout: number; vm_id?: string;
}) => api.post<Task>('/api/tasks/', data).then(r => r.data);
export const deleteTask = (id: string) => api.delete(`/api/tasks/${id}`);

// ===== Metrics =====
export const getOverviewMetrics = () => api.get<OverviewMetrics>('/api/metrics/overview').then(r => r.data);
export const getMetricHistory = (entityId: string, limit = 30) =>
  api.get<MetricPoint[]>(`/api/metrics/history/${entityId}?limit=${limit}`).then(r => r.data);
export const getComputedMetrics = () => api.get<CloudMetrics>('/api/metrics/compute').then(r => r.data);

// ===== Scheduler =====
export const getSchedulerAlgorithms = () =>
  api.get<SchedulerAlgorithmInfo[]>('/api/scheduler/algorithms').then(r => r.data);
export const runScheduler = (algorithm: SchedulerAlgorithm, time_quantum?: number) =>
  api.post<ScheduleResult>('/api/scheduler/run', { algorithm, time_quantum }).then(r => r.data);
export const getSchedulerStatus = () => api.get('/api/scheduler/status').then(r => r.data);

// ===== Terminal =====
export const executeCommand = (vm_id: string, command: string) =>
  api.post('/api/terminal/execute', { vm_id, command }).then(r => r.data);

// ===== Research =====
export const getResearchReport = () => api.get<ResearchReport>('/api/research/report').then(r => r.data);
export const exportTasksCSV = () => `${API_BASE}/api/research/export/tasks/csv`;
export const exportInfraJSON = () => `${API_BASE}/api/research/export/infrastructure/json`;

export default api;
