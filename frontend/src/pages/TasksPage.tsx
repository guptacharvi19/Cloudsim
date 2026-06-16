import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, Zap, Clock, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { getTasks, createTask, deleteTask, getVMs } from '../utils/api';
import type { Task, VM } from '../types';

const SAMPLE_SCRIPTS: Record<string, string> = {
  hello: `# Hello World
print("Hello from CloudSim!")
print("Running on simulated VM")`,
  matrix: `# Matrix Multiplication
import time
import random

n = 50
A = [[random.random() for _ in range(n)] for _ in range(n)]
B = [[random.random() for _ in range(n)] for _ in range(n)]
C = [[sum(A[i][k]*B[k][j] for k in range(n)) for j in range(n)] for i in range(n)]
print(f"Matrix multiplication complete: {n}x{n}")
print(f"Result[0][0] = {C[0][0]:.4f}")`,
  cpu_stress: `# CPU Stress Test
import time
start = time.time()
result = 0
for i in range(1_000_000):
    result += i * i
elapsed = time.time() - start
print(f"Computed sum of squares: {result}")
print(f"Time: {elapsed:.3f}s")`,
  data_analysis: `# Data Analysis
import statistics
import random

data = [random.gauss(50, 15) for _ in range(1000)]
print(f"Count:  {len(data)}")
print(f"Mean:   {statistics.mean(data):.2f}")
print(f"Median: {statistics.median(data):.2f}")
print(f"Stdev:  {statistics.stdev(data):.2f}")
print(f"Min:    {min(data):.2f}")
print(f"Max:    {max(data):.2f}")`,
  sleep: `# Sleep Job
import time
print("Starting task...")
time.sleep(2)
print("Task completed after 2 seconds")`,
};

function StatusBadge({ status }: { status: string }) {
  const cls = status === 'running' ? 'badge-running-task' : `badge-${status}`;
  return <span className={`badge ${cls}`}>{status}</span>;
}

