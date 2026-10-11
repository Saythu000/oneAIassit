'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenantInfo } from '@/hooks/useTenantInfo';
import { getClientSocket } from '@/lib/socket-client';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import WhatsAppChatView from '@/components/chat/WhatsAppChatView';
import IMessageChatView from '@/components/chat/IMessageChatView';
import InstagramChatView from '@/components/chat/InstagramChatView';
import EmailChatView from '@/components/chat/EmailChatView';

interface Conversation {
  id: string;
  channel?: 'WHATSAPP' | 'IMESSAGE' | 'INSTAGRAM' | 'EMAIL' | 'SMS' | string;
  status: 'OPEN' | 'CLOSED' | 'PENDING';
  lastMessageAt: string;
  needsEscalation: boolean;
  assignedAgentId: string | null;
  lastMessagePreview: string;
  lastInboundMessageAt: string | null;
  customer: {
    id: string;
    displayName: string;
    phone: string;
    pipelineStage: string;
    intake: {
      age: number | null;
      state: string | null;
      budgetMin: number | null;
      budgetMax: number | null;
      familySize: number | null;
      healthConditions: string;
    } | null;
  };
}

interface Message {
  id: string;
  content: string;
  direction: 'INBOUND' | 'OUTBOUND';
  senderType: 'CUSTOMER' | 'BOT' | 'AGENT';
  createdAt: string;
  status?: string;
  channelMessageId?: string;
  contextMessageId?: string;
}

interface Template {
  id: string;
  name: string;
  content: string;
}

