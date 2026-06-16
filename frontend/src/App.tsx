import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Server, Cpu, TerminalSquare, Zap,
  BarChart3, FlaskConical, GitBranch, Menu, X, Cloud, Activity
} from 'lucide-react';
import Dashboard from './pages/Dashboard';
import VirtualMachines from './pages/VirtualMachines';
import TasksPage from './pages/TasksPage';
import SchedulerPage from './pages/SchedulerPage';
import TerminalPage from './pages/TerminalPage';
import MonitoringPage from './pages/MonitoringPage';
import InfrastructurePage from './pages/InfrastructurePage';
import ResearchPage from './pages/ResearchPage';
import './App.css';

const NAV_ITEMS = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/infrastructure', icon: GitBranch, label: 'Infrastructure' },
  { path: '/vms', icon: Server, label: 'Virtual Machines' },
  { path: '/tasks', icon: Zap, label: 'Cloudlets' },
  { path: '/scheduler', icon: Cpu, label: 'Scheduler' },
  { path: '/terminal', icon: TerminalSquare, label: 'Terminal' },
  { path: '/monitoring', icon: BarChart3, label: 'Monitoring' },
  { path: '/research', icon: FlaskConical, label: 'Research' },
];

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      {open && (
        <div className="sidebar-overlay" onClick={onClose} />
      )}
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <div className="sidebar-logo">
          <Cloud size={24} className="logo-icon" />
          <span className="logo-text">CloudSim</span>
          <button className="sidebar-close" onClick={onClose}><X size={18} /></button>
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ path, icon: Icon, label }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              className={({ isActive }) => `nav-item ${isActive ? 'nav-active' : ''}`}
              onClick={onClose}
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <Activity size={14} />
          <span>v1.0.0 • Educational Build</span>
        </div>
      </aside>
    </>
  );
}

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <BrowserRouter>
      <div className="app-layout">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="app-main">
          <header className="app-header">
            <button className="menu-btn" onClick={() => setSidebarOpen(true)}>
              <Menu size={20} />
            </button>
            <div className="header-brand">
              <Cloud size={20} className="logo-icon" />
              <span>CloudSim Platform</span>
            </div>
            <div className="header-status">
              <span className="status-dot" />
              <span>System Online</span>
            </div>
          </header>
          <main className="app-content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/infrastructure" element={<InfrastructurePage />} />
              <Route path="/vms" element={<VirtualMachines />} />
              <Route path="/tasks" element={<TasksPage />} />
              <Route path="/scheduler" element={<SchedulerPage />} />
              <Route path="/terminal" element={<TerminalPage />} />
              <Route path="/monitoring" element={<MonitoringPage />} />
              <Route path="/research" element={<ResearchPage />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
