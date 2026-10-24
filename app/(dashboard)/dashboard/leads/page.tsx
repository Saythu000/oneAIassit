'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenantInfo } from '@/hooks/useTenantInfo';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { getClientSocket } from '@/lib/socket-client';

interface Lead {
  id: string;
  status: 'NEW' | 'APPLICATION_CAPTURED' | 'QUALIFIED' | 'HANDED_OFF' | 'NEGOTIATION' | 'CONVERTED' | 'LOST';
  source: string;
  dealValue: number;
  daysInStage: string;
  lostReason?: string;
  customer: {
    id: string;
    displayName: string;
    phone: string;
  };
  assignedAgent: {
    id: string;
    name: string;
    email: string;
  } | null;
  intakeSession?: {
    collectedFields: any;
    status: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';
  } | null;
}

interface Agent {
  id: string;
  name: string;
  email: string;
  role: string;
}

const COLUMNS = [
  { id: 'NEW', name: 'New Lead', color: 'bg-blue-100 text-blue-800' },
  { id: 'APPLICATION_CAPTURED', name: 'Intake In Progress', color: 'bg-indigo-100 text-indigo-800' },
  { id: 'QUALIFIED', name: 'Qualified', color: 'bg-purple-100 text-purple-800' },
  { id: 'HANDED_OFF', name: 'Quoted/Proposal Sent', color: 'bg-pink-100 text-pink-800' },
  { id: 'NEGOTIATION', name: 'Negotiation', color: 'bg-amber-100 text-amber-800' },
  { id: 'CONVERTED', name: 'Won', color: 'bg-emerald-100 text-emerald-800 border-l-4 border-l-emerald-500' },
  { id: 'LOST', name: 'Lost', color: 'bg-rose-100 text-rose-800' },
] as const;

