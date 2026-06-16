import React, { useEffect, useState, useCallback } from 'react';
import { Server, Cpu, HardDrive, Zap, Activity, Database, Cloud, Monitor } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { getOverviewMetrics } from '../utils/api';
import type { OverviewMetrics } from '../types';

interface SparkData { time: string; cpu: number; ram: number; }

const COLORS = {
  accent: '#0ea5e9',
  green: '#22c55e',
  yellow: '#eab308',
  purple: '#a855f7',
};

function MetricCard({ label, value, sub, icon: Icon, color, pct }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string; pct?: number;
}) {
  return (
    <div className="metric-card">
      <div className="metric-header">
        <span className="metric-label">{label}</span>
        <Icon size={16} className="metric-icon" style={{ color }} />
      </div>
      <div className="metric-value" style={{ color }}>{value}</div>
      {sub && <div className="metric-sub">{sub}</div>}
      {pct !== undefined && (
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{
              width: `${Math.min(100, pct)}%`,
              background: pct > 80 ? '#ef4444' : pct > 60 ? '#eab308' : color,
            }}
          />
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [history, setHistory] = useState<SparkData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = useCallback(async () => {
    try {
      const data = await getOverviewMetrics();
      setMetrics(data);
      setHistory(prev => {
        const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const next = [...prev, { time: now, cpu: data.cpu_usage_pct, ram: data.ram_usage_pct }];
        return next.slice(-20);
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    const id = setInterval(fetchMetrics, 3000);
    return () => clearInterval(id);
  }, [fetchMetrics]);

  if (loading) return <div className="loading"><div className="spinner" /><span>Loading dashboard...</span></div>;
  if (!metrics) return <div className="loading">Failed to load metrics</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Real-time overview of your cloud infrastructure</p>
      </div>

      <div className="metrics-grid">
        <MetricCard
          label="Running VMs"
          value={metrics.running_vms}
          sub={`${metrics.total_vms} total`}
          icon={Server}
          color={COLORS.accent}
        />
        <MetricCard
          label="CPU Usage"
          value={`${metrics.cpu_usage_pct}%`}
          sub={`${metrics.total_cpu_cores} cores total`}
          icon={Cpu}
          color={metrics.cpu_usage_pct > 80 ? '#ef4444' : COLORS.green}
          pct={metrics.cpu_usage_pct}
        />
        <MetricCard
          label="RAM Usage"
          value={`${metrics.ram_usage_pct}%`}
          sub={`${metrics.total_ram_gb} GB total`}
          icon={Activity}
          color={metrics.ram_usage_pct > 80 ? '#ef4444' : COLORS.accent}
          pct={metrics.ram_usage_pct}
        />
        <MetricCard
          label="Storage"
          value={`${metrics.storage_usage_pct}%`}
          sub={`${metrics.total_storage_tb} TB total`}
          icon={HardDrive}
          color={COLORS.purple}
          pct={metrics.storage_usage_pct}
        />
        <MetricCard
          label="Active Tasks"
          value={metrics.running_tasks}
          sub={`${metrics.completed_tasks} completed`}
          icon={Zap}
          color={COLORS.yellow}
        />
        <MetricCard
          label="Hosts Online"
          value={metrics.total_hosts}
          icon={Database}
          color={COLORS.green}
        />
      </div>

      {/* Live CPU/RAM Chart */}
      <div className="chart-container">
        <div className="chart-title">Real-Time Resource Utilization</div>
        {history.length > 1 ? (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={history} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="cpu" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.accent} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLORS.accent} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="ram" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.green} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLORS.green} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#4a6580' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#4a6580' }} />
              <Tooltip
                contentStyle={{ background: '#111927', border: '1px solid #1e3050', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Area type="monotone" dataKey="cpu" stroke={COLORS.accent} fill="url(#cpu)" name="CPU %" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="ram" stroke={COLORS.green} fill="url(#ram)" name="RAM %" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a6580' }}>
            Collecting metrics...
          </div>
        )}
        <div style={{ display: 'flex', gap: 20, marginTop: 8, fontSize: 12 }}>
          <span style={{ color: COLORS.accent }}>■ CPU Usage</span>
          <span style={{ color: COLORS.green }}>■ RAM Usage</span>
        </div>
      </div>

      {/* System Summary */}
      <div className="two-col" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="card-title"><Cloud size={16} />Infrastructure Summary</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              ['Total CPU Cores', `${metrics.total_cpu_cores} vCPUs`],
              ['Total Memory', `${metrics.total_ram_gb} GB`],
              ['Total Storage', `${metrics.total_storage_tb} TB`],
              ['Active Hosts', `${metrics.total_hosts}`],
              ['Virtual Machines', `${metrics.total_vms}`],
            ].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid #1e3050', paddingBottom: 8 }}>
                <span style={{ color: '#94a3b8' }}>{label}</span>
                <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{val}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-title"><Monitor size={16} />VM Performance</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                <span style={{ color: '#94a3b8' }}>Avg CPU Usage</span>
                <span style={{ color: COLORS.accent }}>{metrics.avg_vm_cpu}%</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill progress-blue" style={{ width: `${metrics.avg_vm_cpu}%` }} />
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                <span style={{ color: '#94a3b8' }}>Avg RAM Usage</span>
                <span style={{ color: COLORS.green }}>{metrics.avg_vm_ram}%</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill progress-green" style={{ width: `${metrics.avg_vm_ram}%` }} />
              </div>
            </div>
            <div style={{ marginTop: 8, padding: '10px', background: '#080c14', borderRadius: 6, fontSize: 12, color: '#4a6580' }}>
              💡 Metrics update every 3 seconds to simulate live cloud telemetry.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