export default function InboxPage() {
  const queryClient = useQueryClient();
  const { data: info } = useTenantInfo();
  const tenantId = info?.tenantId;

  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<'ALL' | 'WHATSAPP' | 'IMESSAGE' | 'INSTAGRAM' | 'EMAIL'>('ALL');
  const [replyText, setReplyText] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'UNREAD' | 'AI' | 'ESCALATED' | 'IMESSAGE' | 'INSTAGRAM' | 'EMAIL' | 'PENDING' | 'CLOSED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showTemplatesDropdown, setShowTemplatesDropdown] = useState(false);
  const [isIntakeExpanded, setIsIntakeExpanded] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const messageEndRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      alert('Microphone access is required to record voice notes.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
  };

  // 1. Fetch conversations via TanStack Query
  const { data: conversations, isLoading: convsLoading } = useQuery<Conversation[]>({
    queryKey: ['conversations', tenantId],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/conversations');
      if (!res.ok) throw new Error('Failed to load conversations');
      return res.json();
    },
    enabled: !!tenantId,
  });

  // 2. Fetch messages for selected conversation
  const { data: messages, isLoading: msgsLoading } = useQuery<Message[]>({
    queryKey: ['messages', selectedConvId],
    queryFn: async () => {
      if (!selectedConvId) return [];
      const res = await fetch(`/api/chat/messages?conversationId=${selectedConvId}`);
      if (!res.ok) throw new Error('Failed to load messages');
      return res.json();
    },
    enabled: !!selectedConvId,
  });

  // 3. Fetch pre-approved templates
  const { data: templates } = useQuery<Template[]>({
    queryKey: ['templates', tenantId],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/templates');
      if (!res.ok) throw new Error('Failed to load templates');
      return res.json();
    },
    enabled: !!tenantId,
  });

  // 4. Send reply mutation
  const sendReplyMutation = useMutation({
    mutationFn: async (text: string) => {
      if (!selectedConvId || !tenantId) return;
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: selectedConvId, to: selectedConv?.customer.phone, text }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to send message');
      }
      return res.json();
    },
    onSuccess: () => {
      setReplyText('');
      setShowTemplatesDropdown(false);
      queryClient.invalidateQueries({ queryKey: ['messages', selectedConvId] });
      queryClient.invalidateQueries({ queryKey: ['conversations', tenantId] });
    },
  });

  // 5. Toggle AI Handling vs Agent Takeover mutation
  const toggleHandlerMutation = useMutation({
    mutationFn: async (needsEscalation: boolean) => {
      if (!selectedConvId) return;
      const res = await fetch('/api/dashboard/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: selectedConvId, needsEscalation }),
      });
      if (!res.ok) {
        throw new Error('Failed to toggle AI/Agent handling.');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations', tenantId] });
    },
  });

  // 6. Close conversation & generate AI summary mutation
  const closeConversationMutation = useMutation({
    mutationFn: async () => {
      if (!selectedConvId) return;
      const res = await fetch('/api/dashboard/conversations/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: selectedConvId }),
      });
      if (!res.ok) throw new Error('Failed to close conversation');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['messages', selectedConvId] });
    },
  });

  // 6. Socket.io Live Setup
  useEffect(() => {
    if (!tenantId) return;

    const socketInstance = getClientSocket(tenantId);

    socketInstance.on('new_message', (data: { conversationId: string; message: Message }) => {
      console.log('[Socket] New message event received:', data);

      const normalizedMsg: Message = {
        ...data.message,
        createdAt:
          typeof data.message.createdAt === 'string'
            ? data.message.createdAt
            : new Date(data.message.createdAt).toISOString(),
      };

      queryClient.setQueryData<Message[]>(['messages', data.conversationId], (old = []) => {
        if (old.some((m) => m.id === normalizedMsg.id)) return old;
        return [...old, normalizedMsg];
      });

      queryClient.invalidateQueries({ queryKey: ['conversations', tenantId] });
    });

    socketInstance.on('whatsapp_status_update', () => {
      queryClient.invalidateQueries({ queryKey: ['tenantInfo'] });
    });

    return () => {
      socketInstance.disconnect();
    };
  }, [tenantId, selectedConvId, queryClient]);

  // Click outside listener for templates dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowTemplatesDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll message stream to bottom
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || sendReplyMutation.isPending) return;
    sendReplyMutation.mutate(replyText);
  };

  const selectedConv = conversations?.find((c) => c.id === selectedConvId);

  // Time remaining helper for WhatsApp 24h Customer Service Window
  const getSessionWindowData = (lastInboundMessageAt: string | null) => {
    if (!lastInboundMessageAt) return { isClosed: true, text: 'Expired', hoursRemaining: 0, msRemaining: 0 };
    const lastInboundTime = new Date(lastInboundMessageAt).getTime();
    const elapsedMs = Date.now() - lastInboundTime;
    const windowMs = 24 * 60 * 60 * 1000; // 24 hours
    const remainingMs = windowMs - elapsedMs;

    if (remainingMs <= 0) {
      return { isClosed: true, text: 'Expired', hoursRemaining: 0, msRemaining: 0 };
    }

    const hours = Math.floor(remainingMs / (1000 * 60 * 60));
    const mins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
    return {
      isClosed: false,
      text: `${hours}h ${mins}m`,
      hoursRemaining: hours,
      msRemaining: remainingMs,
    };
  };

  // Format relative timestamp helper
  const getRelativeTime = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatTimeString = (dateInput: string | Date) => {
    const date = new Date(dateInput);
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const hoursStr = hours.toString().padStart(2, '0');
    return `${hoursStr}:${minutes} ${ampm}`;
  };

  // Client-Side Tab & Search Filtering
  const filteredConversations = conversations?.filter((conv) => {
    // 0. Channel Selection Filter
    if (selectedChannel !== 'ALL') {
      const convChan = ((conv as any).channel || 'WHATSAPP').toUpperCase();
      if (convChan !== selectedChannel) return false;
    }

    // 1. Search Query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const nameMatch = conv.customer.displayName.toLowerCase().includes(query);
      const phoneMatch = conv.customer.phone.toLowerCase().includes(query);
      if (!nameMatch && !phoneMatch) return false;
    }

    // 2. Tab selection
    if (activeTab === 'CLOSED') return conv.status === 'CLOSED';
    if (conv.status === 'CLOSED') return false; // Hide closed from active lists

    if (activeTab === 'UNREAD') {
      // Unread means the last message in the thread is inbound (from the customer)
      return conv.lastInboundMessageAt === conv.lastMessageAt;
    }
    if (activeTab === 'AI') return !conv.needsEscalation;
    if (activeTab === 'ESCALATED') return conv.needsEscalation;
    if (activeTab === 'IMESSAGE') return (conv as any).channel === 'IMESSAGE';
    if (activeTab === 'INSTAGRAM') return (conv as any).channel === 'INSTAGRAM';
    if (activeTab === 'EMAIL') return (conv as any).channel === 'EMAIL';
    if (activeTab === 'PENDING') return conv.status === 'PENDING';

    return true;
  });

  const sessionWindow = selectedConv ? getSessionWindowData(selectedConv.lastInboundMessageAt) : null;
  const isSessionClosed = sessionWindow?.isClosed ?? true;
  const showWarningBanner = !isSessionClosed && sessionWindow!.msRemaining < 6 * 60 * 60 * 1000;

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 gap-3 font-sans text-[#1c1b1f]">
      {/* TOP CHANNEL HUB SELECTOR BAR */}
      <div className="flex items-center justify-between bg-white border border-[#c3c6d7] rounded-xl px-4 py-2.5 shadow-sm shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#737686] mr-2">
            Channel:
          </span>
          <button
            onClick={() => setSelectedChannel('ALL')}
            className={cn(
              'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5',
              selectedChannel === 'ALL'
                ? 'bg-[#1c1b1f] text-white shadow-sm'
                : 'bg-slate-100 text-[#49454f] hover:bg-slate-200'
            )}
          >
            <span className="material-symbols-outlined text-[15px]">all_inbox</span>
            All Channels
          </button>
          <button
            onClick={() => setSelectedChannel('WHATSAPP')}
            className={cn(
              'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border',
              selectedChannel === 'WHATSAPP'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
            )}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            WhatsApp
          </button>
          <button
            onClick={() => setSelectedChannel('IMESSAGE')}
            className={cn(
              'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border',
              selectedChannel === 'IMESSAGE'
                ? 'bg-[#007AFF] text-white border-[#007AFF] shadow-sm'
                : 'bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100'
            )}
          >
            <span className="w-2 h-2 rounded-full bg-[#007AFF]" />
            Apple iMessage
          </button>
          <button
            onClick={() => setSelectedChannel('INSTAGRAM')}
            className={cn(
              'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border',
              selectedChannel === 'INSTAGRAM'
                ? 'bg-gradient-to-r from-[#833ab4] to-[#fd1d1d] text-white border-transparent shadow-sm'
                : 'bg-gradient-to-r from-purple-50 to-rose-50 text-purple-900 border-purple-200 hover:brightness-95'
            )}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            Instagram Direct
          </button>
          <button
            onClick={() => setSelectedChannel('EMAIL')}
            className={cn(
              'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border',
              selectedChannel === 'EMAIL'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100'
            )}
          >
            <span className="w-2 h-2 rounded-full bg-indigo-400" />
            Two-Way Email
          </button>
        </div>

        <div className="text-[11px] text-[#737686] font-medium hidden sm:block">
          Active Interface: <strong className="text-[#1c1b1f]">
            {selectedConv 
              ? ((selectedConv as any).channel || 'WHATSAPP') 
              : selectedChannel === 'ALL' ? 'Native Auto-Detect' : selectedChannel}
          </strong>
        </div>
      </div>

      <div className="flex-1 border border-[#c3c6d7] bg-white rounded-2xl overflow-hidden flex shadow-sm min-h-0">
        {/* COLUMN 2: Conversation List */}
        <section className="w-[340px] flex flex-col border-r border-[#c3c6d7] bg-white shrink-0">
          {/* Search */}
          <div className="p-4 border-b border-[#c3c6d7]/60 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#1c1b1f]">
                {selectedChannel === 'ALL' ? 'Unified Inbox' : `${selectedChannel.charAt(0) + selectedChannel.slice(1).toLowerCase()} Inbox`}
              </h2>
              <span className="text-[10px] bg-slate-100 text-[#49454f] font-bold px-2 py-0.5 rounded-full border border-[#c3c6d7]/50">
                {filteredConversations?.length || 0} chats
              </span>
            </div>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#737686] text-[18px]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-[#c3c6d7] rounded-lg focus:outline-none focus:border-[#004ac6] focus:ring-4 focus:ring-[#004ac6]/10 text-xs"
            />
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex px-2 border-b border-[#c3c6d7]/60 overflow-x-auto shrink-0 scrollbar-none">
          {(['ALL', 'UNREAD', 'AI', 'ESCALATED', 'EMAIL', 'IMESSAGE', 'INSTAGRAM', 'PENDING', 'CLOSED'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-4 py-3 text-xs font-semibold border-b-2 capitalize whitespace-nowrap transition-colors',
                activeTab === tab
                  ? 'border-[#004ac6] text-[#004ac6]'
                  : 'border-transparent text-[#737686] hover:text-[#1c1b1f]'
              )}
            >
              {tab === 'AI' ? 'AI Handling' : tab === 'IMESSAGE' ? 'iMessage' : tab === 'EMAIL' ? 'Email' : tab.toLowerCase()}
            </button>
          ))}
        </div>

        {/* Conversation List Stream */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#c3c6d7]/40">
          {convsLoading ? (
            <div className="space-y-4 p-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-slate-100 rounded-full animate-pulse shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-20 bg-slate-100 rounded animate-pulse" />
                    <div className="h-2.5 w-32 bg-slate-100 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : !filteredConversations || filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-[#737686] text-xs">
              No conversations matched.
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = conv.id === selectedConvId;
              const initials = conv.customer.displayName.substring(0, 2).toUpperCase();
              const winData = getSessionWindowData(conv.lastInboundMessageAt);
              const timerIsRed = !winData.isClosed && winData.msRemaining < 2 * 60 * 60 * 1000;

              return (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConvId(conv.id)}
                  className={cn(
                    'w-full p-4 text-left flex items-start gap-3 transition-colors border-l-4 relative',
                    isSelected
                      ? 'bg-[#004ac6]/5 border-[#004ac6] text-[#004ac6]'
                      : 'hover:bg-slate-50/50 border-transparent text-[#49454f]'
                  )}
                >
                  {/* Status Badges in corner */}
                  <div className="absolute top-4 right-4 flex items-center gap-1.5">
                    <span className={cn(
                      "px-1.5 py-0.5 text-[9px] rounded font-bold uppercase tracking-wider border",
                      (conv as any).channel === 'IMESSAGE'
                        ? "bg-sky-100 text-sky-800 border-sky-200"
                        : (conv as any).channel === 'INSTAGRAM'
                        ? "bg-gradient-to-r from-purple-100 to-rose-100 text-purple-900 border-purple-200"
                        : (conv as any).channel === 'EMAIL'
                        ? "bg-indigo-100 text-indigo-800 border-indigo-200"
                        : "bg-emerald-100 text-emerald-800 border-emerald-200"
                    )}>
                      {(conv as any).channel === 'IMESSAGE' ? 'iMessage' : (conv as any).channel === 'INSTAGRAM' ? 'Instagram' : (conv as any).channel === 'EMAIL' ? 'Email' : 'WhatsApp'}
                    </span>
                    <span className={cn(
                      "px-1.5 py-0.5 text-[9px] rounded font-bold uppercase tracking-wider border",
                      conv.needsEscalation 
                        ? "bg-amber-100 text-amber-800 border-amber-200" 
                        : "bg-blue-100 text-blue-800 border-blue-200"
                    )}>
                      {conv.needsEscalation ? 'Agent' : 'AI'}
                    </span>
                  </div>

                  <div className={cn(
                    "h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5",
                    isSelected ? "bg-[#004ac6]/10 text-[#004ac6]" : "bg-slate-100 text-[#49454f] border border-[#c3c6d7]/50"
                  )}>
                    {initials}
                  </div>

                  <div className="min-w-0 flex-1 pr-12">
                    <div className="flex items-center justify-between">
                      <span className={cn(
                        "font-bold text-xs truncate",
                        isSelected ? "text-[#004ac6]" : "text-[#1c1b1f]"
                      )}>
                        {conv.customer.displayName}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#49454f] truncate mt-0.5 font-medium">
                      {conv.lastMessagePreview || "No messages yet"}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[9px] text-[#737686] font-medium">
                        +{conv.customer.phone}
                      </span>
                      <span className="text-[#c3c6d7] text-[10px]">•</span>
                      <span className="text-[9px] text-[#737686] font-medium">
                        {getRelativeTime(conv.lastMessageAt)}
                      </span>
                      <span className="text-[#c3c6d7] text-[10px]">•</span>
                      <span className={cn(
                        "px-1.5 py-0.5 rounded text-[8px] font-bold flex items-center gap-0.5 border",
                        winData.isClosed 
                          ? "bg-slate-100 border-slate-200 text-slate-400"
                          : timerIsRed 
                          ? "bg-rose-50 border-rose-200 text-rose-700 animate-pulse" 
                          : "bg-emerald-50 border-emerald-250 text-emerald-800"
                      )}>
                        <span className="material-symbols-outlined text-[10px]">schedule</span>
                        {winData.isClosed ? 'Expired' : winData.text}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </section>

      {/* COLUMN 3: Chat Thread */}
      <section className="flex-1 flex flex-col bg-slate-50/10 min-w-0 overflow-hidden">
        {selectedConvId && selectedConv ? (
          (() => {
            const chan = ((selectedConv as any).channel || 'WHATSAPP').toUpperCase();

            // Native Props common to all 3 channel chat views
            const commonProps = {
              conversationId: selectedConv.id,
              customerName: selectedConv.customer.displayName,
              customerPhone: selectedConv.customer.phone,
              messages: (messages || []) as any,
              replyText,
              setReplyText,
              onSend: handleSend,
              isSending: sendReplyMutation.isPending,
              needsEscalation: selectedConv.needsEscalation,
            };

            const chatElement = chan === 'IMESSAGE' ? (
              <IMessageChatView {...commonProps} />
            ) : chan === 'INSTAGRAM' ? (
              <InstagramChatView {...commonProps} />
            ) : chan === 'EMAIL' ? (
              <EmailChatView {...commonProps} />
            ) : (
              <WhatsAppChatView {...commonProps} />
            );

            return (
              <motion.div
                key={selectedConv.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.15 }}
                className="flex-1 flex flex-col h-full min-h-0 overflow-hidden"
              >
                {chatElement}
              </motion.div>
            );
          })()
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <span className="material-symbols-outlined text-[48px] text-[#737686] mb-4">
              forum
            </span>
            <h4 className="text-xs font-bold text-[#1c1b1f]">No Chat Selected</h4>
            <p className="text-[11px] text-[#49454f] max-w-xs mt-1 leading-relaxed">
              Select an active conversation thread from the left menu to view the channel-native chat interface, live messages, and send replies.
            </p>
          </div>
        )}
      </section>

      {/* COLUMN 4: Customer Profile */}
      {selectedConvId && selectedConv?.customer && (
        <section className="w-72 border-l border-[#c3c6d7] bg-white flex flex-col shrink-0">
          {/* Avatar & Name */}
          <div className="p-6 flex flex-col items-center text-center border-b border-[#c3c6d7]/60">
            <div className="w-16 h-16 rounded-full bg-[#004ac6]/10 text-[#004ac6] border-2 border-[#004ac6]/20 flex items-center justify-center font-bold text-xl mb-3 shadow-inner">
              {selectedConv.customer.displayName.substring(0, 2).toUpperCase()}
            </div>
            <h4 className="font-bold text-xs text-[#1c1b1f] leading-tight">
              {selectedConv.customer.displayName}
            </h4>
            <p className="text-[10px] text-[#737686] mt-1">
              +{selectedConv.customer.phone}
            </p>
            <span className="inline-block mt-3 px-3 py-1 bg-teal-50 border border-teal-200 text-teal-800 text-[8px] font-bold rounded-full uppercase tracking-wider">
              {selectedConv.customer.pipelineStage.replace('_', ' ').toLowerCase()}
            </span>
          </div>

          {/* Collapsible Intake Answers */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            <div className="space-y-3">
              <button
                onClick={() => setIsIntakeExpanded(!isIntakeExpanded)}
                className="w-full flex items-center justify-between text-[10px] font-bold text-[#49454f] uppercase tracking-wider"
              >
                <span>Intake Answers</span>
                <span className="material-symbols-outlined text-[16px]">
                  {isIntakeExpanded ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
                </span>
              </button>

              {isIntakeExpanded && (
                <div className="bg-slate-50 border border-[#c3c6d7]/40 rounded-xl p-4 space-y-4">
                  {selectedConv.customer.intake ? (
                    <>
                      <div>
                        <span className="text-[9px] text-[#737686] font-bold uppercase tracking-wider">Age</span>
                        <p className="text-xs font-semibold text-[#1c1b1f] mt-0.5">
                          {selectedConv.customer.intake.age || 'Not specified'} years
                        </p>
                      </div>
                      <div>
                        <span className="text-[9px] text-[#737686] font-bold uppercase tracking-wider">State Region</span>
                        <p className="text-xs font-semibold text-[#1c1b1f] mt-0.5">
                          {selectedConv.customer.intake.state || 'Not specified'}
                        </p>
                      </div>
                      <div>
                        <span className="text-[9px] text-[#737686] font-bold uppercase tracking-wider">Monthly Budget</span>
                        <p className="text-xs font-semibold text-[#1c1b1f] mt-0.5">
                          {selectedConv.customer.intake.budgetMin && selectedConv.customer.intake.budgetMax
                            ? `$${selectedConv.customer.intake.budgetMin} - $${selectedConv.customer.intake.budgetMax} / mo`
                            : 'Not specified'}
                        </p>
                      </div>
                      <div>
                        <span className="text-[9px] text-[#737686] font-bold uppercase tracking-wider">Family size</span>
                        <p className="text-xs font-semibold text-[#1c1b1f] mt-0.5">
                          {selectedConv.customer.intake.familySize || '1'} member(s)
                        </p>
                      </div>
                      <div>
                        <span className="text-[9px] text-[#737686] font-bold uppercase tracking-wider">Health Conditions</span>
                        <p className="text-xs font-semibold text-[#1c1b1f] mt-0.5 leading-relaxed">
                          {selectedConv.customer.intake.healthConditions}
                        </p>
                      </div>
                    </>
                  ) : (
                    <p className="text-[10px] text-[#737686] italic text-center py-2">
                      No intake answers logged yet.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Full Profile Link Footer */}
          <div className="p-4 border-t border-[#c3c6d7]/60">
            <Link
              href={`/dashboard/customers/${selectedConv.customer.id}`}
              className="flex items-center justify-center gap-1.5 w-full py-2.5 bg-[#004ac6] hover:brightness-105 text-white font-bold rounded-xl text-[10px] transition-colors"
            >
              View Full Profile
              <span className="material-symbols-outlined text-[14px]">open_in_new</span>
            </Link>
          </div>
        </section>
      )}
      </div>
    </div>
  );
}

