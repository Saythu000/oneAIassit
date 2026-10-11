'use client';

import React, { useState } from 'react';

export interface EmailBlock {
  id: string;
  type: 'header' | 'text' | 'button' | 'image' | 'divider' | 'footer';
  content: string;
  style?: Record<string, string>;
}

interface EmailTemplateEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (templateData: {
    name: string;
    subject: string;
    previewText: string;
    htmlBody: string;
    plainText: string;
    jsonDesign: any;
  }) => Promise<void>;
}

export function EmailTemplateEditorModal({
  isOpen,
  onClose,
  onSave,
}: EmailTemplateEditorModalProps) {
  const [name, setName] = useState('summer_promotion_2026');
  const [subject, setSubject] = useState('Your Exclusive Health Care Savings are Inside, {{first_name | "there"}}');
  const [previewText, setPreviewText] = useState('Unlock your 20% discount on health coverage before Oct 31.');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [activeTab, setActiveTab] = useState<'editor' | 'ai' | 'preview'>('editor');

  // Blocks
  const [blocks, setBlocks] = useState<EmailBlock[]>([
    {
      id: 'b-1',
      type: 'header',
      content: 'Apex Assurance',
      style: { textAlign: 'center', fontSize: '24px', fontWeight: 'bold', color: '#004ac6' },
    },
    {
      id: 'b-2',
      type: 'text',
      content:
        'Hi {{first_name | "there"}},\n\nWe noticed your health insurance renewal for policy {{policy_number}} is coming up soon. We have updated your benefits with zero-deductible preventive care and expanded hospital network access.',
    },
    {
      id: 'b-3',
      type: 'button',
      content: 'View Your Personalized Plan',
      style: { url: 'https://apexassurance.com/renew', bgColor: '#004ac6', textColor: '#ffffff' },
    },
    {
      id: 'b-4',
      type: 'divider',
      content: '',
    },
    {
      id: 'b-5',
      type: 'footer',
      content:
        'You received this email because you opted into updates from Apex Assurance.\n{{sender_address}}\n\nTo manage your preferences, <a href="{{unsubscribe_url}}" style="color: #64748b; text-decoration: underline;">unsubscribe here</a>.',
    },
  ]);

  // AI Assist State
  const [aiTopic, setAiTopic] = useState('');
  const [aiTone, setAiTone] = useState('professional and persuasive');
  const [aiGeneratedSubjects, setAiGeneratedSubjects] = useState<string[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);

  // Test-Send State
  const [testEmail, setTestEmail] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);

  // Convert blocks to responsive HTML
  const renderHtml = () => {
    const renderedBlocks = blocks
      .map((b) => {
        if (b.type === 'header') {
          return `<div style="text-align: ${b.style?.textAlign || 'left'}; margin-bottom: 24px;">
            <h1 style="color: ${b.style?.color || '#004ac6'}; font-size: ${b.style?.fontSize || '24px'}; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
              ${b.content}
            </h1>
          </div>`;
        }
        if (b.type === 'text') {
          const paragraphs = b.content.split('\n\n').map((p) => `<p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #334155;">${p.replace(/\n/g, '<br/>')}</p>`).join('');
          return `<div>${paragraphs}</div>`;
        }
        if (b.type === 'button') {
          return `<div style="text-align: center; margin: 28px 0;">
            <a href="${b.style?.url || '#'}" style="background-color: ${b.style?.bgColor || '#004ac6'}; color: ${b.style?.textColor || '#ffffff'}; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;">
              ${b.content}
            </a>
          </div>`;
        }
        if (b.type === 'divider') {
          return `<hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 32px 0;" />`;
        }
        if (b.type === 'footer') {
          return `<div style="font-size: 12px; color: #64748b; line-height: 1.5; text-align: center;">
            ${b.content.replace(/\n/g, '<br/>')}
          </div>`;
        }
        return '';
      })
      .join('\n');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 20px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="display: none; max-height: 0px; overflow: hidden;">
    ${previewText}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px;">
    <tr>
      <td>
        ${renderedBlocks}
      </td>
    </tr>
  </table>
</body>
</html>`;
  };

  // Pre-Send Checklist Evaluation
  const validateTemplate = () => {
    const issues: { text: string; severity: 'error' | 'warning' }[] = [];
    if (!name.trim()) issues.push({ text: 'Template name is missing', severity: 'error' });
    if (!subject.trim()) issues.push({ text: 'Subject line is missing', severity: 'error' });
    if (subject.length > 90) issues.push({ text: 'Subject line is over 90 characters', severity: 'warning' });

    const combinedHtml = renderHtml();
    if (!combinedHtml.toLowerCase().includes('unsubscribe')) {
      issues.push({ text: 'Missing mandatory unsubscribe link (CAN-SPAM / GDPR)', severity: 'error' });
    }
    if (!combinedHtml.toLowerCase().includes('sender_address') && !combinedHtml.toLowerCase().includes('suite')) {
      issues.push({ text: 'Include physical sender address in footer for compliance', severity: 'warning' });
    }

    return issues;
  };

  const checklist = validateTemplate();
  const hasErrors = checklist.some((c) => c.severity === 'error');

  const handleAiGenerateSubject = async () => {
    setIsAiLoading(true);
    setAiMessage(null);
    try {
      const res = await fetch('/api/email/ai-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_subject',
          topic: aiTopic || subject,
          tone: aiTone,
        }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.result)) {
        setAiGeneratedSubjects(data.result);
      } else {
        setAiMessage('Failed to generate subjects.');
      }
    } catch (err: any) {
      setAiMessage(err.message || 'Error running AI generation');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleTestSend = async () => {
    if (!testEmail || !testEmail.includes('@')) {
      alert('Please enter a valid email address.');
      return;
    }
    setIsSendingTest(true);
    setTestStatus(null);
    try {
      const res = await fetch('/api/email/test-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail: testEmail,
          subject,
          htmlBody: renderHtml(),
          previewText,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to dispatch test email');
      setTestStatus(`✓ Test email delivered to ${testEmail}! Message ID: ${data.messageId || 'SENT'}`);
    } catch (err: any) {
      setTestStatus(`Error: ${err.message}`);
    } finally {
      setIsSendingTest(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-5xl h-[90vh] shadow-2xl flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[#004ac6] text-2xl">mail</span>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Visual Email Template Builder</h2>
              <p className="text-xs text-slate-500">Design responsive emails, test merge tags, and verify deliverability.</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 bg-slate-200/70 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setActiveTab('editor')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'editor' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Editor
            </button>
            <button
              onClick={() => setActiveTab('ai')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                activeTab === 'ai' ? 'bg-white text-[#004ac6] shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-sm">auto_awesome</span>
              AI Copywriter
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                activeTab === 'preview' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-sm">visibility</span>
              Live Preview
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 flex overflow-hidden">
          {activeTab === 'editor' && (
            <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
              {/* Form Settings & Block Configuration */}
              <div className="md:col-span-6 p-6 overflow-y-auto space-y-5 border-r border-slate-100">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 tracking-wider mb-1">
                    Template Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm font-mono focus:ring-2 focus:ring-[#004ac6] outline-none"
                    placeholder="e.g. quarterly_policy_newsletter"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 tracking-wider mb-1">
                    Subject Line *
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:ring-2 focus:ring-[#004ac6] outline-none"
                    placeholder="Your subject line with {{first_name}}"
                  />
                  <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-500">
                    <span>Quick tags:</span>
                    <button
                      type="button"
                      onClick={() => setSubject((s) => s + ' {{first_name | "there"}}')}
                      className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-[10px]"
                    >
                      + first_name
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubject((s) => s + ' {{policy_number}}')}
                      className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-[10px]"
                    >
                      + policy_number
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 tracking-wider mb-1">
                    Preview Text (Snippet)
                  </label>
                  <input
                    type="text"
                    value={previewText}
                    onChange={(e) => setPreviewText(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:ring-2 focus:ring-[#004ac6] outline-none"
                    placeholder="Brief inbox teaser seen next to subject line"
                  />
                </div>

                {/* Blocks List */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-slate-600 tracking-wider">
                      Content Blocks
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setBlocks([
                            ...blocks,
                            { id: `b-${Date.now()}`, type: 'text', content: 'New text section...' },
                          ])
                        }
                        className="px-2 py-1 rounded bg-[#004ac6]/10 text-[#004ac6] font-semibold text-xs hover:bg-[#004ac6]/20 transition-colors"
                      >
                        + Add Text
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setBlocks([
                            ...blocks,
                            {
                              id: `b-${Date.now()}`,
                              type: 'button',
                              content: 'Click Here',
                              style: { url: 'https://example.com', bgColor: '#004ac6', textColor: '#ffffff' },
                            },
                          ])
                        }
                        className="px-2 py-1 rounded bg-[#004ac6]/10 text-[#004ac6] font-semibold text-xs hover:bg-[#004ac6]/20 transition-colors"
                      >
                        + Add Button
                      </button>
                    </div>
                  </div>

                  {blocks.map((b, idx) => (
                    <div key={b.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                        <span className="uppercase">{b.type} Block</span>
                        {b.type !== 'footer' && (
                          <button
                            type="button"
                            onClick={() => setBlocks(blocks.filter((item) => item.id !== b.id))}
                            className="text-rose-500 hover:text-rose-700"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      {b.type === 'header' && (
                        <input
                          type="text"
                          value={b.content}
                          onChange={(e) => {
                            const updated = [...blocks];
                            updated[idx].content = e.target.value;
                            setBlocks(updated);
                          }}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm"
                        />
                      )}
                      {b.type === 'text' && (
                        <textarea
                          rows={4}
                          value={b.content}
                          onChange={(e) => {
                            const updated = [...blocks];
                            updated[idx].content = e.target.value;
                            setBlocks(updated);
                          }}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm leading-relaxed"
                        />
                      )}
                      {b.type === 'button' && (
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            placeholder="Button Text"
                            value={b.content}
                            onChange={(e) => {
                              const updated = [...blocks];
                              updated[idx].content = e.target.value;
                              setBlocks(updated);
                            }}
                            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                          />
                          <input
                            type="text"
                            placeholder="Target URL (https://...)"
                            value={b.style?.url || ''}
                            onChange={(e) => {
                              const updated = [...blocks];
                              updated[idx].style = { ...updated[idx].style, url: e.target.value };
                              setBlocks(updated);
                            }}
                            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                          />
                        </div>
                      )}
                      {b.type === 'footer' && (
                        <textarea
                          rows={3}
                          value={b.content}
                          onChange={(e) => {
                            const updated = [...blocks];
                            updated[idx].content = e.target.value;
                            setBlocks(updated);
                          }}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Pre-Send Deliverability Checklist & Test Send */}
              <div className="md:col-span-6 p-6 overflow-y-auto bg-slate-50/50 space-y-5">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-600">verified</span>
                    Pre-Send Compliance & Deliverability Checklist
                  </h3>

                  <div className="space-y-2">
                    {checklist.map((item, idx) => (
                      <div
                        key={idx}
                        className={`p-2.5 rounded-xl text-xs flex items-center gap-2 border ${
                          item.severity === 'error'
                            ? 'bg-rose-50 border-rose-200 text-rose-800'
                            : 'bg-amber-50 border-amber-200 text-amber-800'
                        }`}
                      >
                        <span className="material-symbols-outlined text-base">
                          {item.severity === 'error' ? 'cancel' : 'warning'}
                        </span>
                        <span>{item.text}</span>
                      </div>
                    ))}
                    {checklist.length === 0 && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 font-medium">
                        <span className="material-symbols-outlined text-base">check_circle</span>
                        All pre-send deliverability checks passed! Ready for one-off broadcast or scheduling.
                      </div>
                    )}
                  </div>
                </div>

                {/* Instant Test-Send Box */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sky-600">send</span>
                    Send Test Email
                  </h3>
                  <p className="text-xs text-slate-500">
                    Sends an immediate test copy rendered with mock customer merge tags directly to your inbox.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      placeholder="your.email@company.com"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#004ac6]"
                    />
                    <button
                      type="button"
                      disabled={isSendingTest}
                      onClick={handleTestSend}
                      className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 disabled:opacity-50 transition-colors flex items-center gap-1"
                    >
                      {isSendingTest ? 'Sending...' : 'Send Test'}
                    </button>
                  </div>
                  {testStatus && (
                    <p
                      className={`text-xs mt-1 font-medium ${
                        testStatus.startsWith('✓') ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {testStatus}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="flex-1 p-8 overflow-y-auto space-y-6 max-w-3xl mx-auto w-full">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 p-6 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-[#004ac6]">
                  <span className="material-symbols-outlined">auto_awesome</span>
                  <h3 className="font-bold text-base">AI Assistant: Subject Lines & Email Copy</h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Leverages the platform’s connected LLM (Gemini / OpenAI / Anthropic) to formulate spam-resilient subject lines, body variations, or translations tailored to your audience.
                </p>
              </div>

              <div className="space-y-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 tracking-wider mb-1">
                    Campaign Goal or Topic
                  </label>
                  <input
                    type="text"
                    value={aiTopic}
                    onChange={(e) => setAiTopic(e.target.value)}
                    placeholder="e.g. End of year insurance review discount with free preventive checkup"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:ring-2 focus:ring-[#004ac6] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 tracking-wider mb-1">
                    Desired Tone
                  </label>
                  <select
                    value={aiTone}
                    onChange={(e) => setAiTone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:ring-2 focus:ring-[#004ac6] outline-none"
                  >
                    <option value="professional and persuasive">Professional & Persuasive</option>
                    <option value="friendly and reassuring">Friendly & Reassuring</option>
                    <option value="urgent and time-sensitive">Urgent & Time-Sensitive</option>
                    <option value="informative and advisory">Informative & Advisory</option>
                  </select>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={isAiLoading}
                    onClick={handleAiGenerateSubject}
                    className="px-5 py-2.5 bg-[#004ac6] text-white rounded-xl text-sm font-semibold hover:bg-[#0039a0] disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-sm">psychology</span>
                    {isAiLoading ? 'Brainstorming...' : 'Generate 5 Subject Variants'}
                  </button>
                </div>

                {aiMessage && <p className="text-xs text-rose-500 font-medium">{aiMessage}</p>}

                {aiGeneratedSubjects.length > 0 && (
                  <div className="pt-4 border-t border-slate-100 space-y-2">
                    <h4 className="text-xs font-bold uppercase text-slate-600 tracking-wider">
                      Generated Subject Lines (Click to Apply)
                    </h4>
                    <div className="space-y-2">
                      {aiGeneratedSubjects.map((sub, idx) => (
                        <div
                          key={idx}
                          onClick={() => {
                            setSubject(sub);
                            setActiveTab('editor');
                          }}
                          className="p-3 rounded-xl bg-slate-50 hover:bg-blue-50/70 border border-slate-200 hover:border-blue-200 text-xs font-medium text-slate-800 cursor-pointer flex items-center justify-between group transition-all"
                        >
                          <span>{sub}</span>
                          <span className="text-[11px] font-semibold text-[#004ac6] opacity-0 group-hover:opacity-100 transition-opacity">
                            Use this →
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'preview' && (
            <div className="flex-1 p-6 overflow-y-auto bg-slate-100 flex flex-col items-center">
              {/* Device Selector */}
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm mb-4">
                <button
                  type="button"
                  onClick={() => setPreviewDevice('desktop')}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                    previewDevice === 'desktop' ? 'bg-[#004ac6] text-white' : 'text-slate-600'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">desktop_windows</span>
                  Desktop
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('mobile')}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                    previewDevice === 'mobile' ? 'bg-[#004ac6] text-white' : 'text-slate-600'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">smartphone</span>
                  Mobile
                </button>
              </div>

              {/* Rendered Email Preview Container */}
              <div
                className={`bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden transition-all duration-200 ${
                  previewDevice === 'desktop' ? 'w-full max-w-2xl' : 'w-[375px]'
                }`}
              >
                <div className="p-3 bg-slate-50 border-b border-slate-200 text-xs text-slate-500 font-mono">
                  Subject: <span className="font-semibold text-slate-800">{subject}</span>
                </div>
                <iframe
                  title="Email Preview"
                  srcDoc={renderHtml()}
                  className="w-full h-[600px] border-0"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 bg-white flex items-center justify-between">
          <p className="text-xs text-slate-400">
            {hasErrors ? '⚠️ Please address checklist errors before saving.' : '✓ Ready to save and broadcast.'}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={hasErrors}
              onClick={async () => {
                const html = renderHtml();
                const plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                await onSave({
                  name,
                  subject,
                  previewText,
                  htmlBody: html,
                  plainText: plain,
                  jsonDesign: { blocks },
                });
                onClose();
              }}
              className="px-5 py-2 rounded-xl bg-[#004ac6] text-white text-xs font-semibold hover:bg-[#0039a0] disabled:opacity-50 transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <span className="material-symbols-outlined text-sm">check</span>
              Save Email Template
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
