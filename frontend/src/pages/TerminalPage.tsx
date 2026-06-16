import React, { useState, useRef, useEffect, useCallback } from 'react';
import { TerminalSquare, Server, ChevronRight, Trash2, Copy, Code } from 'lucide-react';
import { getVMs, executeCommand } from '../utils/api';
import type { VM } from '../types';

interface HistoryEntry {
  command: string;
  output: string;
  exitCode: number;
  time: number;
}

const QUICK_COMMANDS = [
  { label: 'System Info', cmd: 'uname' },
  { label: 'List Files', cmd: 'ls' },
  { label: 'Working Dir', cmd: 'pwd' },
  { label: 'Disk Usage', cmd: 'df -h' },
  { label: 'Memory', cmd: 'free -h' },
  { label: 'Uptime', cmd: 'uptime' },
  { label: 'Date', cmd: 'date' },
  { label: 'Hostname', cmd: 'hostname' },
];

const PYTHON_SNIPPETS = [
  { label: 'Hello World', code: `python3 -c "print('Hello from CloudSim!')"` },
  { label: 'Math', code: `python3 -c "import math; print(math.pi, math.e)"` },
  { label: 'List Comp', code: `python3 -c "print([x**2 for x in range(10)])"` },
  { label: 'Dict', code: `python3 -c "d={'cpu':4,'ram':8}; print(d)"` },
  { label: 'Random', code: `python3 -c "import random; print([random.randint(1,100) for _ in range(5)])"` },
  { label: 'Stats', code: `python3 -c "import statistics as s; d=[1,2,3,4,5,6,7]; print(s.mean(d), s.stdev(d))"` },
];

function colorizeOutput(text: string, exitCode: number): React.ReactNode[] {
  return text.split('\n').map((line, i) => {
    let color = '#a0c8f0';
    if (exitCode !== 0) color = '#ef4444';
    else if (line.startsWith('Successfully')) color = '#22c55e';
    else if (line.startsWith('Error') || line.startsWith('bash:')) color = '#ef4444';
    else if (line.startsWith('#')) color = '#4a6580';
    return <div key={i} style={{ color, lineHeight: 1.5 }}>{line || '\u00A0'}</div>;
  });
}

