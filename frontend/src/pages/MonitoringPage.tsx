import React, { useEffect, useState, useCallback } from 'react';
import { Activity, Server, Cpu, HardDrive, Wifi } from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, BarChart, Bar
} from 'recharts';
import { getVMs, getHosts, getMetricHistory, getOverviewMetrics } from '../utils/api';
import type { VM, Host, MetricPoint } from '../types';

const COLORS = ['#0ea5e9', '#22c55e', '#a855f7', '#f97316', '#eab308', '#ef4444'];

function LiveBadge() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11,
      color: '#22c55e', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)',
      padding: '2px 8px', borderRadius: 4 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', animation: 'pulse 1.5s infinite' }} />
      LIVE
    </span>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '10px 14px', background: '#080c14', borderRadius: 8, minWidth: 100 }}>
      <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: '#4a6580', marginTop: 2 }}>{label}</div>
    </div>
  );
}

export default function MonitoringPage() {
  const [vms, setVMs] = useState<VM[]>([]);
  const [hosts, setHosts] = useState<Host[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<string>('');
  const [entityType, setEntityType] = useState<'vm' | 'host'>('host');
  const [history, setHistory] = useState<MetricPoint[]>([]);
  const [overview, setOverview] = useState<any>(null);
  const [tab, setTab] = useState<'realtime' | 'vms' | 'hosts'>('realtime');

  // Multi-VM chart data (last point for each VM)
  const [vmSnapshots, setVMSnapshots] = useState<Array<{ name: string; cpu: number; ram: number }>>([]);

  const loadBase = useCallback(async () => {
    const [v, h, ov] = await Promise.all([getVMs(), getHosts(), getOverviewMetrics()]);
    setVMs(v); setHosts(h); setOverview(ov);

    // Build snapshot for bar chart
    setVMSnapshots(v.filter(vm => vm.status === 'running').map(vm => ({
      name: vm.name.slice(0, 10),
      cpu: Math.round(vm.cpu_usage),
      ram: Math.round(vm.ram_usage),
    })));

    // Auto-select first host
    if (!selectedEntity && h.length > 0) {
      setSelectedEntity(h[0].id);
      setEntityType('host');
    }
  }, [selectedEntity]);

  const loadHistory = useCallback(async () => {
    if (!selectedEntity) return;
    const data = await getMetricHistory(selectedEntity, 30);
    setHistory(data);
  }, [selectedEntity]);

  useEffect(() => {
    loadBase();
    loadHistory();
    const id1 = setInterval(loadBase, 3000);
    const id2 = setInterval(loadHistory, 3000);
    return () => { clearInterval(id1); clearInterval(id2); };
  }, [loadBase, loadHistory]);

  const tooltipStyle = {
    contentStyle: { background: '#111927', border: '1px solid #1e3050', borderRadius: 8, fontSize: 12 },
    labelStyle: { color: '#94a3b8' },
  };

  const currentMetric = history[history.length - 1];

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <h1 className="page-title">Monitoring</h1>
            <p className="page-subtitle">Real-time resource telemetry across your cloud infrastructure</p>
          </div>
          <LiveBadge />
        </div>
      </div>

      <div className="tabs">
        {[
          { id: 'realtime', label: 'Real-Time Charts' },
          { id: 'vms', label: 'VM Comparison' },
          { id: 'hosts', label: 'Host Overview' },
        ].map(t => (
          <button key={t.id} className={`tab ${tab === t.id ? 'tab-active' : ''}`}
            onClick={() => setTab(t.id as any)}>{t.label}</button>
        ))}
      </div>

      {tab === 'realtime' && (
        <>
          {/* Entity selector */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#4a6580' }}>Hosts:</span>
              {hosts.map((h, i) => (
                <button key={h.id}
                  className={`btn btn-sm ${selectedEntity === h.id ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => { setSelectedEntity(h.id); setEntityType('host'); }}>
                  {h.name}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#4a6580' }}>VMs:</span>
              {vms.filter(v => v.status === 'running').map(v => (
                <button key={v.id}
                  className={`btn btn-sm ${selectedEntity === v.id ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => { setSelectedEntity(v.id); setEntityType('vm'); }}>
                  {v.name}
                </button>
              ))}
            </div>
          </div>

          {/* Current stats */}
          {currentMetric && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              <MiniStat label="CPU" value={`${currentMetric.cpu_usage.toFixed(1)}%`} color="#0ea5e9" />
              <MiniStat label="RAM" value={`${currentMetric.ram_usage.toFixed(1)}%`} color="#22c55e" />
              <MiniStat label="Net RX" value={`${currentMetric.network_rx.toFixed(1)} MB/s`} color="#a855f7" />
              <MiniStat label="Net TX" value={`${currentMetric.network_tx.toFixed(1)} MB/s`} color="#f97316" />
              <MiniStat label="Disk R" value={`${currentMetric.disk_read.toFixed(1)} MB/s`} color="#eab308" />
              <MiniStat label="Disk W" value={`${currentMetric.disk_write.toFixed(1)} MB/s`} color="#ef4444" />
            </div>
          )}

          {/* CPU + RAM chart */}
          <div className="chart-container">
            <div className="chart-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>CPU & RAM Utilization — {selectedEntity}</span>
              <span style={{ fontSize: 11, color: '#4a6580' }}>Last {history.length} samples</span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={history} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gCPU" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gRAM" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" tick={{ fontSize: 9, fill: '#4a6580' }}
                  tickFormatter={v => new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#4a6580' }} unit="%" />
                <Tooltip {...tooltipStyle} formatter={(v: any, n: string) => [`${Number(v).toFixed(1)}%`, n]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="cpu_usage" name="CPU %" stroke="#0ea5e9" fill="url(#gCPU)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="ram_usage" name="RAM %" stroke="#22c55e" fill="url(#gRAM)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Network chart */}
          <div className="chart-container">
            <div className="chart-title">Network I/O (MB/s)</div>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={history} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" tick={{ fontSize: 9, fill: '#4a6580' }}
                  tickFormatter={v => new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} />
                <YAxis tick={{ fontSize: 10, fill: '#4a6580' }} />
                <Tooltip {...tooltipStyle} formatter={(v: any) => [`${Number(v).toFixed(2)} MB/s`]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="network_rx" name="RX" stroke="#a855f7" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="network_tx" name="TX" stroke="#f97316" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Disk chart */}
          <div className="chart-container">
            <div className="chart-title">Disk I/O (MB/s)</div>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={history} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" tick={{ fontSize: 9, fill: '#4a6580' }}
                  tickFormatter={v => new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} />
                <YAxis tick={{ fontSize: 10, fill: '#4a6580' }} />
                <Tooltip {...tooltipStyle} formatter={(v: any) => [`${Number(v).toFixed(2)} MB/s`]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="disk_read" name="Read" stroke="#eab308" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="disk_write" name="Write" stroke="#ef4444" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {tab === 'vms' && (
        <>
          <div className="chart-container">
            <div className="chart-title">VM CPU & RAM Comparison (Running VMs)</div>
            {vmSnapshots.length === 0 ? (
              <div className="empty-state" style={{ padding: 40 }}>No running VMs</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={vmSnapshots} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#4a6580' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#4a6580' }} unit="%" />
                  <Tooltip {...tooltipStyle} formatter={(v: any) => [`${v}%`]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="cpu" name="CPU %" fill="#0ea5e9" radius={[4, 4, 0, 0]} opacity={0.85} />
                  <Bar dataKey="ram" name="RAM %" fill="#22c55e" radius={[4, 4, 0, 0]} opacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="table-container">
            <div className="table-header-row"><span className="table-title">VM Resource Details</span></div>
            <table>
              <thead>
                <tr><th>VM</th><th>Status</th><th>CPU Cores</th><th>RAM</th><th>CPU Usage</th><th>RAM Usage</th><th>IP</th></tr>
              </thead>
              <tbody>
                {vms.map(vm => (
                  <tr key={vm.id}>
                    <td style={{ fontWeight: 600, color: '#e2e8f0' }}>{vm.name}</td>
                    <td><span className={`badge badge-${vm.status}`}>{vm.status}</span></td>
                    <td>{vm.cpu_cores}</td>
                    <td>{Math.round(vm.ram_mb / 1024)} GB</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 60, height: 4, background: '#080c14', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ width: `${vm.cpu_usage}%`, background: '#0ea5e9', height: '100%' }} />
                        </div>
                        <span style={{ fontSize: 11 }}>{vm.cpu_usage.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 60, height: 4, background: '#080c14', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ width: `${vm.ram_usage}%`, background: '#22c55e', height: '100%' }} />
                        </div>
                        <span style={{ fontSize: 11 }}>{vm.ram_usage.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td><code style={{ fontSize: 11 }}>{vm.ip_address || '—'}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'hosts' && (
        <div className="table-container">
          <div className="table-header-row"><span className="table-title">Host Overview</span></div>
          <table>
            <thead>
              <tr><th>Host</th><th>Status</th><th>CPU Cores</th><th>CPU Used</th><th>RAM (GB)</th><th>RAM Used</th><th>Storage</th><th>VMs</th></tr>
            </thead>
            <tbody>
              {hosts.map(h => {
                const cpuPct = ((h.cpu_used / Math.max(1, h.cpu_cores)) * 100).toFixed(1);
                const ramPct = ((h.ram_used / Math.max(1, h.ram_mb)) * 100).toFixed(1);
                const vmCount = vms.filter(v => v.host_id === h.id).length;
                return (
                  <tr key={h.id}>
                    <td style={{ fontWeight: 600, color: '#e2e8f0' }}>{h.name}</td>
                    <td><span className={`badge ${h.is_online ? 'badge-online' : 'badge-offline'}`}>{h.is_online ? 'online' : 'offline'}</span></td>
                    <td>{h.cpu_cores}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 60, height: 4, background: '#080c14', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ width: `${cpuPct}%`, background: '#0ea5e9', height: '100%' }} />
                        </div>
                        <span style={{ fontSize: 11 }}>{cpuPct}%</span>
                      </div>
                    </td>
                    <td>{Math.round(h.ram_mb / 1024)}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 60, height: 4, background: '#080c14', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ width: `${ramPct}%`, background: '#22c55e', height: '100%' }} />
                        </div>
                        <span style={{ fontSize: 11 }}>{ramPct}%</span>
                      </div>
                    </td>
                    <td>{h.storage_gb} GB</td>
                    <td><span style={{ background: '#1a2840', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>{vmCount}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
