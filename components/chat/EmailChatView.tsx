'use client';

import React, { useRef, useEffect } from 'react';
import { Mail, Send, ShieldCheck, User, Sparkles } from 'lucide-react';
import { sanitizeEmailHtml } from '@/lib/email/sanitize';

export interface EmailChatMessage {
  id: string;
  content: string;
  direction: 'INBOUND' | 'OUTBOUND';
  senderType?: 'CUSTOMER' | 'BOT' | 'AGENT';
  createdAt: string;
  status?: string;
}

export interface EmailChatViewProps {
  conversationId: string;
  customerName: string;
  customerPhone: string;
  messages: EmailChatMessage[];
  replyText: string;
  setReplyText: (text: string) => void;
  onSend: (e: React.FormEvent) => void;
  isSending: boolean;
  needsEscalation?: boolean;
}

export default function EmailChatView({
  conversationId: _conversationId,
  customerName,
  customerPhone,
  messages,
  replyText,
  setReplyText,
  onSend,
  isSending,
  needsEscalation: _needsEscalation,
}: EmailChatViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const customerEmail = customerPhone.startsWith('email:')
    ? customerPhone.replace('email:', '')
    : customerPhone.includes('@')
    ? customerPhone
    : `${customerName.toLowerCase().replace(/\s+/g, '.')}@inbound.customer`;

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50/50 relative overflow-hidden font-sans">
      {/* Email Header Bar */}
      <header className="h-[60px] bg-white border-b border-slate-200 px-5 flex items-center justify-between shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-sm">
            <Mail className="w-4 h-4" />
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-900 leading-tight">
                {customerName}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                Two-Way Email
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium leading-tight mt-0.5">
              &lt;{customerEmail}&gt;
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold flex items-center gap-1.5 text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            HTML Sanitized &amp; XSS Protected
          </span>
        </div>
      </header>

      {/* Email Message Thread Stream */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 z-10">
        {messages && messages.length > 0 ? (
          messages.map((msg) => {
            const isInbound = msg.direction === 'INBOUND';
            const isHtml = /<[a-z][\s\S]*>/i.test(msg.content);

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isInbound ? 'items-start' : 'items-end'}`}
              >
                <div
                  className={`max-w-2xl w-full rounded-2xl border p-4 shadow-sm transition-all ${
                    isInbound
                      ? 'bg-white border-slate-200/90 text-slate-800'
                      : 'bg-indigo-50/70 border-indigo-200/90 text-slate-900'
                  }`}
                >
                  {/* Sender Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3 text-xs">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          isInbound
                            ? 'bg-slate-100 text-slate-700'
                            : 'bg-indigo-600 text-white'
                        }`}
                      >
                        {isInbound ? <User className="w-3.5 h-3.5" /> : 'A'}
                      </div>
                      <span className="font-bold">
                        {isInbound ? customerName : 'Support Advisor (You)'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {isInbound ? `<${customerEmail}>` : 'via OneAIAssist'}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {formatTime(msg.createdAt)}
                    </span>
                  </div>

                  {/* Email Body */}
                  <div className="text-xs leading-relaxed">
                    {isHtml ? (
                      <div
                        className="prose prose-xs max-w-none text-slate-800"
                        dangerouslySetInnerHTML={{
                          __html: sanitizeEmailHtml(msg.content),
                        }}
                      />
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center h-48 text-center text-slate-400 space-y-2">
            <Mail className="w-8 h-8 text-slate-300" />
            <p className="text-xs font-semibold">No messages yet in this email thread.</p>
            <p className="text-[11px] text-slate-400 max-w-xs">
              Replies to your outbound marketing campaigns will automatically appear here.
            </p>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Email Composer */}
      <footer className="bg-white border-t border-slate-200 p-4 shrink-0 z-10 shadow-sm">
        <form onSubmit={onSend} className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium px-1">
            <span className="flex items-center gap-1.5 text-indigo-700 font-bold">
              <Mail className="w-3.5 h-3.5" /> Reply by Email to {customerEmail}
            </span>
            <span className="text-[10px] text-slate-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" /> Canned replies &amp; AI drafting supported
            </span>
          </div>

          <div className="relative">
            <textarea
              rows={3}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  onSend(e);
                }
              }}
              placeholder={`Write your email reply to ${customerName}... (Press Ctrl+Enter to send)`}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-normal transition resize-none"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  setReplyText(
                    `Hello ${customerName.split(' ')[0]},\n\nThank you for reaching out! We have reviewed your policy details and would be delighted to assist.\n\nBest regards,\nApex Assurance Customer Care`
                  )
                }
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-[10px] font-bold text-slate-600 transition"
              >
                Insert Policy Care Template
              </button>
            </div>

            <button
              type="submit"
              disabled={isSending || !replyText.trim()}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              {isSending ? 'Sending...' : 'Send Email Reply'}
            </button>
          </div>
        </form>
      </footer>
    </div>
  );
}
