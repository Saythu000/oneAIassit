'use client';

import React, { useState, useEffect } from 'react';
import { EmailTemplateEditorModal } from '@/components/email/EmailTemplateEditorModal';

export interface CTAButton {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE';
  text: string;
  url?: string;
  phoneNumber?: string;
}

export interface TemplateItem {
  id: string;
  name: string;
  channel?: 'WHATSAPP' | 'EMAIL' | 'INSTAGRAM';
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  language: string;
  subject?: string;
  htmlBody?: string;
  plainText?: string;
  body: string;
  headerType?: string;
  header?: string;
  footer?: string;
  ctaButtons?: CTAButton[];
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
  usageCount: number;
  lastUsedAt?: string;
  createdAt: string;
}

export default function WhatsAppTemplateManagerPage() {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState<'ALL' | 'WHATSAPP' | 'EMAIL'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // View state: 'list' | 'create'
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState<'MARKETING' | 'UTILITY' | 'AUTHENTICATION'>('MARKETING');
  const [language, setLanguage] = useState('en');
  const [headerType, setHeaderType] = useState('NONE');
  const [header, setHeader] = useState('');
  const [body, setBody] = useState('');
  const [footer, setFooter] = useState('');
  const [ctaButtons, setCtaButtons] = useState<CTAButton[]>([]);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);

  // Test variables for live preview
  const [testVariables, setTestVariables] = useState<Record<string, string>>({
    '1': 'Alex',
    '2': 'Prime Health Plan',
    '3': '$199/mo',
  });

  // Preview Modal
  const [previewTemplate, setPreviewTemplate] = useState<TemplateItem | null>(null);

  // Action status message banner
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchTemplates = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (channelFilter !== 'ALL') params.append('channel', channelFilter);
      if (categoryFilter !== 'ALL') params.append('category', categoryFilter);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);

      const res = await fetch(`/api/templates?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch templates');
      setTemplates(data.templates || []);
    } catch (err: any) {
      setError(err.message || 'Error loading templates');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [search, channelFilter, categoryFilter, statusFilter]);

  const handleNameChange = (val: string) => {
    // Format to lowercase_with_underscores
    const formatted = val
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
    setName(formatted);
  };

  const handleAddButton = () => {
    if (ctaButtons.length >= 3) return;
    setCtaButtons([
      ...ctaButtons,
      { type: 'QUICK_REPLY', text: '' },
    ]);
  };

  const handleUpdateButton = (index: number, updated: CTAButton) => {
    const copy = [...ctaButtons];
    copy[index] = updated;
    setCtaButtons(copy);
  };

  const handleRemoveButton = (index: number) => {
    setCtaButtons(ctaButtons.filter((_, i) => i !== index));
  };

  const handleInsertVariable = () => {
    // Count existing {{n}} placeholders
    const matches = body.match(/\{\{\d+\}\}/g) || [];
    const nextNum = matches.length + 1;
    setBody((prev) => `${prev} {{${nextNum}}}`);
  };

  const resetForm = () => {
    setName('');
    setCategory('MARKETING');
    setLanguage('en');
    setHeaderType('NONE');
    setHeader('');
    setBody('');
    setFooter('');
    setCtaButtons([]);
    setEditingId(null);
  };

  const handleSaveTemplate = async (autoSubmit: boolean = false) => {
    if (!name.trim()) {
      setActionMessage({ type: 'error', text: 'Template name is required.' });
      return;
    }
    if (!body.trim()) {
      setActionMessage({ type: 'error', text: 'Template body is required.' });
      return;
    }

    setIsSubmittingForm(true);
    setActionMessage(null);

    try {
      const payload = {
        name,
        category,
        language,
        headerType,
        header,
        body,
        footer,
        ctaButtons,
        autoSubmit,
      };

      const url = editingId ? `/api/templates/${editingId}` : '/api/templates';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save template');

      setActionMessage({
        type: 'success',
        text: autoSubmit
          ? `Template "${data.template.name}" created & submitted to Meta for approval!`
          : `Template "${data.template.name}" saved as Draft.`,
      });

      resetForm();
      setActiveTab('list');
      fetchTemplates();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Save failed' });
    } finally {
      setIsSubmittingForm(false);
    }
  };

  const handleSubmitForApproval = async (id: string) => {
    try {
      const res = await fetch(`/api/templates/${id}/submit`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');

      setActionMessage({
        type: 'success',
        text: `Submitted to Meta! Status moved to PENDING.`,
      });
      fetchTemplates();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  const handleSimulateStatus = async (id: string, targetStatus: string, reason?: string) => {
    try {
      const res = await fetch(`/api/templates/${id}/simulate-approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetStatus, rejectionReason: reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Simulation failed');

      setActionMessage({
        type: 'success',
        text: `[DEV TOOLS] Template status updated to ${targetStatus}!`,
      });
      fetchTemplates();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    try {
      const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');

      setActionMessage({ type: 'success', text: 'Template deleted successfully.' });
      fetchTemplates();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  // Helper to render live WhatsApp Preview bubble
  const renderWhatsAppBubble = (
    hType: string = headerType,
    hContent: string = header,
    bContent: string = body,
    fContent: string = footer,
    btns: CTAButton[] = ctaButtons
  ) => {
    // Replace {{n}} with testVariables or highlighted pills
    const formatBodyText = (text: string) => {
      if (!text) return 'Enter template body text...';
      const parts = text.split(/(\{\{\d+\}\})/g);
      return parts.map((part, idx) => {
        const match = part.match(/\{\{(\d+)\}\}/);
        if (match) {
          const varNum = match[1];
          const val = testVariables[varNum];
          return (
            <span
              key={idx}
              className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-mono text-xs font-semibold mx-0.5"
              title={`Variable {{${varNum}}}`}
            >
              {val || `{{${varNum}}}`}
            </span>
          );
        }
        return part;
      });
    };

    return (
      <div className="w-full max-w-sm mx-auto bg-[#efeae2] rounded-2xl p-4 shadow-md border border-slate-200 text-slate-800 font-sans text-sm relative">
        {/* WhatsApp Mobile Chat Header bar */}
        <div className="bg-[#075e54] text-white px-3 py-2 -mx-4 -mt-4 mb-3 rounded-t-2xl flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-700 flex items-center justify-center font-bold text-xs">
              AI
            </div>
            <div>
              <p className="font-semibold text-xs leading-tight">OneAIAssist Official</p>
              <p className="text-[10px] text-emerald-200">Verified Business Account</p>
            </div>
          </div>
          <span className="material-symbols-outlined text-lg">more_vert</span>
        </div>

        {/* Message Bubble Card */}
        <div className="bg-white rounded-lg p-3.5 shadow-sm border border-slate-100 relative">
          {/* Header Rendering */}
          {hType === 'TEXT' && hContent && (
            <div className="font-bold text-slate-900 text-sm mb-2 pb-1 border-b border-slate-100">
              {hContent}
            </div>
          )}

          {hType === 'IMAGE' && (
            <div className="mb-2.5 rounded-md overflow-hidden bg-slate-100 border border-slate-200 aspect-video flex flex-col items-center justify-center text-slate-400">
              {hContent && hContent.startsWith('http') ? (
                <img src={hContent} alt="Header" className="w-full h-full object-cover" />
              ) : (
                <>
                  <span className="material-symbols-outlined text-3xl">image</span>
                  <span className="text-[11px] mt-1 font-medium text-slate-500">Image Header</span>
                </>
              )}
            </div>
          )}

          {hType === 'DOCUMENT' && (
            <div className="mb-2.5 p-2.5 rounded-md bg-slate-50 border border-slate-200 flex items-center gap-2.5 text-slate-700">
              <span className="material-symbols-outlined text-red-500 text-2xl">picture_as_pdf</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate">{hContent || 'Document.pdf'}</p>
                <p className="text-[10px] text-slate-400">PDF • Attachment</p>
              </div>
            </div>
          )}

          {hType === 'VIDEO' && (
            <div className="mb-2.5 rounded-md overflow-hidden bg-slate-900 aspect-video flex flex-col items-center justify-center text-white">
              <span className="material-symbols-outlined text-3xl text-emerald-400">play_circle</span>
              <span className="text-[10px] mt-1 text-slate-300">Video Header</span>
            </div>
          )}

          {/* Body Content */}
          <div className="whitespace-pre-wrap leading-relaxed text-slate-800 text-[13px]">
            {formatBodyText(bContent)}
          </div>

          {/* Footer Rendering */}
          {fContent && (
            <div className="mt-2 pt-1.5 text-[11px] text-slate-400 font-medium border-t border-slate-50">
              {fContent}
            </div>
          )}

          {/* Time & Read Receipts */}
          <div className="mt-1.5 flex items-center justify-end gap-1 text-[10px] text-slate-400">
            <span>10:45 AM</span>
            <span className="material-symbols-outlined text-sky-500 text-xs">done_all</span>
          </div>
        </div>

        {/* CTA Buttons list attached below bubble */}
        {btns && btns.length > 0 && (
          <div className="mt-1 space-y-1">
            {btns.map((btn, idx) => (
              <div
                key={idx}
                className="bg-white hover:bg-slate-50 text-[#004ac6] font-semibold text-xs py-2 px-3 rounded-lg text-center shadow-sm border border-slate-200 flex items-center justify-center gap-1.5 transition-colors"
              >
                {btn.type === 'QUICK_REPLY' && <span className="material-symbols-outlined text-sm">reply</span>}
                {btn.type === 'URL' && <span className="material-symbols-outlined text-sm">open_in_new</span>}
                {btn.type === 'PHONE' && <span className="material-symbols-outlined text-sm">call</span>}
                <span>{btn.text || `Button ${idx + 1}`}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Stats calculation
  const approvedCount = templates.filter((t) => t.status === 'APPROVED').length;
  const pendingCount = templates.filter((t) => t.status === 'PENDING').length;
  const draftCount = templates.filter((t) => t.status === 'DRAFT').length;
  const rejectedCount = templates.filter((t) => t.status === 'REJECTED').length;

  return (
    <div className="space-y-6 text-[#1c1b1f] font-sans">
      {/* Top Banner Action Messages */}
      {actionMessage && (
        <div
          className={`p-4 rounded-xl text-sm font-medium flex items-center justify-between shadow-sm transition-all border ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">
              {actionMessage.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <span>{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-xs font-semibold underline hover:opacity-75"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header Title Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#004ac6] text-3xl">
              description
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              WhatsApp Template Manager
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Author, test, and manage HSM message templates with Meta WhatsApp Business approval workflow.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsEmailModalOpen(true)}
            className="px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-150 flex items-center gap-2 shadow-sm bg-indigo-600 text-white hover:bg-indigo-700"
          >
            <span className="material-symbols-outlined text-lg">mail</span>
            <span>Design Email Template</span>
          </button>

          <button
            onClick={() => {
              if (activeTab === 'create') {
                setActiveTab('list');
                resetForm();
              } else {
                resetForm();
                setActiveTab('create');
              }
            }}
            className="px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-150 flex items-center gap-2 shadow-sm bg-[#004ac6] text-white hover:bg-[#0039a0]"
          >
            <span className="material-symbols-outlined text-lg">
              {activeTab === 'create' ? 'format_list_bulleted' : 'add'}
            </span>
            <span>{activeTab === 'create' ? 'Back to Templates' : 'Create WhatsApp Template'}</span>
          </button>
        </div>
      </div>

      {/* Overview Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Approved Templates</span>
            <span className="material-symbols-outlined text-emerald-500 text-lg">check_circle</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1">{approvedCount}</p>
          <p className="text-[11px] text-emerald-600 font-medium mt-0.5">Ready for broadcasts</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Pending Meta Approval</span>
            <span className="material-symbols-outlined text-amber-500 text-lg">hourglass_top</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1">{pendingCount}</p>
          <p className="text-[11px] text-amber-600 font-medium mt-0.5">Under review</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Drafts</span>
            <span className="material-symbols-outlined text-slate-400 text-lg">edit_note</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1">{draftCount}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Not submitted yet</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Rejected</span>
            <span className="material-symbols-outlined text-rose-500 text-lg">cancel</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1">{rejectedCount}</p>
          <p className="text-[11px] text-rose-600 font-medium mt-0.5">Needs policy fixes</p>
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === 'list' ? (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-80">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-lg">
                search
              </span>
              <input
                type="text"
                placeholder="Search templates by name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#004ac6]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <select
                value={channelFilter}
                onChange={(e: any) => setChannelFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#004ac6]"
              >
                <option value="ALL">All Channels</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="EMAIL">Email Marketing</option>
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#004ac6]"
              >
                <option value="ALL">All Categories</option>
                <option value="MARKETING">Marketing</option>
                <option value="UTILITY">Utility</option>
                <option value="AUTHENTICATION">Authentication</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#004ac6]"
              >
                <option value="ALL">All Statuses</option>
                <option value="APPROVED">Approved</option>
                <option value="PENDING">Pending</option>
                <option value="DRAFT">Draft</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
          </div>

          {/* Templates Grid List */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-56 bg-white rounded-2xl border border-slate-200 p-5 animate-pulse space-y-3">
                  <div className="h-5 bg-slate-100 rounded w-2/3" />
                  <div className="h-4 bg-slate-100 rounded w-1/3" />
                  <div className="h-16 bg-slate-100 rounded" />
                </div>
              ))}
            </div>
          ) : templates.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-lg mx-auto">
              <span className="material-symbols-outlined text-5xl text-slate-300">description</span>
              <h3 className="text-lg font-bold text-slate-800 mt-2">No templates found</h3>
              <p className="text-sm text-slate-500 mt-1">
                Get started by creating your first WhatsApp HSM template.
              </p>
              <button
                onClick={() => {
                  resetForm();
                  setActiveTab('create');
                }}
                className="mt-5 px-5 py-2.5 rounded-xl bg-[#004ac6] text-white text-sm font-semibold hover:bg-[#0039a0] transition-colors"
              >
                Create Template
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {templates.map((tpl) => {
                const varsCount = (tpl.body.match(/\{\{\d+\}\}/g) || []).length;
                return (
                  <div
                    key={tpl.id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between hover:shadow-md transition-shadow relative"
                  >
                    <div>
                      {/* Top status & category */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5">
                          {tpl.channel === 'EMAIL' ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs">mail</span>
                              Email
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs">chat</span>
                              WhatsApp
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase bg-slate-100 text-slate-700">
                            {tpl.category}
                          </span>
                        </div>

                        {tpl.status === 'APPROVED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Approved
                          </span>
                        )}
                        {tpl.status === 'PENDING' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            Pending Meta
                          </span>
                        )}
                        {tpl.status === 'DRAFT' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            Draft
                          </span>
                        )}
                        {tpl.status === 'REJECTED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            Rejected
                          </span>
                        )}
                      </div>

                      {/* Template Name */}
                      <h3 className="font-bold text-slate-900 text-base font-mono truncate" title={tpl.name}>
                        {tpl.name}
                      </h3>
                      <p className="text-xs text-slate-400 font-medium mb-3">Language: {tpl.language.toUpperCase()}</p>

                      {/* Rejection Reason Warning */}
                      {tpl.status === 'REJECTED' && tpl.rejectionReason && (
                        <div className="mb-3 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                          <p className="font-semibold flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">warning</span>
                            Rejection Reason:
                          </p>
                          <p className="mt-0.5 text-[11px]">{tpl.rejectionReason}</p>
                        </div>
                      )}

                      {/* Body Snippet */}
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-slate-600 line-clamp-3 mb-3 whitespace-pre-wrap font-sans">
                        {tpl.body}
                      </div>

                      {/* Metadata row */}
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium mb-4">
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs text-blue-600">data_object</span>
                          {varsCount} variables
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs text-slate-400">touch_app</span>
                          {tpl.ctaButtons?.length || 0} CTA buttons
                        </span>
                      </div>
                    </div>

                    {/* Bottom Action buttons */}
                    <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <button
                          onClick={() => setPreviewTemplate(tpl)}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">visibility</span>
                          <span>Preview</span>
                        </button>

                        {tpl.status === 'DRAFT' && (
                          <button
                            onClick={() => handleSubmitForApproval(tpl.id)}
                            className="px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold flex items-center gap-1 transition-colors"
                          >
                            <span className="material-symbols-outlined text-sm">send</span>
                            <span>Submit Meta</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleDeleteTemplate(tpl.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Delete template"
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      </div>

                      {/* DEV SIMULATOR BUTTONS BAR */}
                      <div className="bg-slate-50 p-2 rounded-xl border border-dashed border-slate-300 mt-1">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
                          <span>Dev State Simulator</span>
                          <span className="text-blue-600 font-mono">LOCAL TEST</span>
                        </p>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleSimulateStatus(tpl.id, 'APPROVED')}
                            className="flex-1 py-1 px-2 rounded bg-emerald-600 text-white text-[10px] font-bold hover:bg-emerald-700 transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() =>
                              handleSimulateStatus(
                                tpl.id,
                                'REJECTED',
                                'Body violates WhatsApp promotional guidelines.'
                              )
                            }
                            className="flex-1 py-1 px-2 rounded bg-rose-600 text-white text-[10px] font-bold hover:bg-rose-700 transition-colors"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => handleSimulateStatus(tpl.id, 'DRAFT')}
                            className="py-1 px-2 rounded bg-slate-200 text-slate-700 text-[10px] font-bold hover:bg-slate-300 transition-colors"
                          >
                            Draft
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* CREATE / EDIT FORM WITH REALTIME PREVIEW PANEL */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Form Controls */}
          <div className="lg:col-span-7 space-y-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center justify-between">
              <span>Template Specifications</span>
              <span className="text-xs font-normal text-slate-400">Match Stitch Spec</span>
            </h2>

            {/* Template Name */}
            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 tracking-wider mb-1">
                Template Name *
              </label>
              <input
                type="text"
                placeholder="e.g. welcome_policy_discount"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#004ac6]"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Lowercase letters, numbers, and underscores only. Automatically formatted.
              </p>
            </div>

            {/* Category & Language */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 tracking-wider mb-1">
                  Category *
                </label>
                <select
                  value={category}
                  onChange={(e: any) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#004ac6]"
                >
                  <option value="MARKETING">MARKETING (Promotions, updates)</option>
                  <option value="UTILITY">UTILITY (Transactional, receipts)</option>
                  <option value="AUTHENTICATION">AUTHENTICATION (OTP codes)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 tracking-wider mb-1">
                  Language *
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#004ac6]"
                >
                  <option value="en">English (en)</option>
                  <option value="es">Spanish (es)</option>
                  <option value="pt_BR">Portuguese (pt_BR)</option>
                  <option value="fr">French (fr)</option>
                  <option value="de">German (de)</option>
                </select>
              </div>
            </div>

            {/* Header Type & Header Content */}
            <div className="space-y-3">
              <label className="block text-xs font-bold uppercase text-slate-600 tracking-wider">
                Header Type (Optional)
              </label>
              <div className="flex flex-wrap gap-2">
                {['NONE', 'TEXT', 'IMAGE', 'DOCUMENT', 'VIDEO'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setHeaderType(type)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                      headerType === type
                        ? 'bg-[#004ac6] text-white border-[#004ac6] shadow-sm'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              {headerType !== 'NONE' && (
                <div className="mt-2">
                  <input
                    type="text"
                    placeholder={
                      headerType === 'TEXT'
                        ? 'Enter header text (e.g. Special Policy Offer!)'
                        : 'Enter URL or media asset name'
                    }
                    value={header}
                    onChange={(e) => setHeader(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#004ac6]"
                  />
                </div>
              )}
            </div>

            {/* Body Text Editor */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold uppercase text-slate-600 tracking-wider">
                  Body Text *
                </label>
                <button
                  type="button"
                  onClick={handleInsertVariable}
                  className="text-xs font-bold text-[#004ac6] hover:underline flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">add_circle</span>
                  Insert Variable {"{{1}}"}
                </button>
              </div>
              <textarea
                rows={5}
                placeholder="Hello {{1}}, your policy renewal quote of {{2}} is ready! Reply YES to confirm."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#004ac6] leading-relaxed"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Use {"{{1}}"}, {"{{2}}"} for dynamic customer variables. Max 1024 characters.
              </p>
            </div>

            {/* Footer Text */}
            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 tracking-wider mb-1">
                Footer Text (Optional)
              </label>
              <input
                type="text"
                placeholder="Reply STOP to unsubscribe."
                value={footer}
                onChange={(e) => setFooter(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#004ac6]"
              />
            </div>

            {/* CTA Buttons Builder */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold uppercase text-slate-600 tracking-wider">
                  Call-to-Action Buttons (Max 3)
                </label>
                {ctaButtons.length < 3 && (
                  <button
                    type="button"
                    onClick={handleAddButton}
                    className="text-xs font-bold text-[#004ac6] hover:underline flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-sm">add</span>
                    Add Button
                  </button>
                )}
              </div>

              {ctaButtons.length === 0 ? (
                <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-xl border border-slate-100">
                  No CTA buttons added yet. Click &quot;Add Button&quot; to attach quick reply or link actions.
                </p>
              ) : (
                <div className="space-y-3">
                  {ctaButtons.map((btn, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 relative"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700">Button #{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveButton(idx)}
                          className="text-xs font-semibold text-rose-600 hover:underline"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <select
                          value={btn.type}
                          onChange={(e: any) =>
                            handleUpdateButton(idx, { ...btn, type: e.target.value })
                          }
                          className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-700"
                        >
                          <option value="QUICK_REPLY">Quick Reply</option>
                          <option value="URL">Website URL</option>
                          <option value="PHONE">Phone Number</option>
                        </select>

                        <input
                          type="text"
                          placeholder="Button Text (e.g. View Quote)"
                          value={btn.text}
                          onChange={(e) =>
                            handleUpdateButton(idx, { ...btn, text: e.target.value })
                          }
                          className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-800"
                        />
                      </div>

                      {btn.type === 'URL' && (
                        <input
                          type="text"
                          placeholder="https://example.com/quote?id={{1}}"
                          value={btn.url || ''}
                          onChange={(e) =>
                            handleUpdateButton(idx, { ...btn, url: e.target.value })
                          }
                          className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-mono text-slate-800"
                        />
                      )}

                      {btn.type === 'PHONE' && (
                        <input
                          type="text"
                          placeholder="+1 (800) 555-0199"
                          value={btn.phoneNumber || ''}
                          onChange={(e) =>
                            handleUpdateButton(idx, { ...btn, phoneNumber: e.target.value })
                          }
                          className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-800"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Submit Action Controls */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => handleSaveTemplate(false)}
                disabled={isSubmittingForm}
                className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
              >
                Save as Draft
              </button>

              <button
                type="button"
                onClick={() => handleSaveTemplate(true)}
                disabled={isSubmittingForm}
                className="px-5 py-2.5 rounded-xl bg-[#004ac6] text-white text-sm font-semibold hover:bg-[#0039a0] transition-colors flex items-center gap-2 shadow-sm"
              >
                <span className="material-symbols-outlined text-lg">send</span>
                <span>Submit to Meta</span>
              </button>
            </div>
          </div>

          {/* Right Column: Real-time Live Preview Panel */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm sticky top-6">
              <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center justify-between">
                <span>Real-Time WhatsApp Preview</span>
                <span className="material-symbols-outlined text-emerald-600">smartphone</span>
              </h2>

              <p className="text-xs text-slate-500 my-4">
                This live bubble shows how your template renders on a customer&apos;s WhatsApp client.
              </p>

              {/* Render WhatsApp Phone Screen */}
              {renderWhatsAppBubble()}

              {/* Variable Value Testing Panel */}
              <div className="mt-6 pt-4 border-t border-slate-100 space-y-3">
                <p className="text-xs font-bold uppercase text-slate-600 tracking-wider">
                  Test Variable Values (Preview Only)
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {['1', '2', '3'].map((num) => (
                    <div key={num}>
                      <label className="text-[10px] font-bold text-slate-400 font-mono block">
                        {`{{${num}}}`}
                      </label>
                      <input
                        type="text"
                        value={testVariables[num] || ''}
                        onChange={(e) =>
                          setTestVariables({ ...testVariables, [num]: e.target.value })
                        }
                        className="w-full px-2 py-1 rounded bg-slate-50 border border-slate-200 text-xs text-slate-700"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal for detailed template view / preview */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-lg font-mono">{previewTemplate.name}</h3>
                <p className="text-xs text-slate-500">
                  Category: {previewTemplate.category} • Status: {previewTemplate.status}
                </p>
              </div>
              <button
                onClick={() => setPreviewTemplate(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div>
              {renderWhatsAppBubble(
                previewTemplate.headerType,
                previewTemplate.header,
                previewTemplate.body,
                previewTemplate.footer,
                previewTemplate.ctaButtons
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setPreviewTemplate(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold text-xs hover:bg-slate-200 transition-colors"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Visual Email Template Editor Modal */}
      <EmailTemplateEditorModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        onSave={async (tplData) => {
          const res = await fetch('/api/templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: tplData.name,
              channel: 'EMAIL',
              subject: tplData.subject,
              previewText: tplData.previewText,
              htmlBody: tplData.htmlBody,
              plainText: tplData.plainText,
              jsonDesign: tplData.jsonDesign,
              body: tplData.plainText,
            }),
          });
          const data = await res.json();
          if (!res.ok) {
            setActionMessage({ type: 'error', text: data.error || 'Failed to save email template' });
          } else {
            setActionMessage({ type: 'success', text: `Email template "${tplData.name}" created successfully!` });
            fetchTemplates();
          }
        }}
      />
    </div>
  );
}
