'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Sparkles,
  Upload,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  Calendar,
  Send,
  Save,
  RotateCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Sliders,
  DollarSign,
  Layers,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  BarChart3,
  Check,
  AlertCircle,
  Megaphone
} from 'lucide-react';

const FacebookIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const InstagramIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
  </svg>
);

const LinkedinIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
  </svg>
);

const YoutubeIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

function DigitalMarketingSuitePageInner() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Root Navigation Tabs: social-posts | calendar | integrations | analytics
  const rawTab = searchParams.get('tab');
  const activeTab = rawTab === 'campaigns' ? 'social-posts' : (rawTab as 'social-posts' | 'calendar' | 'integrations' | 'analytics') || 'social-posts';

  const setActiveTab = (tab: string) => {
    router.push(`/dashboard/marketing?tab=${tab}`);
  };

  // Redirect ?tab=campaigns automatically to ?tab=social-posts
  useEffect(() => {
    if (searchParams.get('tab') === 'campaigns') {
      router.replace('/dashboard/marketing?tab=social-posts');
    }
  }, [searchParams, router]);

  // Social Posts sub-tabs: create-post | DRAFT | SCHEDULED | SUCCESS | FAILED
  const [socialPostSubTab, setSocialPostSubTab] = useState<'create-post' | 'DRAFT' | 'SCHEDULED' | 'SUCCESS' | 'FAILED'>('create-post');

  // COMPOSE / CREATE STATE
  const [campaignName, setCampaignName] = useState('');
  const [campaignType, setCampaignType] = useState<'ORGANIC' | 'PAID'>('ORGANIC');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['facebook', 'instagram']);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaFileName, setMediaFileName] = useState<string | null>(null);
  const [instagramFormat, setInstagramFormat] = useState<'REELS' | 'STORIES' | 'FEED'>('REELS');
  const [caption, setCaption] = useState('');
  const [isOptimizing, setIsOptimizing] = useState(false);

  // Paid options state
  const [budget, setBudget] = useState('250');
  const [ageRange, setAgeRange] = useState('25-64');
  const [location, setLocation] = useState('United States (All States)');
  const [interestTags, setInterestTags] = useState<string[]>(['Health Insurance', 'Family Wellness', 'Medicare']);
  const [newTagInput, setNewTagInput] = useState('');

  // AI Pre-Flight Audit state
  const [auditData, setAuditData] = useState<{
    complianceScore: number;
    ctrPrediction: 'LOW' | 'MEDIUM' | 'HIGH';
    auditResult: 'PASS' | 'REVIEW' | 'BLOCK';
    checklist: { rule: string; pass: boolean }[];
    recommendations: string[];
  } | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);

  // Schedule modal / date state
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleDateTime, setScheduleDateTime] = useState('');

  // History Tab Filter limits
  const [historyPlatformFilter, setHistoryPlatformFilter] = useState('ALL');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('ALL');
  const [expandedAbTestId, setExpandedAbTestId] = useState<string | null>(null);

  // Calendar Year/Month State
  const [currentDate, setCurrentDate] = useState(new Date());

  // 1. Fetch History Campaigns
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['marketing-campaigns', historyPlatformFilter, historyStatusFilter],
    queryFn: async () => {
      const res = await fetch(`/api/marketing/campaigns?platform=${historyPlatformFilter}&status=${historyStatusFilter}`);
      if (!res.ok) throw new Error('Failed to load marketing history');
      return res.json();
    },
  });

  // 2. Fetch Platform Connections
  const { data: integrationsData, isLoading: integrationsLoading } = useQuery({
    queryKey: ['marketing-integrations'],
    queryFn: async () => {
      const res = await fetch('/api/marketing/integrations');
      if (!res.ok) throw new Error('Failed to load integrations');
      return res.json();
    },
  });

  // 3. Platform Connect/Disconnect Mutation
  const toggleConnectionMutation = useMutation({
    mutationFn: async ({ platform, action }: { platform: string; action: 'CONNECT' | 'DISCONNECT' }) => {
      const res = await fetch('/api/marketing/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, action }),
      });
      if (!res.ok) throw new Error('Failed to update integration');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-integrations'] });
    },
  });

  // 4. Publish / Retry Mutation
  const publishMutation = useMutation({
    mutationFn: async ({ campaignId, action = 'publish', format }: { campaignId: string; action?: string; format?: string }) => {
      const res = await fetch('/api/marketing/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId, action, format: format || instagramFormat }),
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Failed to publish campaign');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-campaigns'] });
    },
  });

  // Toggle platform select state
  const togglePlatform = (plat: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(plat) ? prev.filter((p) => p !== plat) : [...prev, plat]
    );
  };

  // Upload asset handler
  const handleMediaUpload = async (file: File) => {
    setMediaFileName(file.name);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/marketing/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.url) {
        setMediaUrl(data.url);
      }
    } catch {
      setMediaUrl(URL.createObjectURL(file));
    }
  };

  // AI Copy Optimizer handler
  const handleAiOptimize = async () => {
    if (!caption.trim()) return;
    setIsOptimizing(true);
    try {
      const res = await fetch('/api/marketing/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caption,
          platform: selectedPlatforms.join(', '),
          campaignType,
        }),
      });
      const data = await res.json();
      if (data.optimizedCaption) {
        setCaption(data.optimizedCaption);
      }
    } catch (err) {
      console.error('AI Caption Optimize Failed:', err);
    } finally {
      setIsOptimizing(false);
    }
  };

  // AI Preflight Audit execution
  const handleRunAudit = async () => {
    if (!caption.trim()) return;
    setIsAuditing(true);
    try {
      const res = await fetch('/api/marketing/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caption,
          platforms: selectedPlatforms,
          mediaUrl,
          type: campaignType,
        }),
      });
      const data = await res.json();
      setAuditData(data);
    } catch (err) {
      console.error('Pre-Flight Audit Error:', err);
    } finally {
      setIsAuditing(false);
    }
  };

  // Save / Post campaign dispatcher
  const handleSaveCampaign = async (status: 'DRAFT' | 'SCHEDULED' | 'PENDING') => {
    if (!campaignName.trim() || !caption.trim()) {
      alert('Please enter a post title and caption.');
      return;
    }

    try {
      const payload = {
        name: campaignName,
        type: campaignType,
        platforms: selectedPlatforms,
        mediaUrl,
        caption,
        status: status === 'PENDING' ? 'PENDING' : status,
        scheduledAt: status === 'SCHEDULED' && scheduleDateTime ? scheduleDateTime : null,
        budget: campaignType === 'PAID' ? parseFloat(budget) || null : null,
        audienceTargeting: {
          ...(campaignType === 'PAID' ? { ageRange, location, interests: interestTags } : {}),
          instagramFormat,
        },
        complianceScore: auditData?.complianceScore || null,
        ctrPrediction: auditData?.ctrPrediction || null,
        auditResult: auditData?.auditResult || null,
        auditDetails: auditData ? { checklist: auditData.checklist, recommendations: auditData.recommendations } : null,
      };

      const res = await fetch('/api/marketing/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.campaign) throw new Error(data.error || 'Failed to save campaign');

      const createdCampaignId = data.campaign.id;

      if (status === 'PENDING' && createdCampaignId) {
        await publishMutation.mutateAsync({ campaignId: createdCampaignId, format: instagramFormat });
      }

      queryClient.invalidateQueries({ queryKey: ['marketing-campaigns'] });
      setSocialPostSubTab('DRAFT');
      setShowScheduleModal(false);
    } catch (err: any) {
      alert(err.message || 'Error saving campaign');
    }
  };

  // Add Interest Tag Chip
  const addInterestTag = () => {
    if (newTagInput.trim() && !interestTags.includes(newTagInput.trim())) {
      setInterestTags([...interestTags, newTagInput.trim()]);
      setNewTagInput('');
    }
  };

  // Helper: Timezone-Safe ISO Date Matching
  const isSameDayISO = (dateStr: string | null | undefined, compareDate: Date) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d.getFullYear() === compareDate.getFullYear() &&
           d.getMonth() === compareDate.getMonth() &&
           d.getDate() === compareDate.getDate();
  };

  // RENDER DYNAMIC HISTORICAL DATA TABLE
  const renderCampaignsTable = (filteredCampaigns: any[]) => {
    if (!filteredCampaigns || filteredCampaigns.length === 0) {
      return (
        <div className="p-8 text-center text-xs text-gray-500 bg-white border border-[#c3c6d7] rounded-xl">
          No posts found in this status group. Click &quot;Create Post&quot; to build a new one.
        </div>
      );
    }

    return (
      <div className="bg-white rounded-xl border border-[#c3c6d7] overflow-hidden shadow-sm text-left">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-600 border-b border-gray-200 font-semibold uppercase tracking-wider">
              <tr>
                <th className="p-4">Post Title</th>
                <th className="p-4">Platforms</th>
                <th className="p-4">Type</th>
                <th className="p-4">Status</th>
                <th className="p-4">Date</th>
                <th className="p-4">Est. Reach</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 font-medium">
              {filteredCampaigns.map((item: any) => {
                const isExpanded = expandedAbTestId === item.id;
                const hasAbVariants = item.abTestVariants && item.abTestVariants.length > 0;

                return (
                  <React.Fragment key={item.id}>
                    <tr className="hover:bg-gray-50/80 transition">
                      <td className="p-4 font-bold text-gray-900">
                        <div className="flex items-center gap-2">
                          {hasAbVariants && (
                            <button
                              type="button"
                              onClick={() => setExpandedAbTestId(isExpanded ? null : item.id)}
                              className="p-1 text-gray-500 hover:text-gray-900"
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          )}
                          <span>{item.name}</span>
                        </div>
                        <p className="text-[11px] text-gray-500 font-normal truncate max-w-md mt-0.5">
                          {item.caption}
                        </p>
                      </td>

                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {item.platforms?.map((p: string) => (
                            <span
                              key={p}
                              className="px-2 py-0.5 bg-blue-50 text-blue-800 rounded font-semibold text-[10px] uppercase"
                            >
                              {p}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="p-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            item.type === 'PAID'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {item.type}
                        </span>
                      </td>

                      <td className="p-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            item.status === 'SUCCESS'
                              ? 'bg-green-100 text-green-800'
                              : item.status === 'PUBLISHING'
                              ? 'bg-blue-100 text-blue-800 animate-pulse'
                              : item.status === 'FAILED'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {item.status === 'PUBLISHING' && <RotateCw className="w-3 h-3 animate-spin" />}
                          {item.status === 'SUCCESS' ? 'PUBLISHED' : item.status}
                        </span>
                      </td>

                      <td className="p-4 text-gray-600">
                        {item.publishedAt
                          ? new Date(item.publishedAt).toLocaleDateString()
                          : item.scheduledAt
                          ? new Date(item.scheduledAt).toLocaleDateString()
                          : 'Draft'}
                      </td>

                      <td className="p-4 font-semibold text-gray-900">
                        {item.reach ? item.reach.toLocaleString() : '0'}
                      </td>

                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {item.status === 'FAILED' && (
                            <button
                              type="button"
                              onClick={() => publishMutation.mutate({ campaignId: item.id, action: 'retry' })}
                              className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold transition flex items-center gap-1"
                            >
                              <RotateCw className="w-3 h-3" />
                              Retry
                            </button>
                          )}
                          {item.auditDetails?.instagramPermalink && (
                            <a
                              href={item.auditDetails.instagramPermalink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 bg-pink-50 border border-pink-200 text-pink-700 hover:bg-pink-100 rounded text-[10px] font-bold transition flex items-center gap-1 shadow-sm"
                              title="View Live on Instagram"
                            >
                              <InstagramIcon className="w-3.5 h-3.5 text-pink-600" />
                              <span>Instagram ↗</span>
                            </a>
                          )}
                          {item.auditDetails?.facebookPermalink && (
                            <a
                              href={item.auditDetails.facebookPermalink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 rounded text-[10px] font-bold transition flex items-center gap-1 shadow-sm"
                              title="View Live on Facebook"
                            >
                              <FacebookIcon className="w-3.5 h-3.5 text-[#1877F2]" />
                              <span>Facebook ↗</span>
                            </a>
                          )}
                          {item.auditDetails?.linkedinPermalink && (
                            <a
                              href={item.auditDetails.linkedinPermalink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 bg-sky-50 border border-sky-200 text-sky-800 hover:bg-sky-100 rounded text-[10px] font-bold transition flex items-center gap-1 shadow-sm"
                              title="View Live on LinkedIn"
                            >
                              <LinkedinIcon className="w-3.5 h-3.5 text-[#0A66C2]" />
                              <span>LinkedIn ↗</span>
                            </a>
                          )}
                          <a
                            href={`/dashboard/marketing`}
                            className="p-1.5 text-gray-500 hover:text-[#004ac6] transition"
                            title="View Post Details"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      </td>
                    </tr>

                    {isExpanded && hasAbVariants && (
                      <tr className="bg-blue-50/40">
                        <td colSpan={7} className="p-4">
                          <div className="p-4 bg-white rounded-lg border border-blue-200 space-y-3">
                            <h4 className="text-xs font-bold text-[#1B4B91] uppercase tracking-wider">
                              A/B Test Variant Performance Comparison
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {item.abTestVariants.map((varItem: any, idx: number) => (
                                <div key={varItem.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs">
                                  <div className="flex justify-between font-bold text-gray-900 mb-1">
                                    <span>Variant {String.fromCharCode(65 + idx)}</span>
                                    <span className="text-[#004ac6]">Reach: {varItem.reach?.toLocaleString()}</span>
                                  </div>
                                  <p className="text-gray-600 line-clamp-2">{varItem.caption}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // MONTHLY GRID CALENDAR GENERATION LOGIC
  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

    const cells: React.ReactNode[] = [];
    
    // Empty cells at start of month
    for (let i = 0; i < firstDay; i++) {
      cells.push(<div key={`empty-${i}`} className="min-h-[110px] bg-slate-50/50 border border-slate-100 rounded-lg" />);
    }

    // Days cells
    for (let d = 1; d <= totalDays; d++) {
      const cellDate = new Date(year, month, d);
      const matched = (historyData?.campaigns || []).filter((c: any) =>
        isSameDayISO(c.scheduledAt || c.publishedAt, cellDate)
      );

      cells.push(
        <div
          key={`day-${d}`}
          className="min-h-[110px] p-2 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow flex flex-col justify-between"
        >
          <span className="text-xs font-bold text-gray-800 self-end bg-gray-100 px-1.5 py-0.5 rounded">
            {d}
          </span>
          <div className="flex-1 mt-1 space-y-1 overflow-y-auto max-h-[75px] scrollbar-none">
            {matched.map((c: any) => (
              <div
                key={c.id}
                title={`${c.name} (${c.status})`}
                className={`px-1.5 py-0.5 rounded text-[9px] font-bold truncate border ${
                  c.status === 'SUCCESS'
                    ? 'bg-green-50 border-green-200 text-green-800'
                    : c.status === 'SCHEDULED'
                    ? 'bg-blue-50 border-blue-200 text-blue-800'
                    : c.status === 'FAILED'
                    ? 'bg-red-50 border-red-200 text-red-800'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                {c.name}
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-xl border border-[#c3c6d7] p-6 shadow-sm space-y-4 text-left font-sans">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#004ac6]" />
            <h2 className="text-lg font-bold text-[#1B4B91]">Social Posting Calendar</h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={prevMonth}
              className="p-1.5 hover:bg-slate-100 rounded-full border border-gray-200 text-gray-600 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-gray-800 tracking-wider uppercase">
              {monthNames[month]} {year}
            </span>
            <button
              onClick={nextMonth}
              className="p-1.5 hover:bg-slate-100 rounded-full border border-gray-200 text-gray-600 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Days of Week Header */}
        <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-extrabold text-gray-500 uppercase tracking-wider border-b border-gray-100 pb-2">
          <div>Sun</div>
          <div>Mon</div>
          <div>Tue</div>
          <div>Wed</div>
          <div>Thu</div>
          <div>Fri</div>
          <div>Sat</div>
        </div>

        {/* Grid Cells */}
        <div className="grid grid-cols-7 gap-2">
          {cells}
        </div>
      </div>
    );
  };

  // ANALYTICS PERFORMANCE SUMMARY
  const renderAnalytics = () => {
    const list = historyData?.campaigns || [];
    
    // KPI Math
    const totalReach = list.reduce((sum: number, c: any) => sum + (c.reach || 0), 0);
    const totalBudget = list.reduce((sum: number, c: any) => sum + (c.budget || 0), 0);
    
    const countWithCtr = list.filter((c: any) => c.ctrPrediction).length;
    const averageCtr = countWithCtr > 0 
      ? (list.reduce((sum: number, c: any) => {
          const val = c.ctrPrediction === 'HIGH' ? 8.5 : c.ctrPrediction === 'MEDIUM' ? 4.8 : 1.8;
          return sum + val;
        }, 0) / countWithCtr).toFixed(1)
      : '0.0';

    // Reach Over Time graph data
    const reachData = [...list]
      .filter((c: any) => c.reach > 0)
      .reverse()
      .slice(-6); // Last 6 campaigns

    return (
      <div className="space-y-6 text-left font-sans">
        {/* Metric Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-5 bg-white rounded-xl border border-[#c3c6d7] shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Cumulative Post Reach</span>
              <span className="text-2xl font-extrabold text-[#1c1b1f] mt-1 block">{totalReach.toLocaleString()}</span>
            </div>
            <div className="p-2.5 bg-blue-50 text-blue-700 rounded-xl border border-blue-100">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>

          <div className="p-5 bg-white rounded-xl border border-[#c3c6d7] shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Target CTR Prediction</span>
              <span className="text-2xl font-extrabold text-[#1c1b1f] mt-1 block">{averageCtr}%</span>
            </div>
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
              <Sparkles className="w-6 h-6" />
            </div>
          </div>

          <div className="p-5 bg-white rounded-xl border border-[#c3c6d7] shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Total Spent (Paid Ads)</span>
              <span className="text-2xl font-extrabold text-[#1c1b1f] mt-1 block">${totalBudget.toLocaleString()}</span>
            </div>
            <div className="p-2.5 bg-purple-50 text-purple-700 rounded-xl border border-purple-100">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Charts & Trends panel */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Trend chart */}
          <div className="p-5 bg-white rounded-xl border border-[#c3c6d7] shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-[#1B4B91] uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#004ac6]" />
              Social Post Reach Analytics
            </h3>
            {reachData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-xs text-gray-500">
                Publish posts to generate reach trend statistics.
              </div>
            ) : (
              <div className="h-48 flex flex-col justify-between">
                <div className="flex-1 flex items-end justify-between gap-4 px-2">
                  {reachData.map((c: any) => {
                    const maxReach = Math.max(...reachData.map((x: any) => x.reach)) || 1;
                    const heightPercent = Math.max(10, (c.reach / maxReach) * 80);
                    return (
                      <div key={c.id} className="flex-1 flex flex-col items-center gap-2 group relative">
                        <span className="text-[9px] font-bold text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity absolute -top-4 bg-gray-900 text-white rounded px-1">
                          {c.reach.toLocaleString()}
                        </span>
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className="w-full bg-[#004ac6] hover:bg-[#003da3] rounded-t transition-all cursor-pointer"
                        />
                        <span className="text-[9px] font-semibold text-gray-500 truncate w-full text-center">
                          {c.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Social split chart */}
          <div className="p-5 bg-white rounded-xl border border-[#c3c6d7] shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-[#1B4B91] uppercase tracking-wider flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#004ac6]" />
              Platform Share Split Distribution
            </h3>
            <div className="h-48 flex flex-col justify-center space-y-3">
              {['facebook', 'instagram', 'linkedin', 'youtube'].map((p) => {
                const count = list.filter((c: any) => c.platforms?.includes(p)).length;
                const total = list.length || 1;
                const percentage = Math.round((count / total) * 100);
                return (
                  <div key={p} className="space-y-1 text-xs">
                    <div className="flex justify-between font-bold text-gray-700 uppercase text-[10px]">
                      <span>{p}</span>
                      <span>{count} posts ({percentage}%)</span>
                    </div>
                    <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${percentage}%` }}
                        className="h-full bg-blue-800 rounded-full transition-all"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Granular campaign logs table */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#1B4B91] uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#004ac6]" />
              Detailed Post History Log
            </h3>
          </div>
          {renderCampaignsTable(list)}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 font-sans text-left">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#c3c6d7]/40 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-[#1B4B91] tracking-tight flex items-center gap-2">
            <span className="material-symbols-outlined text-[#004ac6]">ads_click</span>
            Digital Marketing Suite
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Compose and target healthcare posts, perform AI compliance preflight audits, and track unified social analytics.
          </p>
        </div>
      </div>

      {/* Primary Tab Navigation */}
      <div className="flex items-center gap-1 border-b border-[#c3c6d7] overflow-x-auto pb-px">
        {[
          { id: 'social-posts' as const, label: 'Social Posts', icon: Megaphone },
          { id: 'calendar' as const, label: 'Calendar', icon: Calendar },
          { id: 'integrations' as const, label: 'Integrations', icon: Layers },
          { id: 'analytics' as const, label: 'History & Analytics', icon: BarChart3 },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 text-xs font-bold whitespace-nowrap transition border-b-2 ${
                isActive
                  ? 'border-[#004ac6] text-[#004ac6] bg-blue-50/50'
                  : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-slate-50'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-[#004ac6]' : 'text-gray-400'}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: SOCIAL POSTS HUB */}
      {activeTab === 'social-posts' && (
        <div className="space-y-6">
          {/* Sub-tabs bar */}
          <div className="flex items-center gap-1 border-b border-gray-200 pb-px overflow-x-auto">
            {[
              { id: 'create-post' as const, label: 'Create Post' },
              { id: 'DRAFT' as const, label: 'Drafts' },
              { id: 'SCHEDULED' as const, label: 'Scheduled' },
              { id: 'SUCCESS' as const, label: 'Published' },
              { id: 'FAILED' as const, label: 'Failed' },
            ].map((sub) => (
              <button
                key={sub.id}
                onClick={() => setSocialPostSubTab(sub.id)}
                className={`px-4 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 transition ${
                  socialPostSubTab === sub.id
                    ? 'border-[#004ac6] text-[#004ac6]'
                    : 'border-transparent text-gray-500 hover:text-gray-900'
                }`}
              >
                {sub.label}
              </button>
            ))}
          </div>

          {socialPostSubTab === 'create-post' ? (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-[#c3c6d7] p-6 shadow-sm space-y-6">
                {/* Post Name */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">
                      Post / Campaign Title *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Q3 Health Plan Enrollment Social Post"
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-xs focus:bg-white focus:border-[#004ac6] outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">
                      Campaign Type
                    </label>
                    <div className="grid grid-cols-2 p-1 bg-gray-100 rounded-lg border border-gray-200">
                      <button
                        type="button"
                        onClick={() => setCampaignType('ORGANIC')}
                        className={`py-1.5 text-[11px] font-semibold rounded-md transition ${
                          campaignType === 'ORGANIC'
                            ? 'bg-white text-[#1B4B91] shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Organic Post
                      </button>
                      <button
                        type="button"
                        onClick={() => setCampaignType('PAID')}
                        className={`py-1.5 text-[11px] font-semibold rounded-md transition ${
                          campaignType === 'PAID'
                            ? 'bg-[#1B4B91] text-white shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Paid Ad
                      </button>
                    </div>
                  </div>
                </div>

                {/* Platforms Row */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">
                    Target Social Platforms (Multi-Select)
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { id: 'facebook', name: 'Facebook', icon: FacebookIcon, color: 'text-blue-600' },
                      { id: 'instagram', name: 'Instagram', icon: InstagramIcon, color: 'text-pink-600' },
                      { id: 'linkedin', name: 'LinkedIn', icon: LinkedinIcon, color: 'text-blue-700' },
                      { id: 'youtube', name: 'YouTube', icon: YoutubeIcon, color: 'text-red-600' },
                    ].map((item) => {
                      const isSelected = selectedPlatforms.includes(item.id);
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => togglePlatform(item.id)}
                          className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-xs font-semibold transition ${
                            isSelected
                              ? 'border-[#004ac6] bg-[#004ac6]/10 text-[#004ac6] ring-1 ring-[#004ac6]'
                              : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          <Icon className={`w-5 h-5 ${item.color}`} />
                          <span>{item.name}</span>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-[#004ac6] ml-auto" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Instagram Format Selector (Reels vs Stories vs Feed) */}
                {selectedPlatforms.includes('instagram') && (
                  <div className="p-4 bg-pink-50/50 border border-pink-200/80 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <InstagramIcon className="w-4 h-4 text-pink-600" />
                        <span className="text-xs font-bold text-pink-950">Instagram Content Format</span>
                      </div>
                      <span className="text-[10px] font-semibold text-pink-700 bg-pink-100/80 px-2 py-0.5 rounded-full">
                        Meta Graph API v21.0
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {[
                        { id: 'REELS' as const, label: '🎬 Instagram Reel', desc: 'Vertical 9:16 video (5s-15min)' },
                        { id: 'STORIES' as const, label: '📱 Instagram Story', desc: 'Vertical 9:16 photo/video (24h)' },
                        { id: 'FEED' as const, label: '🖼️ Feed Post', desc: 'Standard square or 4:5 image/video' },
                      ].map((fmt) => (
                        <button
                          key={fmt.id}
                          type="button"
                          onClick={() => setInstagramFormat(fmt.id)}
                          className={`p-3 rounded-lg border text-left transition ${
                            instagramFormat === fmt.id
                              ? 'border-pink-600 bg-white ring-2 ring-pink-500/20 shadow-sm'
                              : 'border-pink-200 bg-white/70 hover:bg-white text-gray-700'
                          }`}
                        >
                          <p className="text-xs font-bold text-gray-900">{fmt.label}</p>
                          <p className="text-[10px] text-gray-500 mt-0.5">{fmt.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Upload File */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">
                    Post Media & Creative Assets
                  </label>
                  <label className="border-2 border-dashed border-gray-300 hover:border-[#1B4B91] bg-gray-50/50 hover:bg-gray-50 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition text-center group">
                    <input
                      type="file"
                      accept="image/*,video/*"
                      onChange={(e) => e.target.files?.[0] && handleMediaUpload(e.target.files[0])}
                      className="hidden"
                    />
                    <Upload className="w-8 h-8 text-gray-400 group-hover:text-[#1B4B91] mb-2 transition" />
                    <p className="text-xs font-medium text-gray-700">
                      Drag and drop campaign images, videos, or reels here
                    </p>
                    <p className="text-[10px] text-gray-500 mt-1">Supports PNG, JPG, MP4, MOV (Max 50MB)</p>
                  </label>

                  {mediaFileName && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between text-xs text-blue-900 font-medium">
                      <span className="truncate">Attached: {mediaFileName}</span>
                      <span className="text-[#004ac6] font-semibold">Ready for Upload</span>
                    </div>
                  )}
                </div>

                {/* Caption text */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                      Caption & Copy Writer
                    </label>
                    <button
                      type="button"
                      onClick={handleAiOptimize}
                      disabled={isOptimizing || !caption.trim()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#004ac6] hover:bg-[#003da3] text-white text-[10px] font-semibold rounded-md shadow-sm disabled:opacity-50 transition"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${isOptimizing ? 'animate-spin' : ''}`} />
                      {isOptimizing ? 'Rewriting with AI...' : 'AI Optimize Copy'}
                    </button>
                  </div>
                  <textarea
                    rows={5}
                    placeholder="Write your campaign caption or promotional message here..."
                    value={caption}
                    onChange={(e) => {
                      setCaption(e.target.value);
                      setAuditData(null);
                    }}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-xs focus:bg-white focus:border-[#004ac6] outline-none transition"
                  />
                </div>

                {/* Paid Options */}
                {campaignType === 'PAID' && (
                  <div className="p-5 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 rounded-xl border border-blue-200 space-y-4">
                    <h3 className="text-xs font-bold text-[#1B4B91] flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-[#004ac6]" />
                      Paid Advertising & Audience Targeting Controls
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Campaign Budget ($)
                        </label>
                        <div className="relative">
                          <DollarSign className="w-4 h-4 text-gray-400 absolute left-3 top-2" />
                          <input
                            type="number"
                            value={budget}
                            onChange={(e) => setBudget(e.target.value)}
                            className="w-full pl-8 pr-4 py-1.5 bg-white border border-gray-300 rounded-lg text-xs outline-none focus:border-[#004ac6]"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Target Age Range
                        </label>
                        <input
                          type="text"
                          value={ageRange}
                          onChange={(e) => setAgeRange(e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs outline-none focus:border-[#004ac6]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Geographic Location
                        </label>
                        <input
                          type="text"
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs outline-none focus:border-[#004ac6]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Audience Interest Chips
                      </label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {interestTags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-blue-200 text-blue-900 text-[10px] font-semibold rounded-full shadow-sm"
                          >
                            {tag}
                            <button
                              type="button"
                              onClick={() => setInterestTags(interestTags.filter((t) => t !== tag))}
                              className="hover:text-red-600 text-gray-400 font-bold"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Add interest tag..."
                          value={newTagInput}
                          onChange={(e) => setNewTagInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addInterestTag())}
                          className="flex-1 px-3 py-1 bg-white border border-gray-300 rounded-lg text-xs outline-none focus:border-[#004ac6]"
                        />
                        <button
                          type="button"
                          onClick={addInterestTag}
                          className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-semibold rounded-lg transition"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Preflight audit launcher */}
                {!auditData && (
                  <button
                    type="button"
                    onClick={handleRunAudit}
                    disabled={isAuditing}
                    className="w-full py-3 bg-[#1B4B91] hover:bg-[#14376c] text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition cursor-pointer"
                  >
                    <ShieldCheck className={`w-4 h-4 ${isAuditing ? 'animate-spin' : ''}`} />
                    {isAuditing ? 'Running Healthcare & Insurance Compliance Audit...' : 'Run AI Pre-Flight Audit'}
                  </button>
                )}
              </div>

              {/* Audit results */}
              {auditData && (
                <div className="bg-white rounded-xl border border-[#c3c6d7] p-6 shadow-sm space-y-6 text-left">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                    <h3 className="text-sm font-bold text-[#1B4B91] flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-[#004ac6]" />
                      AI Pre-Flight Compliance Audit Report
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-xl border border-gray-200 text-center">
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                        Compliance Score
                      </span>
                      <div className="relative w-20 h-20 flex items-center justify-center rounded-full border-4 border-[#004ac6] bg-white shadow-inner">
                        <span className="text-2xl font-extrabold text-[#1B4B91]">{auditData.complianceScore}</span>
                        <span className="text-[10px] text-gray-400 font-bold font-mono">/100</span>
                      </div>
                    </div>

                    <div className="md:col-span-2 space-y-4">
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-gray-700 uppercase tracking-wider">
                          CTR Prediction:
                        </span>
                        <span
                          className={`px-3 py-1 rounded-full text-[10px] font-bold ${
                            auditData.ctrPrediction === 'HIGH'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {auditData.ctrPrediction} CTR EXPECTED
                        </span>
                      </div>

                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-gray-700 uppercase tracking-wider block">
                          Policy Compliance Status Checklist:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {auditData.checklist.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs font-semibold text-gray-700 bg-gray-50 p-2 rounded-lg border border-gray-200">
                              {item.pass ? (
                                <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                              ) : (
                                <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                              )}
                              <span className="truncate">{item.rule}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    className={`p-4 rounded-xl text-center font-extrabold text-sm flex items-center justify-center gap-3 ${
                      auditData.auditResult === 'PASS'
                        ? 'bg-green-600 text-white'
                        : 'bg-red-600 text-white'
                    }`}
                  >
                    <span>PRE-FLIGHT AUDIT VERDICT: {auditData.auditResult}</span>
                  </div>
                </div>
              )}

              {/* Actions panel */}
              <div className="bg-white rounded-xl border border-[#c3c6d7] p-4 flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => handleSaveCampaign('DRAFT')}
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-lg transition flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save Post as Draft
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowScheduleModal(true)}
                    className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-lg transition flex items-center gap-2"
                  >
                    <Calendar className="w-4 h-4" />
                    Schedule Post
                  </button>

                  <button
                    type="button"
                    disabled={publishMutation.isPending}
                    onClick={() => handleSaveCampaign('PENDING')}
                    className="px-6 py-2.5 bg-[#004ac6] hover:bg-[#003da3] text-white text-xs font-bold rounded-lg shadow-md disabled:opacity-40 transition flex items-center gap-2 cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    {publishMutation.isPending ? 'Publishing...' : 'Publish Post Now'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {renderCampaignsTable(
                (historyData?.campaigns || []).filter(
                  (c: any) => c.status === socialPostSubTab
                )
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CALENDAR HUB */}
      {activeTab === 'calendar' && (
        <div className="space-y-6">
          {renderCalendar()}
        </div>
      )}

      {/* TAB 3: INTEGRATIONS HUB */}
      {activeTab === 'integrations' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-[#c3c6d7] p-6 shadow-sm">
            <h2 className="text-lg font-bold text-[#1B4B91] mb-2">Connected Marketing & Ad Platforms</h2>
            <p className="text-xs text-gray-600 mb-6">
              Connect official agency accounts to enable auto-posting campaigns and visual analytics aggregation.
            </p>

            {integrationsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-32 bg-gray-100 animate-pulse rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  {
                    platform: 'FACEBOOK',
                    title: 'Facebook Page',
                    desc: 'Publish posts & healthcare promo campaigns',
                    icon: FacebookIcon,
                    color: 'text-blue-600',
                  },
                  {
                    platform: 'INSTAGRAM',
                    title: 'Instagram Business',
                    desc: 'Share image carousels & video reels',
                    icon: InstagramIcon,
                    color: 'text-pink-600',
                  },
                  {
                    platform: 'LINKEDIN',
                    title: 'LinkedIn Profile/Company',
                    desc: 'B2B small business group health posts',
                    icon: LinkedinIcon,
                    color: 'text-blue-700',
                  },
                  {
                    platform: 'YOUTUBE',
                    title: 'YouTube Channel',
                    desc: 'Publish video guides & plan explainer shorts',
                    icon: YoutubeIcon,
                    color: 'text-red-600',
                  },
                  {
                    platform: 'META_ADS',
                    title: 'Meta Ads Manager',
                    desc: 'Run paid Facebook & Instagram ad campaigns',
                    icon: Sliders,
                    color: 'text-purple-600',
                  },
                ].map((item) => {
                  const conn = integrationsData?.connections?.find(
                    (c: any) => c.platform === item.platform
                  );
                  const isConnected = conn?.status === 'CONNECTED';
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.platform}
                      className="p-5 rounded-xl border border-gray-200 bg-gray-50/50 hover:bg-gray-50 transition flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="p-2.5 bg-white rounded-lg border border-gray-200 shadow-sm">
                            <Icon className={`w-6 h-6 ${item.color}`} />
                          </div>
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                              isConnected
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-200 text-gray-700'
                            }`}
                          >
                            {isConnected ? 'Connected' : 'Not Connected'}
                          </span>
                        </div>

                        <h3 className="text-sm font-bold text-gray-900">{item.title}</h3>
                        <p className="text-xs text-gray-500 mt-1">{item.desc}</p>

                        {isConnected && conn?.accountName && (
                          <div className="mt-3 p-2 bg-white rounded-md border border-gray-200 text-xs font-medium text-gray-700 truncate">
                            Account: <span className="font-semibold text-gray-900">{conn.accountName}</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-5 pt-3 border-t border-gray-200 flex items-center justify-between">
                        {isConnected ? (
                          <button
                            type="button"
                            onClick={() =>
                              toggleConnectionMutation.mutate({
                                platform: item.platform,
                                action: 'DISCONNECT',
                              })
                            }
                            className="text-xs font-semibold text-red-600 hover:text-red-800 transition"
                          >
                            Disconnect
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              toggleConnectionMutation.mutate({
                                platform: item.platform,
                                action: 'CONNECT',
                              })
                            }
                            className="w-full py-2 bg-[#1B4B91] hover:bg-[#14376c] text-white text-xs font-bold rounded-lg transition"
                          >
                            Connect Account
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: ANALYTICS & HISTORY HUB */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {renderAnalytics()}
        </div>
      )}

      {/* SCHEDULE DATE/TIME MODAL */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl border border-[#c3c6d7] max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-[#1B4B91] flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#004ac6]" />
              Schedule Post Release
            </h3>
            <p className="text-xs text-gray-600">
              Select the date and time when this pre-audited post should automatically publish.
            </p>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Date and Time</label>
              <input
                type="datetime-local"
                value={scheduleDateTime}
                onChange={(e) => setScheduleDateTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs outline-none focus:border-[#004ac6]"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!scheduleDateTime}
                onClick={() => handleSaveCampaign('SCHEDULED')}
                className="px-4 py-2 bg-[#004ac6] hover:bg-[#003da3] text-white text-xs font-bold rounded-lg shadow-sm disabled:opacity-50"
              >
                Confirm Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DigitalMarketingSuitePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-gray-500">Loading Digital Marketing Suite...</div>}>
      <DigitalMarketingSuitePageInner />
    </Suspense>
  );
}
