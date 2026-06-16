import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, Play, Square, ArrowRightLeft, Server, RefreshCw } from 'lucide-react';
import { getVMs, createVM, deleteVM, startVM, stopVM, getHosts } from '../utils/api';
import type { VM, Host } from '../types';

const OS_OPTIONS = ['ubuntu-22.04', 'ubuntu-20.04', 'debian-11', 'centos-9', 'alpine-3.18', 'windows-server-2022'];

function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-${status}`}>{status}</span>;
}

function CreateVMModal({ hosts, onClose, onCreated }: {
  hosts: Host[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    name: '', cpu_cores: 2, ram_mb: 2048, storage_gb: 20,
    os_image: 'ubuntu-22.04', host_id: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string) => (e: React.ChangeEvent<any>) =>
    setForm(f => ({ ...f, [k]: e.target.type === 'number' ? Number(e.target.value) : e.target.value }));

  const submit = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setLoading(true);
    try {
      await createVM({ ...form, host_id: form.host_id || undefined });
      onCreated();
      onClose();
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to create VM');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title"><Server size={18} style={{ display: 'inline', marginRight: 8 }} />Create Virtual Machine</div>
        {error && <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 12, padding: '8px 10px', background: 'rgba(239,68,68,0.1)', borderRadius: 6 }}>{error}</div>}
        <div className="form-group">
          <label className="form-label">VM Name</label>
          <input className="form-input" value={form.name} onChange={set('name')} placeholder="e.g. WebServer-1" />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">CPU Cores</label>
            <input className="form-input" type="number" min={1} max={32} value={form.cpu_cores} onChange={set('cpu_cores')} />
          </div>
          <div className="form-group">
            <label className="form-label">RAM (MB)</label>
            <input className="form-input" type="number" min={512} step={512} value={form.ram_mb} onChange={set('ram_mb')} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Storage (GB)</label>
            <input className="form-input" type="number" min={5} value={form.storage_gb} onChange={set('storage_gb')} />
          </div>
          <div className="form-group">
            <label className="form-label">OS Image</label>
            <select className="form-select" value={form.os_image} onChange={set('os_image')}>
              {OS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Host (optional — auto-assigned if empty)</label>
          <select className="form-select" value={form.host_id} onChange={set('host_id')}>
            <option value="">Auto-select best host</option>
            {hosts.map(h => (
              <option key={h.id} value={h.id}>{h.name} ({h.cpu_cores} CPU, {Math.round(h.ram_mb / 1024)}GB RAM)</option>
            ))}
          </select>
        </div>
        <div style={{ fontSize: 12, color: '#4a6580', marginTop: 4 }}>
          💡 Resources: {form.cpu_cores} vCPUs · {Math.round(form.ram_mb / 1024)} GB RAM · {form.storage_gb} GB storage
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={loading}>
            {loading ? 'Creating...' : 'Create VM'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VirtualMachines() {
  const [vms, setVMs] = useState<VM[]>([]);
  const [hosts, setHosts] = useState<Host[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [v, h] = await Promise.all([getVMs(), getHosts()]);
    setVMs(v); setHosts(h); setLoading(false);
  }, []);

  useEffect(() => { load(); const id = setInterval(load, 5000); return () => clearInterval(id); }, [load]);

  const handleStart = async (id: string) => {
    setActionLoading(id);
    try { await startVM(id); await load(); } finally { setActionLoading(null); }
  };

  const handleStop = async (id: string) => {
    setActionLoading(id);
    try { await stopVM(id); await load(); } finally { setActionLoading(null); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete VM "${name}"?`)) return;
    setActionLoading(id);
    try { await deleteVM(id); await load(); } finally { setActionLoading(null); }
  };

  const getHostName = (hostId: string | null) => {
    if (!hostId) return '—';
    return hosts.find(h => h.id === hostId)?.name || hostId;
  };

  if (loading) return <div className="loading"><div className="spinner" />Loading VMs...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Virtual Machines</h1>
        <p className="page-subtitle">Create, manage, and monitor your VMs</p>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> New VM
          </button>
          <button className="btn btn-secondary" onClick={load}><RefreshCw size={14} /> Refresh</button>
        </div>
      </div>

      {showCreate && (
        <CreateVMModal hosts={hosts} onClose={() => setShowCreate(false)} onCreated={load} />
      )}

      <div className="table-container">
        <div className="table-header-row">
          <span className="table-title">All Virtual Machines ({vms.length})</span>
        </div>
        {vms.length === 0 ? (
          <div className="empty-state">
            <Server size={40} opacity={0.3} />
            <div className="empty-state-title">No VMs yet</div>
            <div className="empty-state-sub">Create your first VM to get started</div>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th><th>Name</th><th>Status</th><th>Host</th>
                <th>CPU</th><th>RAM</th><th>Storage</th><th>OS</th>
                <th>CPU Usage</th><th>RAM Usage</th><th>IP</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {vms.map(vm => (
                <tr key={vm.id}>
                  <td><code style={{ fontSize: 11, color: '#0ea5e9' }}>{vm.id}</code></td>
                  <td style={{ fontWeight: 600, color: '#e2e8f0' }}>{vm.name}</td>
                  <td><StatusBadge status={vm.status} /></td>
                  <td>{getHostName(vm.host_id)}</td>
                  <td>{vm.cpu_cores} vCPU</td>
                  <td>{Math.round(vm.ram_mb / 1024)} GB</td>
                  <td>{vm.storage_gb} GB</td>
                  <td><span style={{ fontSize: 11 }}>{vm.os_image}</span></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 50, background: '#080c14', height: 4, borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${vm.cpu_usage}%`, background: '#0ea5e9', height: '100%' }} />
                      </div>
                      <span style={{ fontSize: 11 }}>{vm.cpu_usage.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 50, background: '#080c14', height: 4, borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${vm.ram_usage}%`, background: '#22c55e', height: '100%' }} />
                      </div>
                      <span style={{ fontSize: 11 }}>{vm.ram_usage.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td><code style={{ fontSize: 11 }}>{vm.ip_address || '—'}</code></td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {vm.status === 'stopped' && (
                        <button className="btn btn-ghost btn-sm" onClick={() => handleStart(vm.id)}
                          disabled={actionLoading === vm.id} data-tooltip="Start VM">
                          <Play size={13} />
                        </button>
                      )}
                      {vm.status === 'running' && (
                        <button className="btn btn-ghost btn-sm" onClick={() => handleStop(vm.id)}
                          disabled={actionLoading === vm.id} data-tooltip="Stop VM">
                          <Square size={13} />
                        </button>
                      )}
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(vm.id, vm.name)}
                        disabled={actionLoading === vm.id} data-tooltip="Delete VM">
                        <Trash2 size={13} />
                      </button>
                    </div>
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
