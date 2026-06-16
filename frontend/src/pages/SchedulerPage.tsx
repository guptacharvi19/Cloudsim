import React, { useEffect, useState, useCallback } from 'react';
import { Cpu, Play, Info, CheckCircle, Clock, ArrowRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { getSchedulerAlgorithms, runScheduler, getComputedMetrics, getTasks } from '../utils/api';
import type { SchedulerAlgorithmInfo, ScheduleResult, CloudMetrics, Task, SchedulerAlgorithm } from '../types';

const ALGO_COLORS: Record<string, string> = {
  fcfs: '#0ea5e9',
  round_robin: '#a855f7',
  priority: '#f97316',
  min_min: '#22c55e',
  max_min: '#eab308',
};

function AlgoCard({ algo, selected, onClick }: {
  algo: SchedulerAlgorithmInfo;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <div className={`algo-card ${selected ? 'selected' : ''}`} onClick={onClick}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div className="algo-name">{algo.name.split('(')[0].trim()}</div>
        {selected && <CheckCircle size={14} color="#0ea5e9" />}
      </div>
      <div className="algo-desc">{algo.description}</div>
      <div className="algo-complexity">Complexity: {algo.complexity}</div>
    </div>
  );
}

function MetricBox({ label, value, unit, color }: { label: string; value: number | string; unit?: string; color?: string }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '14px 10px' }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || '#e2e8f0' }}>
        {typeof value === 'number' ? value.toFixed(2) : value}
        {unit && <span style={{ fontSize: 13, color: '#94a3b8', marginLeft: 4 }}>{unit}</span>}
      </div>
      <div className="metric-label" style={{ marginTop: 4 }}>{label}</div>
    </div>
  );
}

