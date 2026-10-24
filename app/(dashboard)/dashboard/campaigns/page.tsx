'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SearchableTagSelect } from '@/components/ui/searchable-tag-select';
import { useTenantInfo } from '@/hooks/useTenantInfo';
import { getClientSocket } from '@/lib/socket-client';

type TemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
type TemplateStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED';

interface Template {
  id: string;
  name: string;
  channel?: 'WHATSAPP' | 'EMAIL' | 'INSTAGRAM';
  category: TemplateCategory;
  language: string;
  subject?: string | null;
  htmlBody?: string | null;
  body: string;
  header?: string | null;
  footer?: string | null;
  ctaButtons?: any | null;
  status: TemplateStatus;
  createdAt: string;
}

interface Campaign {
  id: string;
  name: string;
  channel?: 'WHATSAPP' | 'EMAIL' | 'INSTAGRAM';
  subject?: string | null;
  previewText?: string | null;
  templateId?: string | null;
  recipientFilter?: any | null;
  scheduledAt?: string | null;
  status: string;
  sent: number;
  delivered: number;
  read: number;
  replied: number;
  converted: number;
  failed: number;
  optedOut: number;
  cost: number;
  createdAt: string;
  template?: Template | null;
}

export default function BroadcastCenterPage() {
  const queryClient = useQueryClient();
  const { data: info } = useTenantInfo();
  const tenantId = info?.tenantId;
  const templateBodyRef = useRef<HTMLTextAreaElement>(null);

  // Form State
  const [campaignName, setCampaignName] = useState('');
  const [campaignChannel, setCampaignChannel] = useState<'WHATSAPP' | 'EMAIL'>('WHATSAPP');
  const [emailSubject, setEmailSubject] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [isAbTest, setIsAbTest] = useState(false);
  const [abSubjectB, setAbSubjectB] = useState('');
  const [abTemplateIdB, setAbTemplateIdB] = useState('');
  const [abSplit, setAbSplit] = useState(50);
  const [abMetric, setAbMetric] = useState<'CLICKS' | 'OPENS'>('CLICKS');
  const [recipientType, setRecipientType] = useState<'all' | 'tag' | 'stage' | 'date_range' | 'email_engagement'>('all');
  const [emailActivityFilter, setEmailActivityFilter] = useState<'OPENED_LAST_30_DAYS' | 'CLICKED_ANY' | 'NEVER_BOUNCED'>('OPENED_LAST_30_DAYS');
  const [filterValue, setFilterValue] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [scheduleType, setScheduleType] = useState<'now' | 'later'>('now');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');

  // Personalization Value State (for live preview mapping)
  const [varName, setVarName] = useState('John Doe');
  const [varPolicy, setVarPolicy] = useState('POL-99281');
  const [varLastInteraction, setVarLastInteraction] = useState('Oct 22, 2026');
  const [varDueDate, setVarDueDate] = useState('Oct 24, 2026');

  // Modals state
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateCategory, setTemplateCategory] = useState<TemplateCategory>('MARKETING');
  const [templateLanguage, setTemplateLanguage] = useState('en');
  const [templateBody, setTemplateBody] = useState('Hello {{name}},\n\nYour policy number {{policy_number}} is due for renewal.\n\nBest regards,\nApex Assurance');
  const [templateHeader, setTemplateHeader] = useState('POLICY UPDATE');
  const [templateFooter, setTemplateFooter] = useState('Apex Auto-Assist Center');
  const [buttonLabel1, setButtonLabel1] = useState('Renew Now');
  const [buttonLabel2, setButtonLabel2] = useState('Contact Agent');

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Queries
  const { data: templates = [], isLoading: templatesLoading } = useQuery<Template[]>({
    queryKey: ['templates'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/templates');
      if (!res.ok) throw new Error('Failed to load templates');
      return res.json();
    },
  });

  // Auto-select first approved template if available
  useEffect(() => {
    if (templates.length > 0 && !selectedTemplateId) {
      const approved = templates.find((t) => t.status === 'APPROVED') || templates[0];
      if (approved) {
        setSelectedTemplateId(approved.id);
      }
    }
  }, [templates, selectedTemplateId]);

  const { data: campaigns = [], isLoading: campaignsLoading } = useQuery<Campaign[]>({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/broadcast');
      if (!res.ok) throw new Error('Failed to load campaigns');
      return res.json();
    },
    refetchInterval: 3000, // Poll every 3 seconds for live delivery/read updates
  });

  const { data: deliverabilityData } = useQuery({
    queryKey: ['emailDeliverability', tenantId],
    queryFn: async () => {
      const res = await fetch('/api/channels/email/deliverability');
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!tenantId && campaignChannel === 'EMAIL',
  });

  // Socket.io Live Status Listener
  useEffect(() => {
    if (!tenantId) return;

    const socketInstance = getClientSocket(tenantId);

    socketInstance.on('broadcast_stats_updated', (data: any) => {
      console.log('[Socket] Broadcast stats updated:', data);
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    });

    socketInstance.on('message_updated', (data: any) => {
      console.log('[Socket] Message updated event:', data);
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    });

    return () => {
      socketInstance.disconnect();
    };
  }, [tenantId, queryClient]);

  // Fetch preview count when filter variables change
  const [recipientCount, setRecipientCount] = useState(0);
  const [optedOutCount, setOptedOutCount] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    const fetchPreviewCounts = async () => {
      setPreviewLoading(true);
      try {
        let url = `/api/dashboard/broadcast?preview=true&channel=${campaignChannel}&type=${recipientType}`;
        if (recipientType === 'tag' || recipientType === 'stage') {
          url += `&value=${encodeURIComponent(filterValue)}`;
        } else if (recipientType === 'date_range') {
          url += `&start=${encodeURIComponent(filterStartDate)}&end=${encodeURIComponent(filterEndDate)}`;
        } else if (recipientType === 'email_engagement') {
          url += `&emailActivity=${encodeURIComponent(emailActivityFilter)}`;
        }
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setRecipientCount(data.recipientCount);
          setOptedOutCount(data.optedOutCount);
        }
      } catch (err) {
        console.error('Failed to load recipient counts', err);
      } finally {
        setPreviewLoading(false);
      }
    };

    fetchPreviewCounts();
  }, [campaignChannel, recipientType, filterValue, filterStartDate, filterEndDate, emailActivityFilter]);

  // Mutations
  const createTemplateMutation = useMutation({
    mutationFn: async (newTemplate: any) => {
      const res = await fetch('/api/dashboard/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTemplate),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create template');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setSelectedTemplateId(data.id);
      setIsTemplateModalOpen(false);
      // Reset form fields
      setTemplateName('');
      setTemplateBody('Hello {{name}},\n\nYour policy number {{policy_number}} is due for renewal.\n\nBest regards,\nApex Assurance');
      setTemplateHeader('POLICY UPDATE');
      setTemplateFooter('Apex Auto-Assist Center');
      setButtonLabel1('Renew Now');
      setButtonLabel2('Contact Agent');
      showNotification('success', 'WhatsApp template created and approved!');
    },
    onError: (err: any) => {
      showNotification('error', err.message);
    },
  });

  const sendCampaignMutation = useMutation({
    mutationFn: async (campaignData: any) => {
      const res = await fetch('/api/dashboard/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campaignData),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to send campaign');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      setCampaignName('');
      setScheduleType('now');
      setScheduleDate('');
      setScheduleTime('');
      showNotification('success', 'Broadcast campaign dispatched successfully!');
    },
    onError: (err: any) => {
      showNotification('error', err.message);
    },
  });

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleCreateTemplateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName.trim() || !templateBody.trim()) {
      showNotification('error', 'Please provide a name and body for the template.');
      return;
    }
    const ctaButtons = [];
    if (buttonLabel1.trim()) ctaButtons.push(buttonLabel1.trim());
    if (buttonLabel2.trim()) ctaButtons.push(buttonLabel2.trim());

    createTemplateMutation.mutate({
      name: templateName.trim(),
      category: templateCategory,
      language: templateLanguage,
      body: templateBody,
      header: templateHeader.trim() || null,
      footer: templateFooter.trim() || null,
      ctaButtons: ctaButtons.length > 0 ? ctaButtons : null,
      status: 'APPROVED',
    });
  };

  const handleSendCampaignSubmit = () => {
    if (!campaignName.trim()) {
      showNotification('error', 'Please enter a campaign name');
      return;
    }
    if (!selectedTemplateId) {
      showNotification('error', 'Please select a WhatsApp template');
      return;
    }

    const scheduledAt = scheduleType === 'later' && scheduleDate && scheduleTime
      ? `${scheduleDate}T${scheduleTime}:00`
      : null;

    sendCampaignMutation.mutate({
      name: campaignName.trim(),
      channel: campaignChannel,
      subject: campaignChannel === 'EMAIL' ? emailSubject : undefined,
      templateId: selectedTemplateId,
      isAbTest: campaignChannel === 'EMAIL' && isAbTest,
      abSubjectB: isAbTest ? abSubjectB : undefined,
      abTemplateIdB: isAbTest && abTemplateIdB ? abTemplateIdB : undefined,
      abTestSplit: isAbTest ? abSplit : undefined,
      abWinnerMetric: isAbTest ? abMetric : undefined,
      recipientFilter: {
        type: recipientType,
        value: recipientType === 'date_range' ? { start: filterStartDate, end: filterEndDate } : filterValue,
        emailActivity: recipientType === 'email_engagement' ? emailActivityFilter : undefined,
      },
      scheduledAt,
    });
  };

  // Find active template for preview rendering
  const activeTemplate = templates.find((t) => t.id === selectedTemplateId);

  // Clickable personalization chip helper
  const handleInsertVariable = (variable: string) => {
    if (isTemplateModalOpen && templateBodyRef.current) {
      const textarea = templateBodyRef.current;
      const startPos = textarea.selectionStart;
      const endPos = textarea.selectionEnd;
      const placeholder = `{{${variable}}}`;
      const newValue = templateBody.substring(0, startPos) + placeholder + templateBody.substring(endPos);
      setTemplateBody(newValue);
      
      // Refocus textarea and place cursor after inserted text
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(startPos + placeholder.length, startPos + placeholder.length);
      }, 50);
    } else {
      // Micro-interaction highlight if not in modal
      showNotification('success', `Clicked chip: Variable {{${variable}}} will map to target user's records.`);
    }
  };

  // Helper to split body text and highlight variable placeholders
  const renderHighlightedBody = (bodyText: string) => {
    const parts = bodyText.split(/(\{\{[a-zA-Z0-9_-]+\}\})/g);
    return parts.map((part, index) => {
      const match = part.match(/^\{\{([a-zA-Z0-9_-]+)\}\}$/);
      if (match) {
        const varKey = match[1];
        let displayValue = part;
        if (varKey === 'name') displayValue = varName;
        else if (varKey === 'policy_number') displayValue = varPolicy;
        else if (varKey === 'last_interaction') displayValue = varLastInteraction;
        else if (varKey === 'due_date') displayValue = varDueDate;

        return (
          <span 
            key={index} 
            className="bg-[#004ac6]/15 text-[#004ac6] font-bold px-1.5 py-0.5 rounded border border-[#004ac6]/10 text-[11px] inline-block hover:scale-105 transition-transform cursor-help"
            title={`Placeholder: {{${varKey}}}`}
          >
            {displayValue}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  // Deterministic date/time formatting to prevent SSR hydration mismatches
  const formatTimeString = (dateInput: string | Date) => {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '';
    let hours = date.getUTCHours();
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const hoursStr = hours.toString().padStart(2, '0');
    return `${hoursStr}:${minutes} ${ampm}`;
  };

  const formatDateString = (dateInput: string | Date) => {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
  };

  // Compute estimated cost
  const computeEstimatedCost = () => {
    let rate = 0.020; // Default MARKETING
    if (activeTemplate?.category === 'UTILITY') {
      rate = 0.010;
    } else if (activeTemplate?.category === 'AUTHENTICATION') {
      rate = 0.005;
    }
    return recipientCount * rate;
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-50/60 relative overflow-y-auto">
      {/* Alert Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-6 px-5 py-3 rounded-2xl shadow-xl z-50 flex items-center gap-2 border font-bold text-xs ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            {notification.type === 'success' ? 'check_circle' : 'warning'}
          </span>
          {notification.message}
        </div>
      )}

      {/* Main Header */}
      <header className="sticky top-0 z-20 bg-white border-b border-slate-200/80 h-16 flex items-center justify-between px-8 shrink-0 shadow-xs">
        <div>
          <h2 className="text-base font-bold tracking-tight text-slate-900">
            Omnichannel Broadcast Center
          </h2>
          <p className="text-[11px] text-slate-500 font-medium">
            Deploy bulk WhatsApp messages and automated email campaigns to qualified lead cohorts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => showNotification('success', 'Campaign saved as Draft')}
            className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-600 transition-all shadow-xs"
          >
            Save as Draft
          </button>
          <button
            type="button"
            onClick={handleSendCampaignSubmit}
            disabled={sendCampaignMutation.isPending}
            className="px-5 py-2 rounded-xl bg-[#1B4B91] hover:bg-[#163e78] text-white font-bold text-xs shadow-xs transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">send</span>
            {sendCampaignMutation.isPending ? 'Sending...' : 'Schedule / Send Broadcast'}
          </button>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 p-8 max-w-[1100px] w-full mx-auto space-y-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Form Controls (7 cols) */}
          <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
            {/* Campaign Name */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                Campaign Name
              </label>
              <input
                type="text"
                placeholder="e.g. Policy Renewal Reminder Oct-23"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#1B4B91] focus:bg-white focus:ring-2 focus:ring-[#1B4B91]/10 transition-all font-semibold"
              />
            </div>

            {/* Channel Selector */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#49454f] uppercase tracking-wide">
                Campaign Channel
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setCampaignChannel('WHATSAPP');
                    setSelectedTemplateId('');
                  }}
                  className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                    campaignChannel === 'WHATSAPP'
                      ? 'border-[#004ac6] bg-[#004ac6]/10 text-[#004ac6]'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">chat</span>
                  WhatsApp Broadcast
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCampaignChannel('EMAIL');
                    setSelectedTemplateId('');
                  }}
                  className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                    campaignChannel === 'EMAIL'
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">mail</span>
                  Email Marketing
                </button>
              </div>

              {campaignChannel === 'EMAIL' && deliverabilityData?.isAutoPaused && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl flex items-center justify-between text-xs text-rose-900 font-semibold animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-rose-600 text-lg">block</span>
                    <span>
                      Email sending is auto-paused (Spam complaints: {deliverabilityData.metrics.complaintRate}% &ge; 0.3%).
                    </span>
                  </div>
                  <a
                    href="/dashboard/settings"
                    className="text-xs text-rose-700 underline font-bold hover:text-rose-950 whitespace-nowrap ml-2"
                  >
                    Channel Settings &rarr;
                  </a>
                </div>
              )}

              {campaignChannel === 'EMAIL' && deliverabilityData?.isWarning && !deliverabilityData?.isAutoPaused && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-center gap-2 text-xs text-amber-900 font-semibold animate-in fade-in">
                  <span className="material-symbols-outlined text-amber-600 text-lg">warning</span>
                  <span>
                    Warning: Elevated complaints ({deliverabilityData.metrics.complaintRate}%). Approaching 0.3% auto-pause limit.
                  </span>
                </div>
              )}
            </div>

            {campaignChannel === 'EMAIL' && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-[#49454f] uppercase tracking-wide">
                  Email Subject Line *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Special Offer for Policyholders, {{first_name}}"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full bg-white border border-[#c3c6d7] rounded-xl px-4 py-2.5 text-xs text-[#1c1b1f] focus:outline-none focus:border-[#004ac6] focus:ring-2 focus:ring-[#004ac6]/10 transition-all font-semibold"
                />
              </div>
            )}

            {/* 1. Template Selector */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-[#49454f] uppercase tracking-wide">
                  1. Select {campaignChannel === 'EMAIL' ? 'Email' : 'WhatsApp'} Template
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (campaignChannel === 'EMAIL') {
                      window.location.href = '/dashboard/templates';
                    } else {
                      setIsTemplateModalOpen(true);
                    }
                  }}
                  className="text-[10px] text-[#004ac6] font-bold hover:underline"
                >
                  + {campaignChannel === 'EMAIL' ? 'Manage Email Templates' : 'Create New Template'}
                </button>
              </div>
              {templatesLoading ? (
                <div className="h-10 bg-slate-100 rounded-xl animate-pulse" />
              ) : (
                <select
                  suppressHydrationWarning
                  value={selectedTemplateId}
                  onChange={(e) => {
                    setSelectedTemplateId(e.target.value);
                    const chosen = templates.find((t) => t.id === e.target.value);
                    if (chosen && chosen.subject && !emailSubject) {
                      setEmailSubject(chosen.subject);
                    }
                  }}
                  className="w-full bg-white border border-[#c3c6d7] rounded-xl px-4 py-2.5 text-xs text-[#1c1b1f] focus:outline-none focus:border-[#004ac6] transition-all font-semibold"
                >
                  <option value="">-- Choose {campaignChannel === 'EMAIL' ? 'Email' : 'Approved WhatsApp'} Template --</option>
                  {templates
                    .filter((tpl) => (campaignChannel === 'EMAIL' ? tpl.channel === 'EMAIL' : tpl.channel !== 'EMAIL'))
                    .map((tpl) => (
                      <option
                        key={tpl.id}
                        value={tpl.id}
                        disabled={campaignChannel === 'WHATSAPP' && tpl.status !== undefined && tpl.status !== 'APPROVED'}
                      >
                        {tpl.category}: {tpl.name} ({tpl.language}) {tpl.status ? `[${tpl.status}]` : ''}
                      </option>
                    ))}
                </select>
              )}
              {/* A/B Testing Section for Email Marketing */}
              {campaignChannel === 'EMAIL' && (
                <div className="p-4 bg-indigo-50/60 rounded-xl border border-indigo-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-indigo-900 flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isAbTest}
                        onChange={(e) => setIsAbTest(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Enable A/B Subject & Content Testing</span>
                    </label>
                    <span className="text-[10px] uppercase font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">
                      50 / 50 Split
                    </span>
                  </div>

                  {isAbTest && (
                    <div className="space-y-3 pt-2 border-t border-indigo-100 text-xs">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                          Variant B Subject Line *
                        </label>
                        <input
                          type="text"
                          value={abSubjectB}
                          onChange={(e) => setAbSubjectB(e.target.value)}
                          placeholder="e.g. Quick reminder: save on your coverage today"
                          className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                            Winner Metric
                          </label>
                          <select
                            value={abMetric}
                            onChange={(e: any) => setAbMetric(e.target.value)}
                            className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-1.5 text-xs font-semibold outline-none"
                          >
                            <option value="CLICKS">Highest Clicks (Recommended)</option>
                            <option value="OPENS">Highest Opens (Approximate)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                            Test Split
                          </label>
                          <select
                            value={abSplit}
                            onChange={(e: any) => setAbSplit(Number(e.target.value))}
                            className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-1.5 text-xs font-semibold outline-none"
                          >
                            <option value="50">50% Variant A / 50% Variant B</option>
                            <option value="40">40% Variant A / 60% Variant B</option>
                            <option value="30">30% Variant A / 70% Variant B</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. Recipient Selector */}
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-[#49454f] uppercase tracking-wide block">
                2. Select Recipients
              </label>
              
              {/* Radio Grid matching Stitch mockup class style */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  className={`flex items-center gap-3 p-3.5 border rounded-xl cursor-pointer hover:bg-slate-50 transition-colors ${recipientType === 'all' ? 'border-[#004ac6] bg-[#004ac6]/5' : 'border-[#c3c6d7] bg-white'}`}
                >
                  <input
                    type="radio"
                    name="recipients"
                    value="all"
                    checked={recipientType === 'all'}
                    onChange={() => {
                      setRecipientType('all');
                      setFilterValue('');
                    }}
                    className="text-[#004ac6] focus:ring-[#004ac6]"
                  />
                  <span className="text-xs font-semibold text-[#1c1b1f]">All Contacts</span>
                </label>

                <label
                  className={`flex items-center gap-3 p-3.5 border rounded-xl cursor-pointer hover:bg-slate-50 transition-colors ${recipientType === 'tag' ? 'border-[#004ac6] bg-[#004ac6]/5' : 'border-[#c3c6d7] bg-white'}`}
                >
                  <input
                    type="radio"
                    name="recipients"
                    value="tag"
                    checked={recipientType === 'tag'}
                    onChange={() => {
                      setRecipientType('tag');
                      setFilterValue('');
                    }}
                    className="text-[#004ac6] focus:ring-[#004ac6]"
                  />
                  <span className="text-xs font-semibold text-[#1c1b1f]">By Tag</span>
                </label>

                <label
                  className={`flex items-center gap-3 p-3.5 border rounded-xl cursor-pointer hover:bg-slate-50 transition-colors ${recipientType === 'stage' ? 'border-[#004ac6] bg-[#004ac6]/5' : 'border-[#c3c6d7] bg-white'}`}
                >
                  <input
                    type="radio"
                    name="recipients"
                    value="stage"
                    checked={recipientType === 'stage'}
                    onChange={() => {
                      setRecipientType('stage');
                      setFilterValue('');
                    }}
                    className="text-[#004ac6] focus:ring-[#004ac6]"
                  />
                  <span className="text-xs font-semibold text-[#1c1b1f]">By Pipeline Stage</span>
                </label>

                <label
                  className={`flex items-center gap-3 p-3.5 border rounded-xl cursor-pointer hover:bg-slate-50 transition-colors ${recipientType === 'date_range' ? 'border-[#004ac6] bg-[#004ac6]/5' : 'border-[#c3c6d7] bg-white'}`}
                >
                  <input
                    type="radio"
                    name="recipients"
                    value="date_range"
                    checked={recipientType === 'date_range'}
                    onChange={() => {
                      setRecipientType('date_range');
                      setFilterValue('');
                      if (!filterStartDate && !filterEndDate) {
                        const today = new Date().toISOString().split('T')[0];
                        setFilterStartDate(today);
                        setFilterEndDate(today);
                      }
                    }}
                    className="text-[#004ac6] focus:ring-[#004ac6]"
                  />
                  <span className="text-xs font-semibold text-[#1c1b1f]">By Date Range</span>
                </label>

                {campaignChannel === 'EMAIL' && (
                  <label
                    className={`flex items-center gap-3 p-3.5 border rounded-xl cursor-pointer hover:bg-slate-50 transition-colors ${recipientType === 'email_engagement' ? 'border-[#004ac6] bg-[#004ac6]/5' : 'border-[#c3c6d7] bg-white'}`}
                  >
                    <input
                      type="radio"
                      name="recipients"
                      value="email_engagement"
                      checked={recipientType === 'email_engagement'}
                      onChange={() => {
                        setRecipientType('email_engagement');
                        setFilterValue('');
                      }}
                      className="text-[#004ac6] focus:ring-[#004ac6]"
                    />
                    <span className="text-xs font-semibold text-[#1c1b1f]">By Engagement / Activity</span>
                  </label>
                )}
              </div>

              {/* Recipient inputs fields */}
              {recipientType === 'tag' && (
                <div className="space-y-1 pt-1.5 animate-in fade-in duration-200">
                  <label className="text-[9px] text-[#737686] font-bold block">Filter by Tag</label>
                  <SearchableTagSelect
                    value={filterValue}
                    onChange={setFilterValue}
                  />
                </div>
              )}

              {recipientType === 'stage' && (
                <div className="space-y-1 pt-1.5 animate-in fade-in duration-200">
                  <label htmlFor="pipeline-stage-select" className="text-[9px] text-[#737686] font-bold block">Pipeline Stage</label>
                  <select
                    id="pipeline-stage-select"
                    value={filterValue}
                    onChange={(e) => setFilterValue(e.target.value)}
                    className="w-full bg-slate-50 border border-[#c3c6d7] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#004ac6] font-bold text-[#1c1b1f]"
                  >
                    <option value="">-- Choose Stage --</option>
                    <option value="NEW">New Lead</option>
                    <option value="QUALIFIED">Qualified</option>
                    <option value="NEGOTIATION">Negotiation</option>
                    <option value="CONVERTED">Won/Converted</option>
                    <option value="LOST">Lost</option>
                  </select>
                </div>
              )}

              {recipientType === 'date_range' && (
                <div className="space-y-2 pt-1.5 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-[#49454f]">Filter by Created Date</span>
                    <button
                      type="button"
                      onClick={() => {
                        const today = new Date().toISOString().split('T')[0];
                        setFilterStartDate(today);
                        setFilterEndDate(today);
                      }}
                      className="text-[10px] text-[#004ac6] font-bold hover:underline"
                    >
                      Set to Today
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label htmlFor="start-date-input" className="text-[9px] text-[#737686] font-bold block">From Created Date</label>
                      <input
                        id="start-date-input"
                        type="date"
                        value={filterStartDate}
                        onChange={(e) => setFilterStartDate(e.target.value)}
                        className="w-full bg-slate-50 border border-[#c3c6d7] rounded-xl px-3 py-1.5 text-xs focus:outline-none text-[#1c1b1f] font-semibold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="end-date-input" className="text-[9px] text-[#737686] font-bold block">To Created Date</label>
                      <input
                        id="end-date-input"
                        type="date"
                        value={filterEndDate}
                        onChange={(e) => setFilterEndDate(e.target.value)}
                        className="w-full bg-slate-50 border border-[#c3c6d7] rounded-xl px-3 py-1.5 text-xs focus:outline-none text-[#1c1b1f] font-semibold"
                      />
                    </div>
                  </div>
                </div>
              )}

              {recipientType === 'email_engagement' && (
                <div className="space-y-1 pt-1.5 animate-in fade-in duration-200">
                  <label htmlFor="email-engagement-select" className="text-[9px] text-[#737686] font-bold block">
                    Email Behavioral Activity
                  </label>
                  <select
                    id="email-engagement-select"
                    value={emailActivityFilter}
                    onChange={(e: any) => setEmailActivityFilter(e.target.value)}
                    className="w-full bg-slate-50 border border-[#c3c6d7] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#004ac6] font-bold text-[#1c1b1f]"
                  >
                    <option value="OPENED_LAST_30_DAYS">Opened an email in last 30 days</option>
                    <option value="CLICKED_ANY">Clicked any email link</option>
                    <option value="NEVER_BOUNCED">Clean reputation (Never bounced)</option>
                  </select>
                </div>
              )}

              {/* Real-time Recipient Badge */}
              <div className="pt-2 flex items-center">
                <div className="flex items-center gap-2 bg-[#dbe1ff] text-[#003ea8] px-4 py-2 rounded-full font-bold text-xs shadow-sm">
                  <span className="material-symbols-outlined text-[16px]">group</span>
                  <span>{previewLoading ? '...' : recipientCount.toLocaleString()} recipients targeted</span>
                </div>
              </div>
            </div>

            {/* 3. Personalization Variables insertion tags */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[#49454f] uppercase tracking-wide block">
                3. Personalization Variables
              </label>
              <div className="flex flex-wrap gap-2 items-center">
                {(['name', 'policy_number', 'last_interaction', 'due_date'] as const).map((variable) => (
                  <button
                    key={variable}
                    type="button"
                    onClick={() => handleInsertVariable(variable)}
                    className="px-3.5 py-1.5 bg-[#e7eeff] rounded-xl text-[11px] font-bold text-[#004ac6] hover:bg-[#004ac6]/10 active:scale-95 transition-all border border-[#004ac6]/10"
                  >
                    {"{{"}{variable}{"}}"}
                  </button>
                ))}
                <span className="text-[9px] text-slate-400 italic ml-2">
                  (Click to copy variable / Insert in composer)
                </span>
              </div>
            </div>

            {/* 4. Compliance & Opt-out notice info banner */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#49454f] uppercase tracking-wide block">
                4. Compliance & Opt-Out Protection
              </label>
              <div className="bg-red-50 border-l-4 border-red-500 p-3.5 rounded-r-xl flex items-center gap-2.5">
                <span className="material-symbols-outlined text-red-700 text-[18px]">block</span>
                <p className="text-[11px] text-red-950 font-bold">
                  {optedOutCount} opted-out contacts will be automatically excluded
                </p>
              </div>
            </div>

            {/* 5. Schedule section */}
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-[#49454f] uppercase tracking-wide block">
                5. Scheduling Options
              </label>
              <div className="space-y-2">
                <label
                  className="flex items-center gap-2.5 cursor-pointer font-bold text-xs text-[#1c1b1f]"
                >
                  <input
                    type="radio"
                    name="scheduleOptions"
                    value="now"
                    checked={scheduleType === 'now'}
                    onChange={() => setScheduleType('now')}
                    className="text-[#004ac6] focus:ring-[#004ac6]"
                  />
                  Send Now
                </label>
                <label
                  className="flex items-center gap-2.5 cursor-pointer font-bold text-xs text-[#1c1b1f]"
                >
                  <input
                    type="radio"
                    name="scheduleOptions"
                    value="later"
                    checked={scheduleType === 'later'}
                    onChange={() => setScheduleType('later')}
                    className="text-[#004ac6] focus:ring-[#004ac6]"
                  />
                  Schedule for Later
                </label>
              </div>

              {scheduleType === 'later' && (
                <div className="flex gap-4 pt-1 animate-in fade-in slide-in-from-top-1 duration-200 pl-6">
                  <div className="space-y-1">
                    <span className="text-[9px] text-[#737686] font-bold block">Start Date</span>
                    <input
                      type="date"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      className="bg-slate-50 border border-[#c3c6d7] rounded-xl px-3 py-1.5 text-xs text-[#1c1b1f] focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] text-[#737686] font-bold block">Start Time</span>
                    <input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      className="bg-slate-50 border border-[#c3c6d7] rounded-xl px-3 py-1.5 text-xs text-[#1c1b1f] focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 6. Cost estimate card */}
            <div className="bg-[#e7eeff] p-4 rounded-xl border border-[#c3c6d7]/70 flex items-start gap-3">
              <span className="material-symbols-outlined text-[#004ac6] text-[20px] font-bold">
                payments
              </span>
              <div>
                <p className="font-extrabold text-xs text-[#004ac6]">
                  Estimated cost: ${computeEstimatedCost().toFixed(2)}
                </p>
                <p className="text-[10px] text-[#49454f] font-medium mt-0.5">
                  ({recipientCount.toLocaleString()} conversations @ {activeTemplate?.category || 'MARKETING'} rate)
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Live preview sidebar window (5 cols) */}
          <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-4">
            <div className="bg-slate-900 p-4 rounded-[40px] border-[10px] border-slate-950 shadow-2xl relative overflow-hidden h-[490px] flex flex-col">
              {/* Wallpaper Background */}
              <div
                className="absolute inset-0 opacity-20 bg-cover bg-center pointer-events-none"
                style={{
                  backgroundImage:
                    "url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80')",
                }}
              />

              <div className="relative z-10 flex flex-col h-full">
                {/* Header Phone mockup bar */}
                <div className="bg-slate-900/90 backdrop-blur-md p-3 pb-3 rounded-t-2xl flex items-center gap-3 border-b border-slate-800">
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-extrabold text-xs shrink-0 border border-slate-600">
                    WA
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-slate-100">OneAIAssist Official</p>
                    <p className="text-[8px] text-green-500 font-bold">online</p>
                  </div>
                </div>

                {/* Simulated Messages Screen */}
                <div className="flex-1 p-4 flex flex-col gap-4 overflow-y-auto">
                  {/* WhatsApp bubble */}
                  <div className="bg-emerald-50 border border-emerald-100 p-3 shadow-md rounded-xl rounded-tl-sm max-w-[85%] self-start flex flex-col gap-1.5 relative text-xs">
                    {activeTemplate?.header && (
                      <p className="text-[10px] text-emerald-800 font-extrabold uppercase tracking-wide border-b border-emerald-100 pb-1">
                        {activeTemplate.header}
                      </p>
                    )}

                    {/* renderHighlightedBody replaces placeholders with colored blocks */}
                    <div className="text-slate-800 leading-relaxed font-semibold">
                      {activeTemplate 
                        ? renderHighlightedBody(activeTemplate.body)
                        : renderHighlightedBody("Hello {{name}},\n\nYour policy number {{policy_number}} is due for renewal on {{due_date}}.\n\nFooter: STOP to opt-out")
                      }
                    </div>

                    {activeTemplate?.footer && (
                      <p className="text-[9px] text-slate-500 italic mt-0.5 border-t border-emerald-100/50 pt-1">
                        {activeTemplate.footer}
                      </p>
                    )}

                    {activeTemplate?.ctaButtons && Array.isArray(activeTemplate.ctaButtons) && (
                      <div className="mt-2 space-y-1 border-t border-emerald-100/50 pt-2">
                        {activeTemplate.ctaButtons.map((btn: string, bIdx: number) => (
                          <button
                            key={bIdx}
                            type="button"
                            className="w-full py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-[11px] font-bold text-[#004ac6] rounded-lg shadow-sm text-center"
                          >
                            {btn}
                          </button>
                        ))}
                      </div>
                    )}

                    <div suppressHydrationWarning className="text-[8px] text-slate-400 text-right mt-1 font-semibold">
                      10:42 AM
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Preview variables inputs */}
            <div className="bg-white border border-[#c3c6d7] rounded-2xl p-4 shadow-sm space-y-3">
              <h4 className="font-extrabold text-[10px] text-[#49454f] uppercase tracking-wide border-b border-slate-100 pb-1">
                Preview Values Mock (Edit to Test Preview)
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="name val"
                  value={varName}
                  onChange={(e) => setVarName(e.target.value)}
                  className="bg-slate-50 border border-[#c3c6d7] rounded-lg px-2.5 py-1 text-[11px] focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="policy val"
                  value={varPolicy}
                  onChange={(e) => setVarPolicy(e.target.value)}
                  className="bg-slate-50 border border-[#c3c6d7] rounded-lg px-2.5 py-1 text-[11px] focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="interaction val"
                  value={varLastInteraction}
                  onChange={(e) => setVarLastInteraction(e.target.value)}
                  className="bg-slate-50 border border-[#c3c6d7] rounded-lg px-2.5 py-1 text-[11px] focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="due date val"
                  value={varDueDate}
                  onChange={(e) => setVarDueDate(e.target.value)}
                  className="bg-slate-50 border border-[#c3c6d7] rounded-lg px-2.5 py-1 text-[11px] focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Campaign History Section */}
        <section className="bg-white rounded-2xl border border-[#c3c6d7] overflow-hidden shadow-sm">
          <div className="p-5 border-b border-[#c3c6d7] flex justify-between items-center bg-slate-50">
            <h3 className="font-bold text-xs text-[#1c1b1f] uppercase tracking-wider">
              Campaign History
            </h3>
            <div className="flex gap-2">
              <button className="p-2 border border-[#c3c6d7] hover:bg-slate-100 rounded-xl text-slate-500 transition-colors">
                <span className="material-symbols-outlined text-[18px]">filter_list</span>
              </button>
              <button className="p-2 border border-[#c3c6d7] hover:bg-slate-100 rounded-xl text-slate-500 transition-colors">
                <span className="material-symbols-outlined text-[18px]">download</span>
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            {campaignsLoading ? (
              <div className="p-8 text-center text-xs text-[#737686] animate-pulse">
                Loading history stats...
              </div>
            ) : campaigns.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#737686]">
                No campaigns found.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-[#c3c6d7]">
                    <th className="px-6 py-3 font-bold text-[#49454f] uppercase tracking-wider">Campaign Name</th>
                    <th className="px-6 py-3 font-bold text-[#49454f] uppercase tracking-wider">Channel</th>
                    <th className="px-6 py-3 font-bold text-[#49454f] uppercase tracking-wider">Sent Date</th>
                    <th className="px-6 py-3 font-bold text-[#49454f] uppercase tracking-wider">Recipients</th>
                    <th className="px-6 py-3 font-bold text-[#49454f] uppercase tracking-wider text-center">Delivered</th>
                    <th className="px-6 py-3 font-bold text-[#49454f] uppercase tracking-wider text-center">Read / Opened</th>
                    <th className="px-6 py-3 font-bold text-[#49454f] uppercase tracking-wider text-center">Replied / Clicked</th>
                    <th className="px-6 py-3 font-bold text-[#49454f] uppercase tracking-wider text-center">Converted</th>
                    <th className="px-6 py-3 font-bold text-[#49454f] uppercase tracking-wider">Cost</th>
                    <th className="px-6 py-3 font-bold text-[#49454f] uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#c3c6d7]/60">
                  {campaigns.map((camp) => {
                    const deliveredPct = camp.sent > 0 ? Math.round((camp.delivered / camp.sent) * 100) : 0;
                    const readPct = camp.delivered > 0 ? Math.round((camp.read / camp.delivered) * 100) : 0;
                    const repliedPct = camp.read > 0 ? Math.round((camp.replied / camp.read) * 100) : 0;
                    const conversionPct = camp.sent > 0 ? ((camp.converted / camp.sent) * 100).toFixed(1) : '0.0';

                    return (
                      <tr key={camp.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-xs text-[#004ac6]">{camp.name}</div>
                          <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                            {camp.template?.name || 'Manual'} ({camp.status})
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {camp.channel === 'EMAIL' ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 inline-flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs">mail</span>
                              Email
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs">chat</span>
                              WhatsApp
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 font-semibold text-[#49454f]">
                          {formatDateString(camp.createdAt)}
                          <span className="text-[10px] font-medium text-[#737686] block" suppressHydrationWarning>
                            {formatTimeString(camp.createdAt)}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-bold text-[#1c1b1f]">
                          {camp.sent}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="w-16 mx-auto bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div className="bg-green-500 h-full" style={{ width: `${deliveredPct}%` }} />
                          </div>
                          <span className="text-[9px] font-extrabold text-[#49454f]">{deliveredPct}%</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="w-16 mx-auto bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div className="bg-blue-500 h-full" style={{ width: `${readPct}%` }} />
                          </div>
                          <span className="text-[9px] font-extrabold text-[#49454f]">{readPct}%</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="w-16 mx-auto bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div className="bg-amber-500 h-full" style={{ width: `${repliedPct}%` }} />
                          </div>
                          <span className="text-[9px] font-extrabold text-[#49454f]">{repliedPct}%</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="bg-emerald-50 text-emerald-800 border border-emerald-250 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold">
                            {conversionPct}%
                          </span>
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-800">
                          ${camp.cost.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {camp.status === 'QUEUED' && (
                              <button
                                type="button"
                                title="Pause Campaign"
                                onClick={async () => {
                                  await fetch(`/api/dashboard/broadcast/${camp.id}/status`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ action: 'PAUSE' }),
                                  });
                                  queryClient.invalidateQueries({ queryKey: ['campaigns'] });
                                }}
                                className="p-1 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 text-xs"
                              >
                                <span className="material-symbols-outlined text-sm">pause</span>
                              </button>
                            )}
                            {camp.status === 'PAUSED' && (
                              <button
                                type="button"
                                title="Resume Campaign"
                                onClick={async () => {
                                  await fetch(`/api/dashboard/broadcast/${camp.id}/status`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ action: 'RESUME' }),
                                  });
                                  queryClient.invalidateQueries({ queryKey: ['campaigns'] });
                                }}
                                className="p-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs"
                              >
                                <span className="material-symbols-outlined text-sm">play_arrow</span>
                              </button>
                            )}
                            {['QUEUED', 'PAUSED'].includes(camp.status) && (
                              <button
                                type="button"
                                title="Cancel Campaign"
                                onClick={async () => {
                                  if (!confirm('Cancel this running campaign?')) return;
                                  await fetch(`/api/dashboard/broadcast/${camp.id}/status`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ action: 'CANCEL' }),
                                  });
                                  queryClient.invalidateQueries({ queryKey: ['campaigns'] });
                                }}
                                className="p-1 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs"
                              >
                                <span className="material-symbols-outlined text-sm">close</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </main>

      {/* CREATE TEMPLATE DIALOG MODAL */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-[#c3c6d7] rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <header className="px-6 py-4 bg-slate-50 border-b border-[#c3c6d7] flex items-center justify-between shrink-0">
              <span className="text-xs font-extrabold uppercase tracking-wide text-[#1c1b1f]">
                Author WhatsApp Template
              </span>
              <button
                type="button"
                onClick={() => setIsTemplateModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-[#737686] transition-all"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </header>

            <form onSubmit={handleCreateTemplateSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Name */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-[#49454f] uppercase tracking-wider block">
                  Template Name
                </span>
                <input
                  type="text"
                  placeholder="e.g. policy_renewal_reminder"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                  className="w-full bg-slate-50 border border-[#c3c6d7] rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-[#004ac6]"
                  required
                />
              </div>

              {/* Category */}
              <div className="grid grid-cols-3 gap-3">
                {(['MARKETING', 'UTILITY', 'AUTHENTICATION'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setTemplateCategory(cat)}
                    className={`px-3 py-2.5 rounded-xl border text-[10px] font-extrabold transition-all ${
                      templateCategory === cat
                        ? 'border-[#004ac6] bg-[#004ac6]/5 text-[#004ac6]'
                        : 'border-[#c3c6d7] bg-white text-[#49454f]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Header Text */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-[#49454f] uppercase tracking-wider block">
                  Header text (Optional Bold Title)
                </span>
                <input
                  type="text"
                  value={templateHeader}
                  onChange={(e) => setTemplateHeader(e.target.value)}
                  className="w-full bg-slate-50 border border-[#c3c6d7] rounded-xl px-3 py-2 text-xs focus:outline-none"
                  placeholder="e.g. ACTION REQUIRED"
                />
              </div>

              {/* Variable Helper chips inside composer */}
              <div className="space-y-1">
                <span className="text-[9px] text-[#737686] font-bold block mb-1">Click variables to insert at cursor position:</span>
                <div className="flex gap-2">
                  {(['name', 'policy_number', 'last_interaction', 'due_date'] as const).map((variable) => (
                    <button
                      key={variable}
                      type="button"
                      onClick={() => handleInsertVariable(variable)}
                      className="px-2 py-1 bg-slate-100 hover:bg-[#e7eeff] border border-slate-200 rounded-lg text-[10px] font-bold text-slate-800"
                    >
                      {"{{"}{variable}{"}}"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Template Body */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-[#49454f] uppercase tracking-wider block">
                  Template Body Text
                </span>
                <textarea
                  ref={templateBodyRef}
                  value={templateBody}
                  onChange={(e) => setTemplateBody(e.target.value)}
                  rows={4}
                  className="w-full bg-slate-50 border border-[#c3c6d7] rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-[#004ac6]"
                  placeholder="e.g. Hello {{name}}, renewal date {{due_date}} is close."
                  required
                />
              </div>

              {/* Footer Text */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-[#49454f] uppercase tracking-wider block">
                  Footer text (Optional Muted Subtext)
                </span>
                <input
                  type="text"
                  value={templateFooter}
                  onChange={(e) => setTemplateFooter(e.target.value)}
                  className="w-full bg-slate-50 border border-[#c3c6d7] rounded-xl px-3 py-2 text-xs focus:outline-none"
                  placeholder="e.g. Reply STOP to opt-out"
                />
              </div>

              {/* CTA Buttons */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-[#49454f] uppercase tracking-wider block">
                  CTA Action Buttons (Max 2)
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Button 1 Label"
                    value={buttonLabel1}
                    onChange={(e) => setButtonLabel1(e.target.value)}
                    className="w-full bg-slate-50 border border-[#c3c6d7] rounded-xl px-3 py-2 text-xs focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Button 2 Label"
                    value={buttonLabel2}
                    onChange={(e) => setButtonLabel2(e.target.value)}
                    className="w-full bg-slate-50 border border-[#c3c6d7] rounded-xl px-3 py-2 text-xs focus:outline-none"
                  />
                </div>
              </div>

              <footer className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTemplateModalOpen(false)}
                  className="px-4 py-2 border border-[#c3c6d7] rounded-xl text-xs font-bold text-[#49454f]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createTemplateMutation.isPending}
                  className="px-5 py-2 bg-[#004ac6] hover:bg-[#003ca0] text-white rounded-xl text-xs font-bold shadow-md"
                >
                  {createTemplateMutation.isPending ? 'Submitting...' : 'Submit to Meta for Approval'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
