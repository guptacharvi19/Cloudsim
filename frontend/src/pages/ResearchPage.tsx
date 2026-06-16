import React, { useEffect, useState } from 'react';
import { FlaskConical, Download, FileText, BarChart2, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell, Legend } from 'recharts';
import { getResearchReport, exportTasksCSV, exportInfraJSON } from '../utils/api';
import type { ResearchReport } from '../types';

const PIE_COLORS = ['#22c55e', '#eab308', '#0ea5e9', '#ef4444', '#a855f7'];

function StatRow({ label, value, unit, highlight }: { label: string; value: number | string; unit?: string; highlight?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '10px 0', borderBottom: '1px solid #1e3050', fontSize: 13,
    }}>
      <span style={{ color: '#94a3b8' }}>{label}</span>
      <span style={{ fontWeight: 700, color: highlight ? '#ef4444' : '#e2e8f0' }}>
        {typeof value === 'number' ? value.toFixed(2) : value}
        {unit && <span style={{ fontSize: 11, color: '#4a6580', marginLeft: 4 }}>{unit}</span>}
      </span>
    </div>
  );
}

export default function ResearchPage() {
  const [report, setReport] = useState<ResearchReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const r = await getResearchReport();
      setReport(r);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const refresh = () => { setRefreshing(true); load(); };

  if (loading) return <div className="loading"><div className="spinner" />Generating report...</div>;
  if (!report) return <div className="loading">Failed to load research data</div>;

  const { summary, performance_metrics: pm, recommendations } = report;

  // Radar chart data
  const radarData = [
    { metric: 'Throughput', value: Math.min(100, pm.throughput * 1000) },
    { metric: 'Utilization', value: pm.resource_utilization },
    { metric: 'Response', value: Math.max(0, 100 - pm.avg_response_time * 5) },
    { metric: 'SLA', value: Math.max(0, 100 - pm.sla_violations * 20) },
    { metric: 'Energy Eff', value: Math.max(0, 100 - pm.energy_consumption * 2) },
  ];

  // Pie chart for task status
  const pieData = Object.entries(summary.task_status_breakdown).map(([k, v]) => ({
    name: k, value: v,
  }));

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Research Mode</h1>
        <p className="page-subtitle">
          Experiment reports, performance metrics, and data exports
        </p>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={refresh} disabled={refreshing}>
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} /> Refresh Report
          </button>
          <a href={exportTasksCSV()} className="btn btn-secondary" download>
            <Download size={14} /> Export Tasks (CSV)
          </a>
          <a href={exportInfraJSON()} className="btn btn-secondary" download>
            <Download size={14} /> Export Infrastructure (JSON)
          </a>
        </div>
      </div>

      {/* Report timestamp */}
      <div style={{ fontSize: 12, color: '#4a6580', marginBottom: 20 }}>
        Report generated: {new Date(report.report_generated_at).toLocaleString()}
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total VMs', value: summary.total_vms, color: '#0ea5e9' },
          { label: 'Total Tasks', value: summary.total_tasks, color: '#22c55e' },
          { label: 'Completed', value: summary.task_status_breakdown.completed || 0, color: '#22c55e' },
          { label: 'Failed', value: summary.task_status_breakdown.failed || 0, color: '#ef4444' },
          { label: 'SLA Violations', value: pm.sla_violations, color: pm.sla_violations > 0 ? '#ef4444' : '#22c55e' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card" style={{ textAlign: 'center', padding: '14px 10px' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
            <div className="metric-label" style={{ marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      <div className="two-col" style={{ marginBottom: 20 }}>
        {/* Performance Metrics */}
        <div className="research-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <BarChart2 size={16} color="#0ea5e9" />
            <span style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 14 }}>Performance Metrics</span>
          </div>
          <StatRow label="Makespan" value={pm.makespan} unit="s" />
          <StatRow label="Throughput" value={pm.throughput} unit="tasks/s" />
          <StatRow label="Resource Utilization" value={pm.resource_utilization} unit="%" />
          <StatRow label="SLA Violations" value={pm.sla_violations} highlight={pm.sla_violations > 0} />
          <StatRow label="Energy Consumption" value={pm.energy_consumption} unit="kWh" />
          <StatRow label="Avg Waiting Time" value={pm.avg_waiting_time} unit="s" />
          <StatRow label="Avg Turnaround Time" value={pm.avg_turnaround_time} unit="s" />
          <StatRow label="Avg Response Time" value={pm.avg_response_time} unit="s" />
        </div>

        {/* Radar chart */}
        <div className="research-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <FlaskConical size={16} color="#a855f7" />
            <span style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 14 }}>System Performance Radar</span>
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#1e3050" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Radar name="Score" dataKey="value" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.2} strokeWidth={2} />
              <Tooltip
                contentStyle={{ background: '#111927', border: '1px solid #1e3050', borderRadius: 8, fontSize: 12 }}
                formatter={(v: any) => [`${Number(v).toFixed(1)}/100`]}
              />
            </RadarChart>
          </ResponsiveContainer>
          <div style={{ fontSize: 11, color: '#4a6580', textAlign: 'center' }}>
            Higher scores = better performance
          </div>
        </div>
      </div>

      {/* Task Status Distribution */}
      {pieData.length > 0 && (
        <div className="research-card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <FileText size={16} color="#22c55e" />
            <span style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 14 }}>Task Status Distribution</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            <ResponsiveContainer width={220} height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) =>
                  `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}
                  style={{ fontSize: 10, fill: '#94a3b8' }}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#111927', border: '1px solid #1e3050', borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pieData.map((d, i) => (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span style={{ color: '#94a3b8', textTransform: 'capitalize' }}>{d.name}</span>
                  <span style={{ marginLeft: 'auto', fontWeight: 600, color: '#e2e8f0' }}>{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recommendations */}
      <div className="research-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <AlertTriangle size={16} color="#eab308" />
          <span style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 14 }}>Auto-Generated Recommendations</span>
        </div>
        {recommendations.map((rec, i) => (
          <div key={i} className="rec-item">
            <CheckCircle size={14} color="#22c55e" style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{rec}</span>
          </div>
        ))}
      </div>

      {/* Export info */}
      <div style={{ marginTop: 20, padding: '14px 16px', background: '#080c14', borderRadius: 10, border: '1px solid #1e3050', fontSize: 13, color: '#94a3b8' }}>
        <div style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: 8 }}>📦 Export Formats</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div><strong style={{ color: '#0ea5e9' }}>CSV</strong> — Task metrics (waiting time, turnaround, response time, status) for spreadsheet analysis</div>
          <div><strong style={{ color: '#22c55e' }}>JSON</strong> — Full infrastructure snapshot including all hosts, VMs, and task records</div>
        </div>
      </div>
    </div>
  );
}