export default function SchedulerPage() {
  const [algorithms, setAlgorithms] = useState<SchedulerAlgorithmInfo[]>([]);
  const [selected, setSelected] = useState<SchedulerAlgorithm>('fcfs');
  const [timeQuantum, setTimeQuantum] = useState(2);
  const [result, setResult] = useState<ScheduleResult | null>(null);
  const [metrics, setMetrics] = useState<CloudMetrics | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [running, setRunning] = useState(false);
  const [tab, setTab] = useState<'config' | 'result' | 'metrics'>('config');

  const load = useCallback(async () => {
    const [algos, m, t] = await Promise.all([
      getSchedulerAlgorithms(), getComputedMetrics(), getTasks()
    ]);
    setAlgorithms(algos);
    setMetrics(m);
    setTasks(t);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRun = async () => {
    setRunning(true);
    try {
      const res = await runScheduler(selected, timeQuantum);
      setResult(res);
      await load();
      setTab('result');
    } catch (e) {
      console.error(e);
    } finally {
      setRunning(false);
    }
  };

  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const queuedTasks = tasks.filter(t => t.status === 'queued');

  // Chart data for turnaround comparison
  const chartData = result?.scheduled?.slice(0, 10).map((s, i) => ({
    name: s.task_name.slice(0, 8),
    order: s.order,
    ct: s.completion_time || (i + 1) * 1.5,
  })) || [];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Task Scheduler</h1>
        <p className="page-subtitle">Select a scheduling algorithm and assign tasks to VMs</p>
      </div>

      {/* Tab Bar */}
      <div className="tabs">
        {[
          { id: 'config', label: 'Configuration' },
          { id: 'result', label: `Results ${result ? `(${result.scheduled?.length || 0})` : ''}` },
          { id: 'metrics', label: 'Performance Metrics' },
        ].map(t => (
          <button key={t.id} className={`tab ${tab === t.id ? 'tab-active' : ''}`}
            onClick={() => setTab(t.id as any)}>{t.label}</button>
        ))}
      </div>

      {tab === 'config' && (
        <>
          {/* Task Queue Status */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            <div className="card" style={{ flexGrow: 1, padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={16} color="#eab308" />
                <span style={{ color: '#94a3b8', fontSize: 13 }}>Pending Tasks</span>
                <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: 20, color: '#eab308' }}>{pendingTasks.length}</span>
              </div>
            </div>
            <div className="card" style={{ flexGrow: 1, padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ArrowRight size={16} color="#a855f7" />
                <span style={{ color: '#94a3b8', fontSize: 13 }}>Queued Tasks</span>
                <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: 20, color: '#a855f7' }}>{queuedTasks.length}</span>
              </div>
            </div>
            <div className="card" style={{ flexGrow: 1, padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle size={16} color="#22c55e" />
                <span style={{ color: '#94a3b8', fontSize: 13 }}>Completed</span>
                <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: 20, color: '#22c55e' }}>
                  {tasks.filter(t => t.status === 'completed').length}
                </span>
              </div>
            </div>
          </div>

          {/* Algorithm Selection */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-title"><Cpu size={16} />Select Scheduling Algorithm</div>
            <div className="algo-grid">
              {algorithms.map(algo => (
                <AlgoCard key={algo.id} algo={algo} selected={selected === algo.id}
                  onClick={() => setSelected(algo.id)} />
              ))}
            </div>

            {selected === 'round_robin' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, padding: '12px 16px', background: '#080c14', borderRadius: 8, maxWidth: 300 }}>
                <label className="form-label" style={{ marginBottom: 0, whiteSpace: 'nowrap' }}>Time Quantum (s)</label>
                <input className="form-input" type="number" min={1} max={10} value={timeQuantum}
                  onChange={e => setTimeQuantum(Number(e.target.value))} style={{ width: 80 }} />
              </div>
            )}
          </div>

          {/* Educational Explainer */}
          <div className="card" style={{ marginBottom: 20, borderColor: '#1a3050' }}>
            <div className="card-title"><Info size={16} />How it works</div>
            {selected === 'fcfs' && (
              <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.7 }}>
                <strong style={{ color: '#e2e8f0' }}>First Come First Serve (FCFS)</strong> processes tasks in arrival order.
                Tasks are assigned to VMs sequentially — the first task submitted is the first to run.
                Simple and fair, but long tasks can block shorter ones (convoy effect).
                <div style={{ marginTop: 8, fontFamily: 'monospace', fontSize: 12, color: '#4a6580', background: '#050810', padding: 10, borderRadius: 6 }}>
                  Queue: [T1, T2, T3, T4] → VM1: T1→T3, VM2: T2→T4
                </div>
              </div>
            )}
            {selected === 'round_robin' && (
              <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.7 }}>
                <strong style={{ color: '#e2e8f0' }}>Round Robin</strong> gives each task a fixed time quantum cyclically.
                Tasks rotate across VMs, ensuring no single task monopolizes resources.
                Best for time-sharing environments with equal priority tasks.
                <div style={{ marginTop: 8, fontFamily: 'monospace', fontSize: 12, color: '#4a6580', background: '#050810', padding: 10, borderRadius: 6 }}>
                  Quantum={timeQuantum}s → VM1: T1, VM2: T2, VM1: T3, VM2: T4...
                </div>
              </div>
            )}
            {selected === 'priority' && (
              <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.7 }}>
                <strong style={{ color: '#e2e8f0' }}>Priority Scheduling</strong> assigns high-priority tasks to
                the fastest VMs first. Priority 5 tasks preempt lower-priority ones.
                Risk: low-priority tasks may starve if high-priority tasks keep arriving.
                <div style={{ marginTop: 8, fontFamily: 'monospace', fontSize: 12, color: '#4a6580', background: '#050810', padding: 10, borderRadius: 6 }}>
                  Sort by priority DESC → assign to VMs sorted by CPU cores DESC
                </div>
              </div>
            )}
            {selected === 'min_min' && (
              <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.7 }}>
                <strong style={{ color: '#e2e8f0' }}>Min-Min</strong> finds the task with the <em>minimum</em> completion
                time on its best VM and schedules it first. Favors short tasks, minimizing
                average completion time. Good when most tasks are similar in size.
                <div style={{ marginTop: 8, fontFamily: 'monospace', fontSize: 12, color: '#4a6580', background: '#050810', padding: 10, borderRadius: 6 }}>
                  CT(task,vm) = cpu_req / vm_cores × 10s → pick min CT globally
                </div>
              </div>
            )}
            {selected === 'max_min' && (
              <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.7 }}>
                <strong style={{ color: '#e2e8f0' }}>Max-Min</strong> schedules the task with the <em>maximum</em>
                completion time on its best VM first. Prioritizes long tasks so they finish
                earlier, reducing overall makespan when task sizes vary widely.
                <div style={{ marginTop: 8, fontFamily: 'monospace', fontSize: 12, color: '#4a6580', background: '#050810', padding: 10, borderRadius: 6 }}>
                  CT(task,vm) = cpu_req / vm_cores × 10s → pick max CT globally
                </div>
              </div>
            )}
          </div>

          <button className="btn btn-primary" onClick={handleRun} disabled={running || pendingTasks.length === 0}
            style={{ fontSize: 15, padding: '10px 28px' }}>
            <Play size={16} />
            {running ? 'Scheduling...' : pendingTasks.length === 0
              ? 'No pending tasks (submit some first)'
              : `Run ${algorithms.find(a => a.id === selected)?.name.split('(')[0]} Scheduler`}
          </button>
        </>
      )}

      {tab === 'result' && result && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: ALGO_COLORS[result.algorithm] }} />
              <span style={{ fontWeight: 600, color: '#e2e8f0' }}>{result.algorithm.toUpperCase()} Results</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94a3b8' }}>
                {result.total_tasks} tasks → {result.total_vms} VMs
              </span>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Order</th><th>Task</th><th>Task ID</th><th>Assigned VM</th>
                    <th>Est. CT</th><th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {result.scheduled?.map(s => (
                    <tr key={s.task_id}>
                      <td>
                        <span style={{ background: ALGO_COLORS[result.algorithm] + '20', color: ALGO_COLORS[result.algorithm],
                          padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700 }}>#{s.order}</span>
                      </td>
                      <td style={{ fontWeight: 600, color: '#e2e8f0' }}>{s.task_name}</td>
                      <td><code style={{ fontSize: 11, color: '#0ea5e9' }}>{s.task_id}</code></td>
                      <td><code style={{ fontSize: 11 }}>{s.vm_id}</code></td>
                      <td>{s.completion_time != null ? `${s.completion_time}s` : '—'}</td>
                      <td style={{ fontSize: 12, color: '#4a6580' }}>{s.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {chartData.length > 0 && (
            <div className="chart-container">
              <div className="chart-title">Estimated Completion Times by Task</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#4a6580' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#4a6580' }} unit="s" />
                  <Tooltip
                    contentStyle={{ background: '#111927', border: '1px solid #1e3050', borderRadius: 8, fontSize: 12 }}
                    formatter={(v: any) => [`${Number(v).toFixed(2)}s`, 'Completion Time']}
                  />
                  <Bar dataKey="ct" radius={[4, 4, 0, 0]}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={ALGO_COLORS[result.algorithm]} opacity={0.7 + i * 0.03} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {tab === 'result' && !result && (
        <div className="empty-state">
          <Cpu size={40} opacity={0.3} />
          <div className="empty-state-title">No scheduling results yet</div>
          <div className="empty-state-sub">Go to Configuration and run the scheduler</div>
        </div>
      )}

      {tab === 'metrics' && metrics && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
            <MetricBox label="Makespan" value={metrics.makespan} unit="s" color="#0ea5e9" />
            <MetricBox label="Throughput" value={metrics.throughput} unit="t/s" color="#22c55e" />
            <MetricBox label="Utilization" value={metrics.resource_utilization} unit="%" color="#a855f7" />
            <MetricBox label="SLA Violations" value={metrics.sla_violations} color={metrics.sla_violations > 0 ? '#ef4444' : '#22c55e'} />
            <MetricBox label="Energy (kWh)" value={metrics.energy_consumption} color="#f97316" />
            <MetricBox label="Avg Wait" value={metrics.avg_waiting_time} unit="s" color="#eab308" />
            <MetricBox label="Avg Turnaround" value={metrics.avg_turnaround_time} unit="s" color="#0ea5e9" />
            <MetricBox label="Avg Response" value={metrics.avg_response_time} unit="s" color="#22c55e" />
          </div>

          <div className="card">
            <div className="card-title">Metric Explanations</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                ['Makespan', 'Total time from first task submission to last task completion'],
                ['Throughput', 'Number of tasks completed per second'],
                ['Resource Utilization', 'Percentage of VM resources actively used'],
                ['SLA Violations', 'Tasks that exceeded their timeout deadline'],
                ['Energy Consumption', 'Simulated energy cost in kWh (makespan × 0.15)'],
                ['Avg Waiting Time', 'Mean time tasks spend waiting before execution starts'],
                ['Avg Turnaround Time', 'Mean time from submission to completion'],
                ['Avg Response Time', 'Mean time from submission to first execution'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', gap: 12, fontSize: 13, paddingBottom: 8, borderBottom: '1px solid #1e3050' }}>
                  <span style={{ minWidth: 160, fontWeight: 600, color: '#e2e8f0' }}>{k}</span>
                  <span style={{ color: '#94a3b8' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