export default function LeadsPage() {
  const queryClient = useQueryClient();
  const { data: info } = useTenantInfo();
  const tenantId = info?.tenantId;

  // Socket.io Live Updates
  useEffect(() => {
    if (!tenantId) return;

    const socketInstance = getClientSocket(tenantId);

    socketInstance.on('lead_status_updated', (data: { leadId: string; status: string }) => {
      console.log('[Socket] lead_status_updated event received:', data);
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    });

    socketInstance.on('intake_progress_updated', (data: { leadId: string; collectedFields: any; progress: string }) => {
      console.log('[Socket] intake_progress_updated event received:', data);
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    });

    return () => {
      socketInstance.disconnect();
    };
  }, [tenantId, queryClient]);

  // View state: 'kanban' or 'list'
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  // Filter states
  const [selectedAgent, setSelectedAgent] = useState('ALL');
  const [selectedSource, setSelectedSource] = useState('ALL');
  const [dateRange, setDateRange] = useState<'ALL' | '7_DAYS' | 'THIS_MONTH' | 'LAST_MONTH'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadPhone, setNewLeadPhone] = useState('');
  const [newLeadSource, setNewLeadSource] = useState('WhatsApp Broadcast');
  const [newLeadValue, setNewLeadValue] = useState('');
  const [newLeadAgent, setNewLeadAgent] = useState('');

  // 1. Fetch leads list
  const { data: leads, isLoading: leadsLoading } = useQuery<Lead[]>({
    queryKey: ['leads', tenantId, selectedAgent, selectedSource, dateRange, searchQuery],
    queryFn: async () => {
      let url = `/api/dashboard/leads?agentId=${selectedAgent}&source=${selectedSource}&query=${searchQuery}`;
      
      const now = new Date();
      if (dateRange === '7_DAYS') {
        const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        url += `&startDate=${past.toISOString()}`;
      } else if (dateRange === 'THIS_MONTH') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        url += `&startDate=${startOfMonth.toISOString()}`;
      } else if (dateRange === 'LAST_MONTH') {
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        url += `&startDate=${startOfLastMonth.toISOString()}&endDate=${endOfLastMonth.toISOString()}`;
      }

      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load leads');
      return res.json();
    },
    enabled: !!tenantId,
  });

  // 2. Fetch agents
  const { data: agents } = useQuery<Agent[]>({
    queryKey: ['agents', tenantId],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/leads/agents');
      if (!res.ok) throw new Error('Failed to load agents');
      return res.json();
    },
    enabled: !!tenantId,
  });

  // 3. Update lead stage mutation (for drag & drop or controls)
  const updateStageMutation = useMutation({
    mutationFn: async ({ leadId, status }: { leadId: string; status: Lead['status'] }) => {
      const res = await fetch('/api/dashboard/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, status }),
      });
      if (!res.ok) throw new Error('Failed to update stage');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });

  // 4. Create lead mutation
  const createLeadMutation = useMutation({
    mutationFn: async (payload: {
      displayName: string;
      phone: string;
      source: string;
      dealValue: string;
      agentId: string | null;
    }) => {
      const res = await fetch('/api/dashboard/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to create lead');
      return res.json();
    },
    onSuccess: () => {
      setIsAddModalOpen(false);
      setNewLeadName('');
      setNewLeadPhone('');
      setNewLeadValue('');
      setNewLeadAgent('');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });

  const handleAddLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeadName.trim() || !newLeadPhone.trim()) return;
    createLeadMutation.mutate({
      displayName: newLeadName,
      phone: newLeadPhone,
      source: newLeadSource,
      dealValue: newLeadValue || '1500',
      agentId: newLeadAgent || null,
    });
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, status: Lead['status']) => {
    const leadId = e.dataTransfer.getData('text/plain');
    if (leadId) {
      updateStageMutation.mutate({ leadId, status });
    }
  };

  // Calculate Pipeline statistics
  const activeLeadsCount = leads?.filter((l) => l.status !== 'CONVERTED' && l.status !== 'LOST').length || 0;
  
  const totalPipelineValue = leads
    ?.filter((l) => l.status !== 'CONVERTED' && l.status !== 'LOST')
    .reduce((sum, l) => sum + l.dealValue, 0) || 0;

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col font-sans text-slate-900 bg-slate-50/50 relative">
      {/* Top Header Bar */}
      <header className="h-16 flex items-center justify-between border-b border-slate-200/80 bg-white px-6 shrink-0 shadow-xs">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-slate-900">Lead Pipeline & CRM</h2>
            <div className="hidden sm:flex items-center gap-2 text-xs">
              <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-[#1B4B91] border border-blue-200/60 font-semibold">
                {activeLeadsCount} Active Leads
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/60 font-semibold">
                ${totalPipelineValue.toLocaleString()} Pipeline
              </span>
            </div>
          </div>
          
          {/* View Toggle */}
          <div className="flex bg-slate-100/90 rounded-xl p-0.5 shrink-0 border border-slate-200/60">
            <button
              onClick={() => setViewMode('kanban')}
              className={cn(
                'px-3.5 py-1 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all',
                viewMode === 'kanban' ? 'bg-white shadow-xs text-[#1B4B91]' : 'text-slate-500 hover:text-slate-900'
              )}
            >
              <span className="material-symbols-outlined text-[15px]">view_kanban</span>
              Kanban
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'px-3.5 py-1 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all',
                viewMode === 'list' ? 'bg-white shadow-xs text-[#1B4B91]' : 'text-slate-500 hover:text-slate-900'
              )}
            >
              <span className="material-symbols-outlined text-[15px]">list</span>
              List
            </button>
          </div>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-[#1B4B91] text-white hover:bg-[#163e78] font-bold text-xs px-4 py-2 rounded-xl shadow-xs transition-all flex items-center gap-1.5 shrink-0"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          <span>+ Add Lead</span>
        </button>
      </header>

      {/* Filter and Query Selection Bar */}
      <div className="bg-white border-b border-slate-200/80 px-6 py-3.5 flex flex-wrap items-center gap-4 shrink-0">
        {/* Agent Filter */}
        <div className="relative min-w-[150px]">
          <label htmlFor="filter-agent" className="block text-[9px] uppercase tracking-wider text-slate-500 font-bold mb-1">Assigned Agent</label>
          <select
            id="filter-agent"
            name="filterAgent"
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-[#1B4B91] focus:bg-white transition"
          >
            <option value="ALL">All Agents</option>
            {agents?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        {/* Source Filter */}
        <div className="relative min-w-[150px]">
          <label htmlFor="filter-source" className="block text-[9px] uppercase tracking-wider text-slate-500 font-bold mb-1">Lead Source</label>
          <select
            id="filter-source"
            name="filterSource"
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-[#1B4B91] focus:bg-white transition"
          >
            <option value="ALL">All Sources</option>
            <option value="WhatsApp Broadcast">WhatsApp Broadcast</option>
            <option value="Instagram DM">Instagram DM</option>
            <option value="Facebook Messenger">Facebook Messenger</option>
            <option value="Organic Search">Organic Search</option>
            <option value="Paid Ads">Paid Ads</option>
            <option value="Referral">Referral</option>
          </select>
        </div>

        {/* Date Range Selection */}
        <div className="relative min-w-[150px]">
          <label htmlFor="filter-daterange" className="block text-[9px] uppercase tracking-wider text-slate-500 font-bold mb-1">Timeframe</label>
          <select
            id="filter-daterange"
            name="filterDateRange"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as 'ALL' | '7_DAYS' | 'THIS_MONTH' | 'LAST_MONTH')}
            className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-[#1B4B91] focus:bg-white transition"
          >
            <option value="ALL">All Time</option>
            <option value="7_DAYS">Last 7 Days</option>
            <option value="THIS_MONTH">This Month</option>
            <option value="LAST_MONTH">Last Month</option>
          </select>
        </div>

        {/* Search */}
        <div className="ml-auto relative min-w-[240px]">
          <label htmlFor="filter-search" className="block text-[9px] uppercase tracking-wider text-slate-500 font-bold mb-1">Search Pipeline</label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
              search
            </span>
            <input
              id="filter-search"
              name="filterSearch"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by contact, company, phone..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50/50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1B4B91] focus:bg-white text-xs font-medium text-slate-900 transition"
            />
          </div>
        </div>
      </div>

      {/* Main Board View */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6 bg-slate-50/40">
        {leadsLoading ? (
          <div className="h-full flex items-center justify-center text-xs text-[#737686] animate-pulse">
            Loading leads data...
          </div>
        ) : viewMode === 'kanban' ? (
          <div className="flex gap-5 h-full items-start">
            {COLUMNS.map((col) => {
              const colLeads = leads?.filter((l) => l.status === col.id) || [];
              const columnSum = colLeads.reduce((sum, l) => sum + l.dealValue, 0);

              return (
                <div
                  key={col.id}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, col.id)}
                  className="w-72 bg-slate-100/50 border border-[#c3c6d7]/40 rounded-2xl p-4 flex flex-col max-h-full shrink-0"
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between mb-4 px-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h3 className="text-xs font-bold text-[#1c1b1f] truncate leading-none">
                        {col.name}
                      </h3>
                      <span className="bg-slate-200 text-[#49454f] text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
                        {colLeads.length}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-[#737686] shrink-0">
                      ${columnSum.toLocaleString()}
                    </span>
                  </div>

                  {/* Cards container */}
                  <div className="flex-1 overflow-y-auto space-y-3 pr-0.5 scrollbar-thin">
                    {colLeads.map((lead) => (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, lead.id)}
                        className={cn(
                          'bg-white p-4 rounded-xl border border-[#c3c6d7]/65 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing flex flex-col gap-2 relative group',
                          col.id === 'CONVERTED' && 'border-l-4 border-l-emerald-500',
                          col.id === 'LOST' && 'opacity-65 grayscale bg-slate-50'
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="inline-block px-2 py-0.5 bg-slate-100 text-[#49454f] text-[8px] font-bold rounded uppercase tracking-wider">
                            {lead.source}
                          </span>
                          <span className="text-xs font-bold text-[#1c1b1f] shrink-0">
                            ${lead.dealValue.toLocaleString()}
                          </span>
                        </div>

                        <h4 className="text-xs font-bold text-[#1c1b1f] truncate group-hover:text-[#004ac6] transition-colors">
                          <Link href={`/dashboard/customers/${lead.customer.id}`} className="hover:underline">
                            {lead.customer.displayName}
                          </Link>
                        </h4>

                        <div className="flex items-center gap-1 text-[10px] text-[#737686] font-medium">
                          <span className="material-symbols-outlined text-[12px]">call</span>
                          <span>{lead.customer.phone}</span>
                        </div>

                        {/* Intake Progress Checkmarks */}
                        {lead.intakeSession && (
                          <div className="bg-slate-50 border border-slate-100 rounded-lg p-2 flex flex-col gap-1.5 mt-1">
                            <div className="flex justify-between items-center text-[9px] font-bold text-[#49454f]">
                              <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-[11px] text-[#004ac6]">assignment</span>
                                Intake Qualification
                              </span>
                              <span className="text-[#004ac6]">
                                {(() => {
                                  const fields = (lead.intakeSession.collectedFields as any) || {};
                                  const required = ['age', 'state', 'healthConditions', 'budgetMin', 'budgetMax', 'familySize'];
                                  const collected = Object.keys(fields).filter(
                                    (k) => required.includes(k) && fields[k] !== undefined
                                  );
                                  return `${collected.length} of ${required.length}`;
                                })()}
                              </span>
                            </div>
                            <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
                              <div
                                className="bg-[#004ac6] h-full rounded-full transition-all duration-300"
                                style={{
                                  width: `${(() => {
                                    const fields = (lead.intakeSession.collectedFields as any) || {};
                                    const required = ['age', 'state', 'healthConditions', 'budgetMin', 'budgetMax', 'familySize'];
                                    const collected = Object.keys(fields).filter(
                                      (k) => required.includes(k) && fields[k] !== undefined
                                    );
                                    return (collected.length / required.length) * 100;
                                  })()}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}

                        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-[9px] text-[#737686] italic font-semibold">
                            {lead.daysInStage}
                          </span>
                          <div className="w-5 h-5 rounded-full bg-[#004ac6]/10 text-[#004ac6] border border-[#004ac6]/20 flex items-center justify-center text-[9px] font-bold" title={lead.assignedAgent?.name || 'Unassigned'}>
                            {lead.assignedAgent?.name.substring(0, 2).toUpperCase() || '?'}
                          </div>
                        </div>
                      </div>
                    ))}

                    {colLeads.length === 0 && (
                      <div className="border border-dashed border-[#c3c6d7]/50 rounded-xl p-6 text-center text-[10px] text-[#737686] italic">
                        Empty Stage
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List View fallback table */
          <div className="bg-white border border-[#c3c6d7] rounded-2xl overflow-hidden max-h-full flex flex-col">
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-[#c3c6d7] text-[#49454f] font-bold">
                    <th className="p-4 font-bold">Customer Name</th>
                    <th className="p-4 font-bold">Phone Number</th>
                    <th className="p-4 font-bold">Stage Status</th>
                    <th className="p-4 font-bold">Lead Source</th>
                    <th className="p-4 font-bold">Deal Value</th>
                    <th className="p-4 font-bold">Time in Stage</th>
                    <th className="p-4 font-bold">Assigned Agent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leads?.map((lead) => (
                    <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-bold text-[#1c1b1f]">
                        <Link href={`/dashboard/customers/${lead.customer.id}`} className="hover:underline hover:text-[#004ac6] transition-colors">
                          {lead.customer.displayName}
                        </Link>
                      </td>
                      <td className="p-4 font-medium text-[#737686]">{lead.customer.phone}</td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 bg-slate-100 text-[#1c1b1f] border border-[#c3c6d7]/50 rounded font-semibold text-[10px] capitalize">
                          {lead.status.replace('_', ' ').toLowerCase()}
                        </span>
                      </td>
                      <td className="p-4 text-[#49454f] font-medium">{lead.source}</td>
                      <td className="p-4 font-bold text-[#1c1b1f]">${lead.dealValue.toLocaleString()}</td>
                      <td className="p-4 text-[#737686] italic">{lead.daysInStage}</td>
                      <td className="p-4 font-bold text-[#004ac6]">{lead.assignedAgent?.name || 'Unassigned'}</td>
                    </tr>
                  ))}
                  {(!leads || leads.length === 0) && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-xs text-[#737686] italic">
                        No leads found matching filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Sticky Bottom Stats Footer */}
      <footer className="h-14 bg-white border-t border-[#c3c6d7] px-6 flex items-center justify-between shrink-0 shadow-[0_-4px_10px_rgba(0,0,0,0.02)] z-10">
        <div className="flex flex-col">
          <div className="flex gap-6 items-center">
            <p className="text-xs font-semibold text-[#49454f]">
              Total Pipeline Value: <span className="font-bold text-[#004ac6] text-sm">${totalPipelineValue.toLocaleString()}</span>
            </p>
            <div className="h-4 w-px bg-[#c3c6d7]"></div>
            <p className="text-xs font-semibold text-[#49454f]">
              Active Leads: <span className="font-bold text-[#1c1b1f]">{activeLeadsCount}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-1 text-xs font-bold text-[#737686] hover:text-[#004ac6] transition-colors">
            <span className="material-symbols-outlined text-[16px]">download</span>
            Export CSV
          </button>
          <button className="flex items-center gap-1 text-xs font-bold text-[#737686] hover:text-[#004ac6] transition-colors">
            <span className="material-symbols-outlined text-[16px]">analytics</span>
            View Analytics
          </button>
        </div>
      </footer>

      {/* "+ Add Lead" Modal Component */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-[#c3c6d7] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in-50 duration-200">
            <header className="px-6 py-4 bg-slate-50 border-b border-[#c3c6d7] flex items-center justify-between">
              <h3 className="text-xs uppercase font-bold tracking-wider text-[#1c1b1f]">Create New Lead</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-[#737686]"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </header>

            <form onSubmit={handleAddLead} className="p-6 space-y-4">
              <div>
                <label htmlFor="new-lead-name" className="block text-[10px] font-bold text-[#49454f] uppercase tracking-wider mb-1">
                  Customer Name
                </label>
                <input
                  id="new-lead-name"
                  name="newLeadName"
                  type="text"
                  required
                  value={newLeadName}
                  onChange={(e) => setNewLeadName(e.target.value)}
                  placeholder="e.g. Marcus Thorne"
                  className="w-full px-3 py-2 bg-slate-50 border border-[#c3c6d7] rounded-lg focus:outline-none focus:border-[#004ac6] text-xs font-medium"
                />
              </div>

              <div>
                <label htmlFor="new-lead-phone" className="block text-[10px] font-bold text-[#49454f] uppercase tracking-wider mb-1">
                  Phone Number
                </label>
                <input
                  id="new-lead-phone"
                  name="newLeadPhone"
                  type="text"
                  required
                  value={newLeadPhone}
                  onChange={(e) => setNewLeadPhone(e.target.value)}
                  placeholder="e.g. +1 555-0123"
                  className="w-full px-3 py-2 bg-slate-50 border border-[#c3c6d7] rounded-lg focus:outline-none focus:border-[#004ac6] text-xs font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="new-lead-source" className="block text-[10px] font-bold text-[#49454f] uppercase tracking-wider mb-1">
                    Lead Source
                  </label>
                  <select
                    id="new-lead-source"
                    name="newLeadSource"
                    value={newLeadSource}
                    onChange={(e) => setNewLeadSource(e.target.value)}
                    className="w-full bg-white border border-[#c3c6d7] rounded-lg px-3 py-2 text-xs font-semibold outline-none focus:border-[#004ac6]"
                  >
                    <option value="WhatsApp Broadcast">WhatsApp Broadcast</option>
                    <option value="Organic Search">Organic Search</option>
                    <option value="Paid Ads">Paid Ads</option>
                    <option value="Referral">Referral</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="new-lead-value" className="block text-[10px] font-bold text-[#49454f] uppercase tracking-wider mb-1">
                    Deal Value ($)
                  </label>
                  <input
                    id="new-lead-value"
                    name="newLeadValue"
                    type="number"
                    value={newLeadValue}
                    onChange={(e) => setNewLeadValue(e.target.value)}
                    placeholder="1500"
                    className="w-full px-3 py-2 bg-slate-50 border border-[#c3c6d7] rounded-lg focus:outline-none focus:border-[#004ac6] text-xs font-semibold"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="new-lead-agent" className="block text-[10px] font-bold text-[#49454f] uppercase tracking-wider mb-1">
                  Assigned Agent
                </label>
                <select
                  id="new-lead-agent"
                  name="newLeadAgent"
                  value={newLeadAgent}
                  onChange={(e) => setNewLeadAgent(e.target.value)}
                  className="w-full bg-white border border-[#c3c6d7] rounded-lg px-3 py-2 text-xs font-semibold outline-none focus:border-[#004ac6]"
                >
                  <option value="">Select Agent (Optional)</option>
                  {agents?.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.role})
                    </option>
                  ))}
                </select>
              </div>

              <footer className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-[#737686] hover:bg-slate-100 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLeadMutation.isPending}
                  className="px-5 py-2 bg-[#004ac6] hover:bg-[#003ca0] text-white font-bold text-xs rounded-xl shadow-sm transition-all disabled:opacity-50"
                >
                  {createLeadMutation.isPending ? 'Creating...' : 'Create Lead'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