export default function TerminalPage() {
  const [vms, setVMs] = useState<VM[]>([]);
  const [selectedVM, setSelectedVM] = useState<VM | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getVMs().then(v => {
      setVMs(v);
      const running = v.find(vm => vm.status === 'running');
      if (running) setSelectedVM(running);
    });
  }, []);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [history]);

  const runCommand = useCallback(async (cmd: string) => {
    if (!cmd.trim() || !selectedVM) return;

    setCmdHistory(prev => [cmd, ...prev.slice(0, 49)]);
    setHistIdx(-1);

    const start = Date.now();
    setLoading(true);

    // Optimistically add command
    setHistory(prev => [...prev, { command: cmd, output: '', exitCode: -99, time: 0 }]);

    try {
      const res = await executeCommand(selectedVM.id, cmd);
      const elapsed = Date.now() - start;
      setHistory(prev => {
        const next = [...prev];
        next[next.length - 1] = {
          command: cmd,
          output: res.output || '',
          exitCode: res.exit_code,
          time: elapsed,
        };
        return next;
      });
    } catch (e: any) {
      setHistory(prev => {
        const next = [...prev];
        next[next.length - 1] = {
          command: cmd,
          output: e.response?.data?.detail || 'Connection error',
          exitCode: 1,
          time: Date.now() - start,
        };
        return next;
      });
    } finally {
      setLoading(false);
      setInput('');
      inputRef.current?.focus();
    }
  }, [selectedVM]);

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { runCommand(input); return; }
    if (e.key === 'ArrowUp') {
      const idx = Math.min(histIdx + 1, cmdHistory.length - 1);
      setHistIdx(idx);
      setInput(cmdHistory[idx] || '');
    }
    if (e.key === 'ArrowDown') {
      const idx = Math.max(histIdx - 1, -1);
      setHistIdx(idx);
      setInput(idx === -1 ? '' : cmdHistory[idx]);
    }
    if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); setHistory([]); }
  };

  const promptStr = selectedVM
    ? `cloudsim@${selectedVM.name.toLowerCase()}:~$`
    : 'select a VM to connect';

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">VM Terminal</h1>
        <p className="page-subtitle">Execute commands and Python code inside your virtual machines</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16 }}>
        {/* Left Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* VM Selector */}
          <div className="card">
            <div className="card-title"><Server size={14} />Connect to VM</div>
            {vms.filter(v => v.status === 'running').length === 0 ? (
              <div style={{ fontSize: 12, color: '#4a6580' }}>No running VMs. Start a VM first.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {vms.filter(v => v.status === 'running').map(vm => (
                  <button key={vm.id}
                    className={`btn btn-sm ${selectedVM?.id === vm.id ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ justifyContent: 'flex-start', width: '100%' }}
                    onClick={() => { setSelectedVM(vm); setHistory([]); }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e' }} />
                    {vm.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Commands */}
          <div className="card">
            <div className="card-title"><ChevronRight size={14} />Quick Commands</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {QUICK_COMMANDS.map(q => (
                <button key={q.cmd} className="btn btn-ghost btn-sm"
                  style={{ justifyContent: 'flex-start', fontSize: 12 }}
                  disabled={!selectedVM}
                  onClick={() => runCommand(q.cmd)}>
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          {/* Python Snippets */}
          <div className="card">
            <div className="card-title"><Code size={14} />Python Snippets</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {PYTHON_SNIPPETS.map(s => (
                <button key={s.label} className="btn btn-ghost btn-sm"
                  style={{ justifyContent: 'flex-start', fontSize: 12 }}
                  disabled={!selectedVM}
                  onClick={() => runCommand(s.code)}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setHistory([])} disabled={history.length === 0}>
              <Trash2 size={13} /> Clear Terminal
            </button>
            <button className="btn btn-secondary btn-sm"
              onClick={() => {
                const text = history.map(h => `$ ${h.command}\n${h.output}`).join('\n\n');
                navigator.clipboard.writeText(text);
              }}
              disabled={history.length === 0}>
              <Copy size={13} /> Copy Output
            </button>
          </div>
        </div>

        {/* Terminal */}
        <div className="terminal-wrapper" style={{ height: 'calc(100vh - 180px)', display: 'flex', flexDirection: 'column' }}>
          <div className="terminal-titlebar">
            <div className="terminal-dots">
              <div className="terminal-dot dot-red" />
              <div className="terminal-dot dot-yellow" />
              <div className="terminal-dot dot-green" />
            </div>
            <div className="terminal-label">
              {selectedVM ? `${selectedVM.name} — ${selectedVM.ip_address || 'no ip'} — ${selectedVM.os_image}` : 'No VM selected'}
            </div>
          </div>

          <div className="terminal-body" ref={outputRef}
            style={{ flex: 1, overflow: 'auto' }}
            onClick={() => inputRef.current?.focus()}>

            {/* Welcome banner */}
            <div style={{ color: '#0ea5e9', marginBottom: 12, fontFamily: 'monospace', fontSize: 12 }}>
              {`CloudSim Terminal v1.0`}<br />
              {`Type 'help' for available commands. Ctrl+L to clear.`}<br />
              {selectedVM ? `Connected to: ${selectedVM.name} (${selectedVM.os_image})` : 'Select a VM from the left panel to connect.'}
            </div>

            {/* Command history */}
            {history.map((entry, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 3 }}>
                  <span style={{ color: '#22c55e', fontWeight: 700, fontFamily: 'monospace', fontSize: 13 }}>
                    {promptStr}
                  </span>
                  <span style={{ color: '#e2e8f0', fontFamily: 'monospace', fontSize: 13 }}>{entry.command}</span>
                  {entry.time > 0 && (
                    <span style={{ marginLeft: 'auto', color: '#4a6580', fontSize: 11 }}>{entry.time}ms</span>
                  )}
                </div>
                {entry.exitCode === -99 ? (
                  <div style={{ color: '#4a6580', fontFamily: 'monospace', fontSize: 12, paddingLeft: 4 }}>
                    <span className="spinner" style={{ display: 'inline-block', width: 12, height: 12, marginRight: 6 }} />
                    Executing...
                  </div>
                ) : (
                  <div style={{ paddingLeft: 4, fontFamily: 'monospace', fontSize: 12 }}>
                    {colorizeOutput(entry.output, entry.exitCode)}
                  </div>
                )}
              </div>
            ))}

            {/* Blinking cursor when idle */}
            {!loading && history.length === 0 && selectedVM && (
              <div style={{ color: '#4a6580', fontFamily: 'monospace', fontSize: 13 }}>
                <span style={{ color: '#22c55e' }}>{promptStr}</span>
                <span style={{ animation: 'pulse 1s infinite' }}> _</span>
              </div>
            )}
          </div>

          {/* Input row */}
          <div className="terminal-input-row">
            <span className="terminal-prompt-label">{promptStr}</span>
            <input
              ref={inputRef}
              className="terminal-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              disabled={!selectedVM || loading}
              placeholder={!selectedVM ? 'select a VM first' : 'type a command...'}
              autoComplete="off"
              spellCheck={false}
            />
            {loading && <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />}
          </div>
        </div>
      </div>
    </div>
  );
}
