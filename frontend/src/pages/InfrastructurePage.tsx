import React, { useEffect, useState, useCallback } from 'react';
import ReactFlow, {
  Node, Edge, Background, Controls, MiniMap,
  useNodesState, useEdgesState, MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { RefreshCw, GitBranch, Info } from 'lucide-react';
import { getInfrastructureGraph, getHosts, getVMs, migrateVM } from '../utils/api';
import type { GraphNode, Host, VM } from '../types';

// ─── Custom Node Components ─────────────────────────────────────────────────

function DatacenterNode({ data }: { data: any }) {
  return (
    <div style={{
      background: 'rgba(14,165,233,0.1)', border: '2px solid #0ea5e9',
      borderRadius: 10, padding: '10px 16px', minWidth: 160, textAlign: 'center',
    }}>
      <div style={{ fontSize: 10, color: '#0ea5e9', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Datacenter</div>
      <div style={{ fontWeight: 700, color: '#e2e8f0', fontSize: 14 }}>🏢 {data.label}</div>
    </div>
  );
}

function HostNode({ data }: { data: any }) {
  const cpuColor = data.cpu_usage > 80 ? '#ef4444' : data.cpu_usage > 60 ? '#eab308' : '#22c55e';
  return (
    <div style={{
      background: '#111927', border: `1px solid ${data.status === 'online' ? '#2a4570' : '#4a6580'}`,
      borderRadius: 8, padding: '10px 14px', minWidth: 150,
    }}>
      <div style={{ fontSize: 10, color: '#4a6580', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Host Server</div>
      <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 13, marginBottom: 6 }}>🖥 {data.label}</div>
      {data.cpu_usage !== undefined && (
        <div style={{ fontSize: 11, color: '#94a3b8' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span>CPU</span>
            <span style={{ color: cpuColor }}>{data.cpu_usage}%</span>
          </div>
          <div style={{ height: 3, background: '#1e3050', borderRadius: 2, marginBottom: 4, overflow: 'hidden' }}>
            <div style={{ width: `${data.cpu_usage}%`, background: cpuColor, height: '100%' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>RAM</span>
            <span style={{ color: '#0ea5e9' }}>{data.ram_usage}%</span>
          </div>
          <div style={{ height: 3, background: '#1e3050', borderRadius: 2, marginTop: 3, overflow: 'hidden' }}>
            <div style={{ width: `${data.ram_usage}%`, background: '#0ea5e9', height: '100%' }} />
          </div>
        </div>
      )}
      <div style={{ marginTop: 6, fontSize: 10, color: '#4a6580' }}>{data.cpu_cores} cores</div>
    </div>
  );
}

function VMNode({ data }: { data: any }) {
  const statusColor: Record<string, string> = {
    running: '#22c55e', stopped: '#4a6580', creating: '#eab308',
    migrating: '#a855f7', error: '#ef4444',
  };
  const color = statusColor[data.status] || '#4a6580';
  return (
    <div style={{
      background: '#0d1420', border: `1px solid ${color}40`,
      borderRadius: 8, padding: '8px 12px', minWidth: 130,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
        <div style={{ fontSize: 10, color: '#4a6580', textTransform: 'uppercase', letterSpacing: 1 }}>VM</div>
      </div>
      <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 12, marginBottom: 4 }}>💻 {data.label}</div>
      {data.cpu_usage !== undefined && (
        <div style={{ fontSize: 11, color: '#94a3b8' }}>
          CPU: <span style={{ color: '#0ea5e9' }}>{data.cpu_usage}%</span> ·{' '}
          RAM: <span style={{ color: '#22c55e' }}>{data.ram_usage}%</span>
        </div>
      )}
      <div style={{ fontSize: 10, color, marginTop: 3 }}>{data.status}</div>
    </div>
  );
}

const nodeTypes = {
  datacenter: DatacenterNode,
  host: HostNode,
  vm: VMNode,
};

// ─── Layout helper ─────────────────────────────────────────────────────────

function buildLayout(graphNodes: GraphNode[], graphEdges: any[]) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const dcs = graphNodes.filter(n => n.type === 'datacenter');
  const hosts = graphNodes.filter(n => n.type === 'host');
  const vms = graphNodes.filter(n => n.type === 'vm');

  // Compute parent relationships
  const hostParent: Record<string, string> = {};
  const vmParent: Record<string, string> = {};
  graphEdges.forEach(e => {
    const src = graphNodes.find(n => n.id === e.source);
    const tgt = graphNodes.find(n => n.id === e.target);
    if (src?.type === 'datacenter' && tgt?.type === 'host') hostParent[tgt.id] = src.id;
    if (src?.type === 'host' && tgt?.type === 'vm') vmParent[tgt.id] = src.id;
  });

  // Position datacenters
  dcs.forEach((dc, di) => {
    nodes.push({ id: dc.id, type: 'datacenter', position: { x: di * 600, y: 0 }, data: dc });

    // Position hosts under this DC
    const dcHosts = hosts.filter(h => hostParent[h.id] === dc.id);
    dcHosts.forEach((host, hi) => {
      const x = di * 600 + hi * 200;
      nodes.push({ id: host.id, type: 'host', position: { x, y: 140 }, data: host });

      // Position VMs under this host
      const hostVMs = vms.filter(v => vmParent[v.id] === host.id);
      hostVMs.forEach((vm, vi) => {
        nodes.push({ id: vm.id, type: 'vm', position: { x: x + vi * 150 - (hostVMs.length - 1) * 75, y: 300 }, data: vm });
      });
    });
  });

  // Build edges
  graphEdges.forEach(e => {
    edges.push({
      id: e.id, source: e.source, target: e.target,
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed, color: '#2a4570', width: 12, height: 12 },
      style: { stroke: '#2a4570', strokeWidth: 1.5 },
      animated: false,
    });
  });

  return { nodes, edges };
}

// ─── Detail Panel ───────────────────────────────────────────────────────────

function DetailPanel({ node, hosts, vms, onMigrate, onClose }: {
  node: GraphNode; hosts: Host[]; vms: VM[];
  onMigrate?: (vmId: string, hostId: string) => void;
  onClose: () => void;
}) {
  const [targetHost, setTargetHost] = useState('');

  return (
    <div style={{
      position: 'absolute', right: 16, top: 16, width: 260, zIndex: 10,
      background: '#111927', border: '1px solid #1e3050', borderRadius: 12,
      padding: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontWeight: 700, color: '#e2e8f0', fontSize: 14 }}>{node.label}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#4a6580', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
        {[
          ['Type', node.type],
          ['Status', node.status || '—'],
          node.cpu_cores && ['CPU', `${node.cpu_cores} cores`],
          node.ram_mb && ['RAM', `${Math.round(node.ram_mb / 1024)} GB`],
          node.cpu_usage !== undefined && ['CPU Usage', `${node.cpu_usage}%`],
          node.ram_usage !== undefined && ['RAM Usage', `${node.ram_usage}%`],
        ].filter(Boolean).map(([k, v]: any) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1e3050', paddingBottom: 6 }}>
            <span style={{ color: '#4a6580' }}>{k}</span>
            <span style={{ color: '#e2e8f0' }}>{v}</span>
          </div>
        ))}
      </div>

      {/* Migration panel for VMs */}
      {node.type === 'vm' && onMigrate && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>Migrate to host:</div>
          <select className="form-select" value={targetHost} onChange={e => setTargetHost(e.target.value)}
            style={{ marginBottom: 8 }}>
            <option value="">Select target host</option>
            {hosts.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          <button className="btn btn-primary btn-sm" style={{ width: '100%' }}
            disabled={!targetHost}
            onClick={() => targetHost && onMigrate(node.id, targetHost)}>
            Migrate VM
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function InfrastructurePage() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [hosts, setHosts] = useState<Host[]>([]);
  const [vms, setVMs] = useState<VM[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [nodeCount, setNodeCount] = useState({ dc: 0, host: 0, vm: 0 });

  const load = useCallback(async () => {
    const [graph, h, v] = await Promise.all([
      getInfrastructureGraph(), getHosts(), getVMs()
    ]);
    const { nodes: n, edges: e } = buildLayout(graph.nodes, graph.edges);
    setNodes(n); setEdges(e); setHosts(h); setVMs(v);
    setNodeCount({
      dc: graph.nodes.filter(n => n.type === 'datacenter').length,
      host: graph.nodes.filter(n => n.type === 'host').length,
      vm: graph.nodes.filter(n => n.type === 'vm').length,
    });
    setLoading(false);
  }, [setNodes, setEdges]);

  useEffect(() => { load(); const id = setInterval(load, 5000); return () => clearInterval(id); }, [load]);

  const handleNodeClick = (_: any, node: Node) => {
    setSelectedNode(node.data as GraphNode);
  };

  const handleMigrate = async (vmId: string, hostId: string) => {
    try {
      await migrateVM(vmId, hostId);
      setSelectedNode(null);
      await load();
    } catch (e) {
      alert('Migration failed — target host may not have enough resources');
    }
  };

  if (loading) return <div className="loading"><div className="spinner" />Building infrastructure graph...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Infrastructure Graph</h1>
        <p className="page-subtitle">Interactive visualization of your cloud topology</p>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={load}><RefreshCw size={14} /> Refresh</button>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { color: '#0ea5e9', label: `Datacenters (${nodeCount.dc})`, border: 2 },
          { color: '#2a4570', label: `Host Servers (${nodeCount.host})`, border: 1 },
          { color: '#22c55e', label: `Running VMs (${vms.filter(v => v.status === 'running').length})`, border: 1 },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94a3b8' }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: `${color}20`, border: `1.5px solid ${color}` }} />
            {label}
          </div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#4a6580' }}>
          <Info size={13} /> Click any node for details · Drag to rearrange · Scroll to zoom
        </div>
      </div>

      <div style={{ position: 'relative' }}>
        <div style={{ height: 560, background: '#080c14', borderRadius: 12, border: '1px solid #1e3050', overflow: 'hidden' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            minZoom={0.3}
            maxZoom={2}
          >
            <Background color="#1e3050" gap={28} size={1} />
            <Controls style={{ background: '#111927', border: '1px solid #1e3050', borderRadius: 8 }} />
            <MiniMap
              style={{ background: '#080c14', border: '1px solid #1e3050' }}
              nodeColor={n => {
                if (n.type === 'datacenter') return '#0ea5e9';
                if (n.type === 'host') return '#2a4570';
                return '#22c55e';
              }}
            />
          </ReactFlow>
        </div>

        {selectedNode && (
          <DetailPanel
            node={selectedNode}
            hosts={hosts}
            vms={vms}
            onMigrate={selectedNode.type === 'vm' ? handleMigrate : undefined}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </div>
    </div>
  );
}
