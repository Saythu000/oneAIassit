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

import {
  Search,
  MessageSquare,
  Layers,
  Smartphone,
  Mail,
  Clock,
  User,
  ChevronUp,
  ChevronDown,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Bot
} from 'lucide-react';

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
    } catch {
      alert('Microphone access is required to record voice notes.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(recordingTimerRef.current);
    }
  };

  // 1. Fetch Conversations
  const { data: conversations, isLoading: convsLoading } = useQuery<Conversation[]>({
    queryKey: ['conversations', tenantId],
    queryFn: async () => {
      const res = await fetch('/api/conversations');
      if (!res.ok) throw new Error('Failed to fetch conversations');
      return res.json();
    },
    enabled: !!tenantId,
    refetchInterval: 5000,
  });

  // Select first conversation if none selected
  useEffect(() => {
    if (!selectedConvId && conversations && conversations.length > 0) {
      setSelectedConvId(conversations[0].id);
    }
  }, [conversations, selectedConvId]);

  // 2. Fetch Messages for selected conversation
  const { data: messages } = useQuery<Message[]>({
    queryKey: ['messages', selectedConvId],
    queryFn: async () => {
      if (!selectedConvId) return [];
      const res = await fetch(`/api/conversations/${selectedConvId}/messages`);
      if (!res.ok) throw new Error('Failed to fetch messages');
      return res.json();
    },
    enabled: !!selectedConvId,
    refetchInterval: 3000,
  });

  // Scroll to bottom on new messages
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 3. Socket real-time message handling
  useEffect(() => {
    if (!tenantId) return;

    const socket = getClientSocket();

    socket.on('new_message', (data: { conversationId: string; message: Message }) => {
      queryClient.setQueryData<Message[]>(['messages', data.conversationId], (old) => {
        if (!old) return [data.message];
        if (old.some((m) => m.id === data.message.id)) return old;
        return [...old, data.message];
      });

      queryClient.invalidateQueries({ queryKey: ['conversations', tenantId] });
    });

    socket.on('conversation_updated', () => {
      queryClient.invalidateQueries({ queryKey: ['conversations', tenantId] });
    });

    return () => {
      socket.off('new_message');
      socket.off('conversation_updated');
    };
  }, [tenantId, queryClient]);

  // 4. Send Message Mutation
  const sendReplyMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!selectedConvId) throw new Error('No conversation selected');
      const res = await fetch(`/api/conversations/${selectedConvId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to send message');
      }
      return res.json();
    },
    onSuccess: (newMessage) => {
      setReplyText('');
      queryClient.setQueryData<Message[]>(['messages', selectedConvId], (old) => {
        if (!old) return [newMessage];
        return [...old, newMessage];
      });
      queryClient.invalidateQueries({ queryKey: ['conversations', tenantId] });
    },
    onError: (err: any) => {
      alert(`Error sending message: ${err.message}`);
    },
  });

  const handleSend = () => {
    if (!replyText.trim() || sendReplyMutation.isPending) return;
    sendReplyMutation.mutate(replyText);
  };

  // Close dropdown when clicked outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowTemplatesDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter Conversations
  const filteredConversations = conversations?.filter((conv) => {
    // 1. Channel Filter
    if (selectedChannel !== 'ALL') {
      const convChannel = (conv.channel || 'WHATSAPP').toUpperCase();
      if (convChannel !== selectedChannel) return false;
    }

    // 2. Tab Filter
    if (activeTab === 'ESCALATED' && !conv.needsEscalation) return false;
    if (activeTab === 'AI' && conv.needsEscalation) return false;
    if (activeTab === 'PENDING' && conv.status !== 'PENDING') return false;
    if (activeTab === 'CLOSED' && conv.status !== 'CLOSED') return false;
    if (activeTab === 'IMESSAGE' && (conv.channel || 'WHATSAPP').toUpperCase() !== 'IMESSAGE') return false;
    if (activeTab === 'INSTAGRAM' && (conv.channel || 'WHATSAPP').toUpperCase() !== 'INSTAGRAM') return false;
    if (activeTab === 'EMAIL' && (conv.channel || 'WHATSAPP').toUpperCase() !== 'EMAIL') return false;

    // 3. Search Query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = conv.customer.displayName.toLowerCase().includes(q);
      const matchPhone = conv.customer.phone.toLowerCase().includes(q);
      const matchPreview = (conv.lastMessagePreview || '').toLowerCase().includes(q);
      return matchName || matchPhone || matchPreview;
    }

    return true;
  });

  const selectedConv = conversations?.find((c) => c.id === selectedConvId);

  // Helper for 24-hour Session Window Countdown
  const getSessionWindowData = (lastInboundStr: string | null) => {
    if (!lastInboundStr) return { text: 'No Window', msRemaining: 0, isClosed: true };
    const lastInbound = new Date(lastInboundStr).getTime();
    const expiry = lastInbound + 24 * 60 * 60 * 1000;
    const now = Date.now();
    const remaining = expiry - now;

    if (remaining <= 0) {
      return { text: '24h Expired', msRemaining: 0, isClosed: true };
    }

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const mins = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    return {
      text: `${hours}h ${mins}m left`,
      msRemaining: remaining,
      isClosed: false,
    };
  };

  const getRelativeTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 gap-3 font-sans text-slate-900">
      {/* TOP CHANNEL HUB SELECTOR BAR */}
      <div className="flex items-center justify-between bg-white border border-slate-200/80 rounded-2xl px-4 py-2.5 shadow-2xs shrink-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-2 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-indigo-600" />
            Filter Channel:
          </span>
          <button
            onClick={() => setSelectedChannel('ALL')}
            className={cn(
              'px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5',
              selectedChannel === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
            )}
          >
            All Channels
          </button>
          <button
            onClick={() => setSelectedChannel('WHATSAPP')}
            className={cn(
              'px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 border',
              selectedChannel === 'WHATSAPP'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                : 'bg-emerald-50/70 text-emerald-800 border-emerald-200 hover:bg-emerald-100/70'
            )}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            WhatsApp
          </button>
          <button
            onClick={() => setSelectedChannel('INSTAGRAM')}
            className={cn(
              'px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 border',
              selectedChannel === 'INSTAGRAM'
                ? 'bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 text-white border-transparent shadow-xs'
                : 'bg-purple-50/70 text-purple-900 border-purple-200 hover:bg-purple-100/70'
            )}
          >
            <span className="w-2 h-2 rounded-full bg-pink-500" />
            Instagram DMs
          </button>
          <button
            onClick={() => setSelectedChannel('IMESSAGE')}
            className={cn(
              'px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 border',
              selectedChannel === 'IMESSAGE'
                ? 'bg-[#007AFF] text-white border-[#007AFF] shadow-xs'
                : 'bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100'
            )}
          >
            <Smartphone className="w-3 h-3 text-[#007AFF]" />
            iMessage
          </button>
          <button
            onClick={() => setSelectedChannel('EMAIL')}
            className={cn(
              'px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 border',
              selectedChannel === 'EMAIL'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                : 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100'
            )}
          >
            <Mail className="w-3 h-3 text-indigo-600" />
            Two-Way Email
          </button>
        </div>

        <div className="text-[11px] text-slate-500 font-medium hidden sm:flex items-center gap-1.5">
          <span>Active Interface:</span>
          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-bold">
            {selectedConv 
              ? ((selectedConv as any).channel || 'WHATSAPP') 
              : selectedChannel === 'ALL' ? 'Auto-Detect' : selectedChannel}
          </span>
        </div>
      </div>

      <div className="flex-1 border border-slate-200/80 bg-white rounded-2xl overflow-hidden flex shadow-2xs min-h-0">
        {/* COLUMN 1: Conversation List */}
        <section className="w-[340px] flex flex-col border-r border-slate-200/80 bg-white shrink-0">
          {/* Search Header */}
          <div className="p-3.5 border-b border-slate-100 space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-indigo-600" />
                {selectedChannel === 'ALL' ? 'All Conversations' : `${selectedChannel.charAt(0) + selectedChannel.slice(1).toLowerCase()} Chats`}
              </h2>
              <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full border border-slate-200/60">
                {filteredConversations?.length || 0} active
              </span>
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search leads or messages..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-none focus:border-indigo-600 focus:bg-white text-xs transition"
              />
            </div>
          </div>

          {/* Sub Tab Filter Pills */}
          <div className="flex px-2 py-1 border-b border-slate-100 overflow-x-auto shrink-0 scrollbar-none gap-1 bg-slate-50/50">
            {(['ALL', 'UNREAD', 'AI', 'ESCALATED', 'CLOSED'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all whitespace-nowrap',
                  activeTab === tab
                    ? 'bg-white text-indigo-600 shadow-2xs font-bold border border-slate-200/60'
                    : 'text-slate-500 hover:text-slate-900'
                )}
              >
                {tab === 'AI' ? 'AI Bot' : tab === 'ESCALATED' ? 'Agent Needed' : tab.charAt(0) + tab.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Conversation List Stream */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
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
              <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center">
                <MessageSquare className="w-8 h-8 text-slate-300 mb-2 stroke-1" />
                No conversations in this filter.
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
                      'w-full p-3.5 text-left flex items-start gap-3 transition-all relative border-l-3',
                      isSelected
                        ? 'bg-indigo-50/60 border-indigo-600'
                        : 'hover:bg-slate-50/80 border-transparent text-slate-600'
                    )}
                  >
                    {/* Status Badges in corner */}
                    <div className="absolute top-3 right-3 flex items-center gap-1">
                      <span className={cn(
                        "px-1.5 py-0.2 text-[9px] rounded font-extrabold uppercase tracking-wider border",
                        (conv as any).channel === 'IMESSAGE'
                          ? "bg-sky-50 text-sky-800 border-sky-200"
                          : (conv as any).channel === 'INSTAGRAM'
                          ? "bg-purple-50 text-purple-900 border-purple-200"
                          : (conv as any).channel === 'EMAIL'
                          ? "bg-indigo-50 text-indigo-800 border-indigo-200"
                          : "bg-emerald-50 text-emerald-800 border-emerald-200"
                      )}>
                        {(conv as any).channel === 'IMESSAGE' ? 'iMessage' : (conv as any).channel === 'INSTAGRAM' ? 'Instagram' : (conv as any).channel === 'EMAIL' ? 'Email' : 'WhatsApp'}
                      </span>
                      {conv.needsEscalation && (
                        <span className="px-1.5 py-0.2 text-[9px] rounded font-bold uppercase bg-amber-50 text-amber-800 border border-amber-200">
                          Agent
                        </span>
                      )}
                    </div>

                    {/* Customer Initials Circle */}
                    <div className={cn(
                      "h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5",
                      isSelected
                        ? "bg-indigo-600 text-white shadow-2xs"
                        : "bg-slate-100 text-slate-700 border border-slate-200"
                    )}>
                      {initials}
                    </div>

                    <div className="min-w-0 flex-1 pr-10">
                      <span className={cn(
                        "font-bold text-xs truncate block",
                        isSelected ? "text-indigo-950 font-extrabold" : "text-slate-900"
                      )}>
                        {conv.customer.displayName}
                      </span>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {conv.lastMessagePreview || "No messages yet"}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-slate-400">
                        <span>+{conv.customer.phone}</span>
                        <span>•</span>
                        <span>{getRelativeTime(conv.lastMessageAt)}</span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* COLUMN 2: Chat Thread */}
        <section className="flex-1 flex flex-col bg-slate-50/20 min-w-0 overflow-hidden">
          {selectedConvId && selectedConv ? (
            (() => {
              const chan = ((selectedConv as any).channel || 'WHATSAPP').toUpperCase();

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
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/40">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-3 shadow-2xs">
                <MessageSquare className="w-6 h-6 stroke-1.5" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">No Chat Selected</h4>
              <p className="text-xs text-slate-500 max-w-xs mt-1 leading-relaxed">
                Select an active lead from the left pane to view their conversation history and reply in real time.
              </p>
            </div>
          )}
        </section>

        {/* COLUMN 3: Customer CRM Profile */}
        {selectedConvId && selectedConv?.customer && (
          <section className="w-72 border-l border-slate-200/80 bg-white flex flex-col shrink-0">
            {/* Avatar & Lead Details */}
            <div className="p-5 flex flex-col items-center text-center border-b border-slate-100">
              <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center font-bold text-lg mb-2 shadow-sm">
                {selectedConv.customer.displayName.substring(0, 2).toUpperCase()}
              </div>
              <h4 className="font-bold text-sm text-slate-900 leading-tight">
                {selectedConv.customer.displayName}
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                +{selectedConv.customer.phone}
              </p>
              <span className="inline-block mt-2.5 px-2.5 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold rounded-full uppercase tracking-wider">
                {selectedConv.customer.pipelineStage.replace('_', ' ').toLowerCase()}
              </span>
            </div>

            {/* Collapsible Intake Answers */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="space-y-2">
                <button
                  onClick={() => setIsIntakeExpanded(!isIntakeExpanded)}
                  className="w-full flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider"
                >
                  <span>Lead Intake Profile</span>
                  {isIntakeExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {isIntakeExpanded && (
                  <div className="bg-slate-50/70 border border-slate-200/70 rounded-xl p-3.5 space-y-3 text-xs">
                    {selectedConv.customer.intake ? (
                      <>
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Age</span>
                          <p className="font-semibold text-slate-900 mt-0.5">
                            {selectedConv.customer.intake.age || 'Not specified'} years
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">State Region</span>
                          <p className="font-semibold text-slate-900 mt-0.5">
                            {selectedConv.customer.intake.state || 'Not specified'}
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Monthly Budget</span>
                          <p className="font-semibold text-slate-900 mt-0.5">
                            {selectedConv.customer.intake.budgetMin && selectedConv.customer.intake.budgetMax
                              ? `$${selectedConv.customer.intake.budgetMin} - $${selectedConv.customer.intake.budgetMax} / mo`
                              : 'Not specified'}
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Family Size</span>
                          <p className="font-semibold text-slate-900 mt-0.5">
                            {selectedConv.customer.intake.familySize || '1'} member(s)
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Health Conditions</span>
                          <p className="font-semibold text-slate-900 mt-0.5 leading-relaxed">
                            {selectedConv.customer.intake.healthConditions || 'None specified'}
                          </p>
                        </div>
                      </>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic text-center py-2">
                        No intake parameters extracted yet.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Profile Action Link */}
            <div className="p-3.5 border-t border-slate-100">
              <Link
                href={`/dashboard/customers/${selectedConv.customer.id}`}
                className="flex items-center justify-center gap-1.5 w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition shadow-2xs"
              >
                View Full CRM Profile
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
