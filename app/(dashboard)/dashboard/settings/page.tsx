'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTenantInfo } from '@/hooks/useTenantInfo';
import { 
  SlidersHorizontal,
  Smartphone,
  Users,
  Sparkles,
  Code2,
  CreditCard,
  ShieldCheck
} from 'lucide-react';

import SettingsChannelsTab from '@/components/settings-channels-tab';
import SettingsWorkspaceTab from '@/components/settings-workspace-tab';
import SettingsAiTab from '@/components/settings-ai-tab';
import SettingsDeveloperTab from '@/components/settings-developer-tab';
import SettingsAccountTab from '@/components/settings-account-tab';
import SettingsComplianceTab from '@/components/settings-compliance-tab';

type SettingsTab = 'channels' | 'workspace' | 'ai' | 'developer' | 'account' | 'compliance';

export default function SettingsPage() {
  const { data: info } = useTenantInfo();
  const tenantId = info?.tenantId;

  const [activeTab, setActiveTab] = useState<SettingsTab>('channels');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab') as SettingsTab;
      if (tabParam && ['channels', 'workspace', 'ai', 'developer', 'account', 'compliance'].includes(tabParam)) {
        setActiveTab(tabParam);
      }
    }
  }, []);

  return (
    <div className="space-y-8 text-left font-sans text-slate-900 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200/60 flex items-center justify-center text-[#1B4B91] shadow-xs">
              <SlidersHorizontal className="w-5 h-5 text-[#1B4B91]" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                Workspace & Channel Settings
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Configure your multi-channel sales pipelines, AI bots, team permissions, custom DNS records, and developer webhooks.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200/70">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Live Cloud Infrastructure
          </span>
        </div>
      </div>

      {/* Modern Segmented Navigation Tabs */}
      <div className="flex items-center gap-1.5 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/70 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('channels')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition shrink-0 ${
            activeTab === 'channels'
              ? 'bg-white text-[#1B4B91] shadow-xs font-bold border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <Smartphone className="w-4 h-4 text-[#1B4B91]" />
          <span>Connected Channels</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('workspace')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition shrink-0 ${
            activeTab === 'workspace'
              ? 'bg-white text-[#1B4B91] shadow-xs font-bold border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <Users className="w-4 h-4 text-[#1B4B91]" />
          <span>Workspace & Team</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ai')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition shrink-0 ${
            activeTab === 'ai'
              ? 'bg-white text-[#1B4B91] shadow-xs font-bold border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <Sparkles className="w-4 h-4 text-purple-600" />
          <span>AI Bot & Prompt Engineering</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('developer')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition shrink-0 ${
            activeTab === 'developer'
              ? 'bg-white text-[#1B4B91] shadow-xs font-bold border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <Code2 className="w-4 h-4 text-slate-700" />
          <span>Developer & API Keys</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('account')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition shrink-0 ${
            activeTab === 'account'
              ? 'bg-white text-[#1B4B91] shadow-xs font-bold border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <CreditCard className="w-4 h-4 text-blue-600" />
          <span>Billing & Usage</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('compliance')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition shrink-0 ${
            activeTab === 'compliance'
              ? 'bg-white text-[#1B4B91] shadow-xs font-bold border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Audit Logs & Compliance</span>
        </button>
      </div>

      {/* Tab Contents with Smooth Crossfades */}
      <div className="pt-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
          >
            {activeTab === 'channels' && <SettingsChannelsTab tenantId={tenantId} />}
            {activeTab === 'workspace' && <SettingsWorkspaceTab tenantId={tenantId} />}
            {activeTab === 'ai' && <SettingsAiTab />}
            {activeTab === 'developer' && <SettingsDeveloperTab />}
            {activeTab === 'account' && <SettingsAccountTab />}
            {activeTab === 'compliance' && <SettingsComplianceTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
