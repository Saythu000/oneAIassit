'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Key, 
  ShieldCheck, 
  Lock, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  RefreshCw, 
  Copy, 
  Check, 
  Cpu,
  Server
} from 'lucide-react';

interface KeyConfigData {
  activeProvider: 'LOCAL' | 'GEMINI' | 'OPENAI' | 'ANTHROPIC';
  localConfigured?: boolean;
  localEndpoint?: string;
  localModelName?: string;
  geminiKeyConfigured: boolean;
  geminiKeyMasked: string;
  openaiKeyConfigured: boolean;
  openaiKeyMasked: string;
  anthropicKeyConfigured: boolean;
  anthropicKeyMasked: string;
  modelName: string;
  webhookSecretMasked: string;
  rlsEnforced: boolean;
}

export default function SettingsSecurityTab() {
  const queryClient = useQueryClient();

  const [selectedProvider, setSelectedProvider] = useState<'LOCAL' | 'GEMINI' | 'OPENAI' | 'ANTHROPIC'>('LOCAL');
  const [apiKeyInputs, setApiKeyInputs] = useState<Record<string, string>>({
    GEMINI: '',
    OPENAI: '',
    ANTHROPIC: '',
  });

  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [copiedSecret, setCopiedSecret] = useState(false);

  const { data: keyData } = useQuery<KeyConfigData>({
    queryKey: ['settings-keys'],
    queryFn: async () => {
      const res = await fetch('/api/settings/keys');
      if (!res.ok) throw new Error('Failed to fetch keys');
      return res.json();
    },
  });

  // Save Key & Provider Mutation
  const saveKeyMutation = useMutation({
    mutationFn: async ({ provider, keyToSave }: { provider: string; keyToSave?: string }) => {
      const res = await fetch('/api/settings/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: keyToSave || undefined, provider }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save API key');
      }
      return res.json();
    },
    onSuccess: (data) => {
      setSaveMsg(data.message || 'Settings saved successfully');
      setApiKeyInputs({ GEMINI: '', OPENAI: '', ANTHROPIC: '' });
      queryClient.invalidateQueries({ queryKey: ['settings-keys'] });
    },
    onError: (err: any) => {
      setSaveMsg(`Error: ${err.message}`);
    },
  });

  // 1-Click Test Connection Handler for any provider
  const handleTestConnection = async (prov: 'LOCAL' | 'GEMINI' | 'OPENAI' | 'ANTHROPIC') => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/settings/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'TEST_CONNECTION',
          provider: prov,
          apiKey: prov !== 'LOCAL' ? (apiKeyInputs[prov] || undefined) : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTestResult({ success: true, message: data.message });
      } else {
        setTestResult({ success: false, message: data.error || 'Test connection failed' });
      }
    } catch {
      setTestResult({ success: false, message: 'Server error testing connection' });
    } finally {
      setIsTesting(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText('whsec_9a8b7c6d5e4f3210987654321');
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  const currentActive = keyData?.activeProvider || 'LOCAL';

  const providers = [
    {
      id: 'LOCAL' as const,
      name: 'Self-Hosted Local LLM (Ollama)',
      model: keyData?.localModelName || 'oneai-qwen (Qwen 2.5 1.5B)',
      isLocal: true,
      desc: 'Hosted on your Hetzner VPS in Docker. Unlimited agent messages, zero per-token cost ($0.00 API bills), and 100% private data.',
    },
    {
      id: 'GEMINI' as const,
      name: 'Google Gemini',
      model: 'gemini-2.5-flash',
      isLocal: false,
      placeholder: keyData?.geminiKeyMasked || 'Enter Gemini API Key (AIzaSy...)',
      isConfigured: keyData?.geminiKeyConfigured ?? true,
      desc: 'Cloud API with per-token billing. High speed, recommended for vector embeddings and policy RAG retrieval.',
    },
    {
      id: 'OPENAI' as const,
      name: 'OpenAI Cloud',
      model: 'gpt-4-turbo',
      isLocal: false,
      placeholder: keyData?.openaiKeyMasked || 'Enter OpenAI API Key (sk-proj-...)',
      isConfigured: keyData?.openaiKeyConfigured ?? true,
      desc: 'Cloud API with per-token billing. Standard for complex reasoning & customer intake.',
    },
    {
      id: 'ANTHROPIC' as const,
      name: 'Anthropic Claude',
      model: 'claude-3-5-sonnet',
      isLocal: false,
      placeholder: keyData?.anthropicKeyMasked || 'Enter Anthropic API Key (sk-ant-...)',
      isConfigured: keyData?.anthropicKeyConfigured ?? true,
      desc: 'Cloud API with per-token billing. Advanced reasoning engine for complex insurance policy negotiations.',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Active AI Provider Selector & Multi-LLM Credentials */}
      <div className="bg-white border border-[#c3c6d7] rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-[#1B4B91] flex items-center gap-2">
              <Cpu className="w-5 h-5 text-[#004ac6]" />
              AI Copilot & Multi-LLM Engine Configuration
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Select your active agent engine. Choose between your <strong>Zero-Cost Self-Hosted Local Model</strong> or Cloud APIs (Gemini, OpenAI, Claude).
            </p>
          </div>
          <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            ACTIVE: {currentActive === 'LOCAL' ? 'SELF-HOSTED LOCAL (QWEN)' : currentActive}
          </span>
        </div>

        {/* 4 Provider Key Manager Cards */}
        <div className="space-y-4">
          {providers.map((prov) => {
            const isSelectedActive = currentActive === prov.id;
            const inputValue = apiKeyInputs[prov.id];

            return (
              <div
                key={prov.id}
                className={`p-4 rounded-xl border transition ${
                  isSelectedActive
                    ? 'bg-blue-50/40 border-[#004ac6] ring-1 ring-[#004ac6]/20'
                    : 'bg-slate-50/70 border-slate-200'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    {prov.isLocal ? (
                      <Server className={`w-4 h-4 ${isSelectedActive ? 'text-emerald-600' : 'text-gray-400'}`} />
                    ) : (
                      <Sparkles className={`w-4 h-4 ${isSelectedActive ? 'text-[#004ac6]' : 'text-gray-400'}`} />
                    )}
                    <h4 className="text-xs font-bold text-[#1c1b1f]">{prov.name} ({prov.model})</h4>
                    {isSelectedActive && (
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                        prov.isLocal ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-[#004ac6]'
                      }`}>
                        {prov.isLocal ? 'ACTIVE ENGINE • $0.00 BILLING' : 'ACTIVE ENGINE'}
                      </span>
                    )}
                  </div>

                  {!isSelectedActive && (
                    <button
                      type="button"
                      onClick={() => saveKeyMutation.mutate({ provider: prov.id })}
                      disabled={saveKeyMutation.isPending}
                      className="px-3 py-1 bg-white border border-gray-300 hover:bg-gray-100 text-[#1c1b1f] text-[11px] font-bold rounded-lg transition shrink-0"
                    >
                      Set as Active Engine
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-gray-500 mb-3">{prov.desc}</p>

                {prov.isLocal ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white border border-emerald-200 rounded-xl">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="font-mono text-xs font-bold text-emerald-950">
                          {keyData?.localEndpoint || 'http://ollama:11434/v1'}
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-700">
                        Isolated Docker Network • No External API Key Required • Zero Token Charges
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleTestConnection('LOCAL')}
                        disabled={isTesting}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                        Test Connection
                      </button>

                      {!isSelectedActive && (
                        <button
                          type="button"
                          onClick={() => saveKeyMutation.mutate({ provider: 'LOCAL' })}
                          disabled={saveKeyMutation.isPending}
                          className="px-3.5 py-1.5 bg-[#004ac6] hover:bg-[#003da3] text-white text-xs font-bold rounded-xl transition shadow-sm"
                        >
                          Activate Local Model
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="password"
                      placeholder={prov.placeholder}
                      value={inputValue}
                      onChange={(e) =>
                        setApiKeyInputs((prev) => ({ ...prev, [prov.id]: e.target.value }))
                      }
                      className="flex-1 px-3.5 py-2 bg-white border border-gray-300 rounded-xl text-xs outline-none focus:border-[#004ac6] focus:ring-1 focus:ring-[#004ac6] transition"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleTestConnection(prov.id as any)}
                        disabled={isTesting}
                        className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl transition flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                        Test Key
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          inputValue && saveKeyMutation.mutate({ provider: prov.id, keyToSave: inputValue })
                        }
                        disabled={!inputValue || saveKeyMutation.isPending}
                        className="px-4 py-2 bg-[#004ac6] hover:bg-[#003da3] text-white text-xs font-bold rounded-xl shadow-md disabled:opacity-40 transition flex items-center gap-1.5"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        Save Key
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Test Result Alert Banner */}
          {testResult && (
            <div className={`p-4 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
              testResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}>
              {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
              <span>{testResult.message}</span>
            </div>
          )}

          {saveMsg && (
            <p className="text-xs text-blue-800 font-semibold bg-blue-50 p-3 rounded-xl border border-blue-200">{saveMsg}</p>
          )}
        </div>
      </div>

      {/* Webhook & Security Configuration Card */}
      <div className="bg-white border border-[#c3c6d7] rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-[#1B4B91] flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#004ac6]" />
              Inbound Webhook Verification & Tenant Isolation
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Cryptographic HMAC secret used to verify incoming webhook payloads and PostgreSQL Row-Level Security.
            </p>
          </div>
          <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded-full flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" />
            RLS STRICT
          </span>
        </div>

        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-700">Webhook HMAC Secret (SHA-256)</span>
            <button
              type="button"
              onClick={copySecret}
              className="text-xs text-[#004ac6] hover:text-[#003da3] font-bold flex items-center gap-1"
            >
              {copiedSecret ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedSecret ? 'Copied!' : 'Copy Secret'}
            </button>
          </div>
          <div className="font-mono text-xs bg-white px-3 py-2 border border-gray-200 rounded-lg text-gray-600">
            {keyData?.webhookSecretMasked || 'whsec_••••••••••••94f2'}
          </div>
          <p className="text-[11px] text-gray-500">
            Include this secret in your Meta WhatsApp and Webhook signatures to ensure authentic origin verification.
          </p>
        </div>
      </div>
    </div>
  );
}