function CreateTaskModal({ vms, onClose, onCreated }: {
  vms: VM[]; onClose: () => void; onCreated: () => void;
}) {
  const [form, setForm] = useState({
    name: '', vm_id: '', script: SAMPLE_SCRIPTS.hello,
    priority: 1, cpu_requirement: 1.0, memory_requirement: 256, timeout: 30,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preset, setPreset] = useState('hello');

  const set = (k: string) => (e: React.ChangeEvent<any>) =>
    setForm(f => ({ ...f, [k]: e.target.type === 'number' ? Number(e.target.value) : e.target.value }));

  const applyPreset = (key: string) => {
    setPreset(key);
    setForm(f => ({ ...f, script: SAMPLE_SCRIPTS[key], name: f.name || key }));
  };

  const submit = async () => {
    if (!form.name.trim()) { setError('Task name is required'); return; }
    if (!form.script.trim()) { setError('Script is required'); return; }
    setLoading(true);
    try {
      await createTask({ ...form, vm_id: form.vm_id || undefined });
      onCreated(); onClose();
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to submit task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div className="modal-title"><Zap size={18} style={{ display: 'inline', marginRight: 8 }} />Submit Cloudlet</div>
        {error && <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 12, padding: '8px 10px', background: 'rgba(239,68,68,0.1)', borderRadius: 6 }}>{error}</div>}
        
        <div className="form-group">
          <label className="form-label">Quick Presets</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {Object.keys(SAMPLE_SCRIPTS).map(k => (
              <button key={k} className={`btn btn-sm ${preset === k ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => applyPreset(k)}>{k}</button>
            ))}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Task Name</label>
            <input className="form-input" value={form.name} onChange={set('name')} placeholder="e.g. MatrixJob-1" />
          </div>
          <div className="form-group">
            <label className="form-label">Target VM</label>
            <select className="form-select" value={form.vm_id} onChange={set('vm_id')}>
              <option value="">Auto-assign</option>
              {vms.filter(v => v.status === 'running').map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Python Script</label>
          <textarea className="form-textarea" rows={8} value={form.script}
            onChange={e => setForm(f => ({ ...f, script: e.target.value }))} />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Priority (1-5)</label>
            <input className="form-input" type="number" min={1} max={5} value={form.priority} onChange={set('priority')} />
          </div>
          <div className="form-group">
            <label className="form-label">Timeout (sec)</label>
            <input className="form-input" type="number" min={5} max={300} value={form.timeout} onChange={set('timeout')} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">CPU Req (cores)</label>
            <input className="form-input" type="number" min={0.1} max={16} step={0.5} value={form.cpu_requirement} onChange={set('cpu_requirement')} />
          </div>
          <div className="form-group">
            <label className="form-label">Memory Req (MB)</label>
            <input className="form-input" type="number" min={64} step={64} value={form.memory_requirement} onChange={set('memory_requirement')} />
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={loading}>
            {loading ? 'Submitting...' : 'Submit Task'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TaskDetail({ task, onClose }: { task: Task; onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
        <div className="modal-title">Task: {task.name}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16, fontSize: 13 }}>
          {[
            ['Status', task.status], ['Priority', task.priority], ['VM', task.vm_id || 'Auto'],
            ['Timeout', `${task.timeout}s`], ['CPU Req', `${task.cpu_requirement} cores`],
            ['Mem Req', `${task.memory_requirement} MB`],
            ['Waiting Time', task.waiting_time != null ? `${task.waiting_time.toFixed(2)}s` : '—'],
            ['Turnaround', task.turnaround_time != null ? `${task.turnaround_time.toFixed(2)}s` : '—'],
            ['Response', task.response_time != null ? `${task.response_time.toFixed(2)}s` : '—'],
          ].map(([k, v]) => (
            <div key={String(k)} style={{ borderBottom: '1px solid #1e3050', paddingBottom: 6 }}>
              <div style={{ fontSize: 11, color: '#4a6580', marginBottom: 2 }}>{k}</div>
              <div style={{ color: '#e2e8f0' }}>{String(v)}</div>
            </div>
          ))}
        </div>
        <div className="form-group">
          <label className="form-label">Script</label>
          <pre className="code-block">{task.script}</pre>
        </div>
        {task.output && (
          <div className="form-group">
            <label className="form-label">Output</label>
            <pre className="code-block" style={{ color: '#22c55e' }}>{task.output}</pre>
          </div>
        )}
        {task.error && (
          <div className="form-group">
            <label className="form-label">Error</label>
            <pre className="code-block" style={{ color: '#ef4444' }}>{task.error}</pre>
          </div>
        )}
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [vms, setVMs] = useState<VM[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const load = useCallback(async () => {
    const [t, v] = await Promise.all([getTasks(), getVMs()]);
    setTasks(t); setVMs(v); setLoading(false);
  }, []);

  useEffect(() => { load(); const id = setInterval(load, 3000); return () => clearInterval(id); }, [load]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this task?')) return;
    await deleteTask(id); await load();
  };

  if (loading) return <div className="loading"><div className="spinner" />Loading tasks...</div>;

  const statusCounts = tasks.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1; return acc;
  }, {} as Record<string, number>);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Cloudlets / Tasks</h1>
        <p className="page-subtitle">Submit and monitor cloud tasks with real Python execution</p>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> Submit Task
          </button>
          <button className="btn btn-secondary" onClick={load}><RefreshCw size={14} /> Refresh</button>
        </div>
      </div>

      {showCreate && <CreateTaskModal vms={vms} onClose={() => setShowCreate(false)} onCreated={load} />}
      {selectedTask && <TaskDetail task={selectedTask} onClose={() => setSelectedTask(null)} />}

      {/* Status Summary */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {['pending', 'queued', 'running', 'completed', 'failed'].map(s => (
          <div key={s} className="card" style={{ padding: '10px 16px', flexGrow: 1, minWidth: 100 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0' }}>{statusCounts[s] || 0}</div>
            <div className="metric-label" style={{ marginTop: 2 }}>{s}</div>
          </div>
        ))}
      </div>

      <div className="table-container">
        <div className="table-header-row">
          <span className="table-title">Task Queue ({tasks.length})</span>
        </div>
        {tasks.length === 0 ? (
          <div className="empty-state">
            <Zap size={40} opacity={0.3} />
            <div className="empty-state-title">No tasks submitted</div>
            <div className="empty-state-sub">Submit a cloudlet to start processing</div>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th><th>Name</th><th>Status</th><th>VM</th>
                <th>Priority</th><th>Waiting</th><th>Turnaround</th><th>Submitted</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(t => (
                <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedTask(t)}>
                  <td><code style={{ fontSize: 11, color: '#0ea5e9' }}>{t.id}</code></td>
                  <td style={{ fontWeight: 600, color: '#e2e8f0' }}>{t.name}</td>
                  <td onClick={e => e.stopPropagation()}><StatusBadge status={t.status} /></td>
                  <td>{t.vm_id || '—'}</td>
                  <td>
                    <span style={{ color: t.priority >= 4 ? '#ef4444' : t.priority >= 3 ? '#eab308' : '#94a3b8' }}>
                      P{t.priority}
                    </span>
                  </td>
                  <td>{t.waiting_time != null ? `${t.waiting_time.toFixed(2)}s` : '—'}</td>
                  <td>{t.turnaround_time != null ? `${t.turnaround_time.toFixed(2)}s` : '—'}</td>
                  <td style={{ fontSize: 11 }}>{new Date(t.submitted_at).toLocaleTimeString()}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(t.id)}>
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
