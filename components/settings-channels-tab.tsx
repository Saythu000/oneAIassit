'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Socket } from 'socket.io-client';
import { getClientSocket } from '@/lib/socket-client';
import { 
  Phone, 
  QrCode, 
  Smartphone, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  ShieldCheck, 
  Power,
  Sliders,
  Sparkles,
  Mail,
  Globe,
  Copy,
  Check,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

function InstagramIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

function FacebookIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function LinkedinIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
    </svg>
  );
}

type ConnectMethod = 'QR' | 'PHONE';
type EngineType = 'BAILEYS' | 'OPENWA';

interface SettingsChannelsTabProps {
  tenantId?: string;
}

interface WhatsAppStatus {
  status: string;
  phoneNumber?: string;
}

export default function SettingsChannelsTab({ tenantId }: SettingsChannelsTabProps) {
  const queryClient = useQueryClient();

  const [engine, setEngine] = useState<EngineType>('BAILEYS');
  const [connectMethod, setConnectMethod] = useState<ConnectMethod>('QR');
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [metaPhoneId, setMetaPhoneId] = useState('');
  const [metaWabaId, setMetaWabaId] = useState('');
  const [metaAccessToken, setMetaAccessToken] = useState('');
  const [metaVerifyToken, setMetaVerifyToken] = useState('oneai_meta_verify_secret_123');
  const [metaSaveSuccess, setMetaSaveSuccess] = useState(false);
  const [phoneAlias, setPhoneAlias] = useState('+1 (555) 019-2834 (Prime Marketing Main Line)');

  // Instagram Channel States
  const [igId, setIgId] = useState('');
  const [igUsername, setIgUsername] = useState('');
  const [igPageId, setIgPageId] = useState('');
  const [igAccessToken, setIgAccessToken] = useState('');
  const [igSaveSuccess, setIgSaveSuccess] = useState(false);
  const [igError, setIgError] = useState('');
  const [igTestFeedback, setIgTestFeedback] = useState<{ valid: boolean; account?: any; error?: string } | null>(null);
  const [showManualIg, setShowManualIg] = useState(false);

  // Facebook Channel States
  const [fbPageId, setFbPageId] = useState('');
  const [fbPageName, setFbPageName] = useState('');
  const [fbAccessToken, setFbAccessToken] = useState('');
  const [fbSaveSuccess, setFbSaveSuccess] = useState(false);
  const [fbError, setFbError] = useState('');
  const [fbTestFeedback, setFbTestFeedback] = useState<{ valid: boolean; page?: any; error?: string } | null>(null);
  const [showManualFb, setShowManualFb] = useState(false);

  // LinkedIn Channel States
  const [liAuthorUrn, setLiAuthorUrn] = useState('');
  const [liAccountName, setLiAccountName] = useState('');
  const [liAccessToken, setLiAccessToken] = useState('');
  const [liAuthorType, setLiAuthorType] = useState<'ORGANIZATION' | 'PERSON'>('ORGANIZATION');
  const [liSaveSuccess, setLiSaveSuccess] = useState(false);
  const [liError, setLiError] = useState('');
  const [liTestFeedback, setLiTestFeedback] = useState<{ valid: boolean; profile?: any; error?: string } | null>(null);
  const [showManualLi, setShowManualLi] = useState(false);

  // Email Channel States
  const [emailProvider, setEmailProvider] = useState<'RESEND' | 'SES' | 'SENDGRID' | 'SMTP'>('RESEND');
  const [emailApiKey, setEmailApiKey] = useState('');
  const [emailFromName, setEmailFromName] = useState('');
  const [emailFromEmail, setEmailFromEmail] = useState('');
  const [emailReplyTo, setEmailReplyTo] = useState('');
  const [emailDailyQuota, setEmailDailyQuota] = useState(1000);
  const [emailHourlyRate, setEmailHourlyRate] = useState(100);
  const [emailSaveSuccess, setEmailSaveSuccess] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [domainError, setDomainError] = useState('');
  const [expandedDomainId, setExpandedDomainId] = useState<string | null>(null);
  const [copiedValue, setCopiedValue] = useState<string | null>(null);

  // Email Queries & Mutations
  const { data: emailConfigData, refetch: refetchEmailConfig } = useQuery({
    queryKey: ['emailConfig', tenantId],
    queryFn: async () => {
      const res = await fetch('/api/settings/email/config');
      if (!res.ok) throw new Error('Failed to fetch email config');
      return res.json();
    },
    enabled: !!tenantId,
  });

  const { data: emailDomainsData = [], refetch: refetchEmailDomains } = useQuery({
    queryKey: ['emailDomains', tenantId],
    queryFn: async () => {
      const res = await fetch('/api/settings/email/domains');
      if (!res.ok) throw new Error('Failed to fetch domains');
      return res.json();
    },
    enabled: !!tenantId,
  });

  const { data: deliverabilityData, refetch: refetchDeliverability } = useQuery({
    queryKey: ['emailDeliverability', tenantId],
    queryFn: async () => {
      const res = await fetch('/api/channels/email/deliverability');
      if (!res.ok) throw new Error('Failed to fetch deliverability metrics');
      return res.json();
    },
    enabled: !!tenantId,
  });

  const resumeSendingMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/channels/email/deliverability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RESUME_SENDING' }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to resume sending');
      }
      return res.json();
    },
    onSuccess: () => {
      refetchDeliverability();
      refetchEmailConfig();
    },
  });

  useEffect(() => {
    if (emailConfigData) {
      if (emailConfigData.provider) setEmailProvider(emailConfigData.provider);
      if (emailConfigData.apiKeyMasked) setEmailApiKey(emailConfigData.apiKeyMasked);
      if (emailConfigData.fromName) setEmailFromName(emailConfigData.fromName);
      if (emailConfigData.fromEmail) setEmailFromEmail(emailConfigData.fromEmail);
      if (emailConfigData.replyToEmail) setEmailReplyTo(emailConfigData.replyToEmail);
      if (emailConfigData.dailySendQuota) setEmailDailyQuota(emailConfigData.dailySendQuota);
      if (emailConfigData.hourlySendRate) setEmailHourlyRate(emailConfigData.hourlySendRate);
    }
  }, [emailConfigData]);

  const saveEmailMutation = useMutation({
    mutationFn: async () => {
      setEmailError('');
      setEmailSaveSuccess(false);
      const res = await fetch('/api/settings/email/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: emailProvider,
          apiKey: emailApiKey,
          fromName: emailFromName,
          fromEmail: emailFromEmail,
          replyToEmail: emailReplyTo,
          dailySendQuota: emailDailyQuota,
          hourlySendRate: emailHourlyRate,
        }),
      });
      if (!res.ok) {
        let errMsg = 'Failed to save email settings';
        try {
          const err = await res.json();
          errMsg = err.error || errMsg;
        } catch {
          errMsg = `Server responded with ${res.status}: ${res.statusText || 'Error'}`;
        }
        throw new Error(errMsg);
      }
      return res.json();
    },
    onSuccess: () => {
      setEmailSaveSuccess(true);
      refetchEmailConfig();
      setTimeout(() => setEmailSaveSuccess(false), 5000);
    },
    onError: (err: any) => {
      setEmailError(err.message);
    },
  });

  const addDomainMutation = useMutation({
    mutationFn: async () => {
      setDomainError('');
      const res = await fetch('/api/settings/email/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: newDomain }),
      });
      if (!res.ok) {
        let errMsg = 'Failed to register domain';
        try {
          const err = await res.json();
          errMsg = err.error || errMsg;
        } catch {
          errMsg = `Server responded with ${res.status}: ${res.statusText || 'Error'}`;
        }
        throw new Error(errMsg);
      }
      return res.json();
    },
    onSuccess: () => {
      setNewDomain('');
      refetchEmailDomains();
    },
    onError: (err: any) => {
      setDomainError(err.message);
    },
  });

  const verifyDomainMutation = useMutation({
    mutationFn: async (domain: string) => {
      const res = await fetch('/api/settings/email/domains/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
      });
      if (!res.ok) {
        let errMsg = 'Verification failed';
        try {
          const err = await res.json();
          errMsg = err.error || errMsg;
        } catch {
          errMsg = `Server responded with ${res.status}: ${res.statusText || 'Error'}`;
        }
        throw new Error(errMsg);
      }
      return res.json();
    },
    onSuccess: () => {
      refetchEmailDomains();
    },
  });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedValue(text);
    setTimeout(() => setCopiedValue(null), 2000);
  };

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // Fetch Meta Cloud config on mount
  useEffect(() => {
    if (tenantId) {
      fetch('/api/whatsapp/meta-config')
        .then((res) => res.json())
        .then((data) => {
          if (data.provider === 'META_CLOUD_API') {
            setEngine('META_CLOUD_API' as any);
          }
          if (data.metaPhoneNumberId) setMetaPhoneId(data.metaPhoneNumberId);
          if (data.metaWabaId) setMetaWabaId(data.metaWabaId);
          if (data.metaAccessToken) setMetaAccessToken(data.metaAccessToken);
          if (data.metaVerifyToken) setMetaVerifyToken(data.metaVerifyToken);
        })
        .catch(() => {});
    }
  }, [tenantId]);

  // Mutation to save Meta Cloud credentials
  const saveMetaMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/whatsapp/meta-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'META_CLOUD_API',
          metaPhoneNumberId: metaPhoneId,
          metaWabaId,
          metaAccessToken,
          metaVerifyToken,
        }),
      });
      if (!res.ok) throw new Error('Failed to save Meta credentials');
      return res.json();
    },
    onSuccess: () => {
      setMetaSaveSuccess(true);
      refetchStatus();
      queryClient.invalidateQueries({ queryKey: ['whatsappStatus', tenantId] });
      setTimeout(() => setMetaSaveSuccess(false), 4000);
    },
  });

  // Fetch current WhatsApp status from database
  const { data: waStatus, refetch: refetchStatus } = useQuery<WhatsAppStatus>({
    queryKey: ['whatsappStatus', tenantId],
    queryFn: async () => {
      if (!tenantId) throw new Error('No tenantId');
      const res = await fetch(`/api/whatsapp/status?tenantId=${encodeURIComponent(tenantId)}`);
      return res.json();
    },
    enabled: !!tenantId,
    refetchInterval: 10000,
  });

  // Fetch Instagram Channel status
  const { data: igStatus, refetch: refetchIgStatus } = useQuery<{
    connected: boolean;
    instagramId?: string;
    username?: string;
    pageId?: string;
    status: string;
  }>({
    queryKey: ['instagramStatus', tenantId],
    queryFn: async () => {
      const res = await fetch('/api/channels/instagram');
      return res.json();
    },
    enabled: !!tenantId,
  });

  useEffect(() => {
    if (igStatus?.connected) {
      if (igStatus.instagramId) setIgId(igStatus.instagramId);
      if (igStatus.username) setIgUsername(igStatus.username);
      if (igStatus.pageId) setIgPageId(igStatus.pageId);
    }
  }, [igStatus]);

  const saveIgMutation = useMutation({
    mutationFn: async () => {
      setIgError('');
      const res = await fetch('/api/channels/instagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instagramId: igId,
          username: igUsername,
          pageId: igPageId,
          pageAccessToken: igAccessToken,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save Instagram account');
      return data;
    },
    onSuccess: () => {
      setIgSaveSuccess(true);
      refetchIgStatus();
      queryClient.invalidateQueries({ queryKey: ['instagramStatus', tenantId] });
      setTimeout(() => setIgSaveSuccess(false), 4000);
    },
    onError: (err: any) => {
      setIgError(err.message || 'Error saving Instagram credentials');
    },
  });

  const testIgMutation = useMutation({
    mutationFn: async () => {
      setIgTestFeedback(null);
      setIgError('');
      const res = await fetch('/api/channels/instagram/verify');
      const data = await res.json();
      return data;
    },
    onSuccess: (data) => {
      setIgTestFeedback(data);
    },
    onError: (err: any) => {
      setIgTestFeedback({ valid: false, error: err.message || 'Verification failed' });
    },
  });

  const disconnectIgMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/channels/instagram', { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to disconnect Instagram');
      return res.json();
    },
    onSuccess: () => {
      refetchIgStatus();
      setIgId('');
      setIgUsername('');
      setIgPageId('');
      setIgAccessToken('');
      queryClient.invalidateQueries({ queryKey: ['instagramStatus', tenantId] });
    },
  });

  // Facebook Queries & Mutations
  const { data: fbStatus, refetch: refetchFbStatus } = useQuery<{
    connected: boolean;
    pageId?: string;
    pageName?: string;
    status: string;
    inheritedFromInstagram?: boolean;
  }>({
    queryKey: ['facebookStatus', tenantId],
    queryFn: async () => {
      const res = await fetch('/api/channels/facebook');
      return res.json();
    },
    enabled: !!tenantId,
  });

  useEffect(() => {
    if (fbStatus?.connected) {
      if (fbStatus.pageId) setFbPageId(fbStatus.pageId);
      if (fbStatus.pageName) setFbPageName(fbStatus.pageName);
    }
  }, [fbStatus]);

  const handleFacebookOAuthLogin = () => {
    setFbError('');
    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    window.open(
      '/api/auth/facebook',
      'MetaAuthPopup',
      `width=${width},height=${height},top=${top},left=${left}`
    );
  };

  const handleInstagramOAuthLogin = () => {
    setIgError('');
    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    window.open(
      '/api/auth/instagram',
      'InstagramAuthPopup',
      `width=${width},height=${height},top=${top},left=${left}`
    );
  };

  const handleLinkedInOAuthLogin = () => {
    setLiError('');
    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    window.open(
      '/api/auth/linkedin',
      'LinkedInAuthPopup',
      `width=${width},height=${height},top=${top},left=${left}`
    );
  };


  const saveFbMutation = useMutation({
    mutationFn: async () => {
      setFbError('');
      const res = await fetch('/api/channels/facebook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId: fbPageId,
          pageName: fbPageName,
          pageAccessToken: fbAccessToken,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save Facebook credentials');
      return data;
    },
    onSuccess: () => {
      setFbSaveSuccess(true);
      refetchFbStatus();
      queryClient.invalidateQueries({ queryKey: ['facebookStatus', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['marketing-integrations'] });
      setTimeout(() => setFbSaveSuccess(false), 4000);
    },
    onError: (err: any) => {
      setFbError(err.message || 'Error saving Facebook credentials');
    },
  });

  const testFbMutation = useMutation({
    mutationFn: async () => {
      setFbTestFeedback(null);
      setFbError('');
      const res = await fetch('/api/channels/facebook/verify');
      const data = await res.json();
      return data;
    },
    onSuccess: (data) => {
      setFbTestFeedback(data);
    },
    onError: (err: any) => {
      setFbTestFeedback({ valid: false, error: err.message || 'Verification failed' });
    },
  });

  const disconnectFbMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/channels/facebook', { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to disconnect Facebook');
      return res.json();
    },
    onSuccess: () => {
      refetchFbStatus();
      setFbPageId('');
      setFbPageName('');
      setFbAccessToken('');
      queryClient.invalidateQueries({ queryKey: ['facebookStatus', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['marketing-integrations'] });
    },
  });

  // LinkedIn Queries & Mutations
  const { data: liStatus, refetch: refetchLiStatus } = useQuery<{
    connected: boolean;
    authorUrn?: string;
    accountName?: string;
    authorType?: 'ORGANIZATION' | 'PERSON';
    status: string;
  }>({
    queryKey: ['linkedinStatus', tenantId],
    queryFn: async () => {
      const res = await fetch('/api/channels/linkedin');
      return res.json();
    },
    enabled: !!tenantId,
  });

  useEffect(() => {
    if (liStatus?.connected) {
      if (liStatus.authorUrn) setLiAuthorUrn(liStatus.authorUrn);
      if (liStatus.accountName) setLiAccountName(liStatus.accountName);
      if (liStatus.authorType) setLiAuthorType(liStatus.authorType);
    }
  }, [liStatus]);

  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      if (event.data?.type === 'META_AUTH_SUCCESS') {
        setFbSaveSuccess(true);
        if (event.data.hasInstagram) {
          setIgSaveSuccess(true);
          setTimeout(() => setIgSaveSuccess(false), 5000);
        }
        refetchFbStatus();
        refetchIgStatus();
        queryClient.invalidateQueries({ queryKey: ['facebookStatus', tenantId] });
        queryClient.invalidateQueries({ queryKey: ['instagramStatus', tenantId] });
        queryClient.invalidateQueries({ queryKey: ['marketing-integrations'] });
        setTimeout(() => setFbSaveSuccess(false), 5000);
      } else if (event.data?.type === 'META_AUTH_ERROR') {
        setFbError(event.data.error || 'Meta authentication was cancelled or failed.');
        setIgError(event.data.error || 'Meta authentication was cancelled or failed.');
      } else if (event.data?.type === 'LINKEDIN_AUTH_SUCCESS') {
        setLiSaveSuccess(true);
        if (event.data.authorUrn) setLiAuthorUrn(event.data.authorUrn);
        refetchLiStatus();
        queryClient.invalidateQueries({ queryKey: ['linkedinStatus', tenantId] });
        queryClient.invalidateQueries({ queryKey: ['marketing-integrations'] });
        setTimeout(() => setLiSaveSuccess(false), 5000);
      } else if (event.data?.type === 'LINKEDIN_AUTH_ERROR') {
        setLiError(event.data.error || 'LinkedIn authentication was cancelled or failed.');
      }
    };

    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, [tenantId, refetchFbStatus, refetchIgStatus, refetchLiStatus, queryClient]);

  const saveLiMutation = useMutation({
    mutationFn: async () => {
      setLiError('');
      const res = await fetch('/api/channels/linkedin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorUrn: liAuthorUrn,
          accountName: liAccountName,
          accessToken: liAccessToken,
          authorType: liAuthorType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save LinkedIn credentials');
      return data;
    },
    onSuccess: () => {
      setLiSaveSuccess(true);
      refetchLiStatus();
      queryClient.invalidateQueries({ queryKey: ['linkedinStatus', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['marketing-integrations'] });
      setTimeout(() => setLiSaveSuccess(false), 4000);
    },
    onError: (err: any) => {
      setLiError(err.message || 'Error saving LinkedIn credentials');
    },
  });

  const testLiMutation = useMutation({
    mutationFn: async () => {
      setLiTestFeedback(null);
      setLiError('');
      const res = await fetch('/api/channels/linkedin/verify');
      const data = await res.json();
      return data;
    },
    onSuccess: (data) => {
      setLiTestFeedback(data);
    },
    onError: (err: any) => {
      setLiTestFeedback({ valid: false, error: err.message || 'Verification failed' });
    },
  });

  const disconnectLiMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/channels/linkedin', { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to disconnect LinkedIn');
      return res.json();
    },
    onSuccess: () => {
      refetchLiStatus();
      setLiAuthorUrn('');
      setLiAccountName('');
      setLiAccessToken('');
      queryClient.invalidateQueries({ queryKey: ['linkedinStatus', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['marketing-integrations'] });
    },
  });

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Poll engine for QR code every 2s after initiating
  const startQrPolling = useCallback((tid: string) => {
    stopPolling();
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      if (attempts > 25) {
        stopPolling();
        setConnecting(false);
        setStatusMsg('Timed out waiting for QR code. Please try again.');
        return;
      }
      try {
        const res = await fetch('/api/whatsapp/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId: tid, engine, method: 'QR' }),
        });
        const data = await res.json();
        if (data.qr) {
          setQrCode(data.qr);
          setConnecting(false);
          setStatusMsg('');
          stopPolling();
        }
      } catch {
        // Engine preparing...
      }
    }, 2000);
  }, [engine, stopPolling]);

  // Setup Socket.io listener
  useEffect(() => {
    if (!tenantId) return;

    const socket = getClientSocket(tenantId);
    socketRef.current = socket;

    socket.on('whatsapp_qr', (data: { qr: string }) => {
      setQrCode(data.qr);
      setPairingCode(null);
      setConnecting(false);
      setStatusMsg('');
      stopPolling();
    });

    socket.on('whatsapp_pairing_code', (data: { pairingCode: string }) => {
      setPairingCode(data.pairingCode);
      setQrCode(null);
      setConnecting(false);
      setStatusMsg('');
      stopPolling();
    });

    socket.on('whatsapp_status', (data: { status: string; phoneNumber?: string }) => {
      if (data.status === 'CONNECTED') {
        setQrCode(null);
        setPairingCode(null);
        setConnecting(false);
        stopPolling();
        queryClient.setQueryData<WhatsAppStatus>(['whatsappStatus', tenantId], () => ({
          status: 'CONNECTED',
          phoneNumber: data.phoneNumber,
        }));
        refetchStatus();
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      stopPolling();
    };
  }, [tenantId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Disconnect Mutation
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/whatsapp/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      });
      if (!res.ok) throw new Error('Failed to disconnect');
      return res.json();
    },
    onSuccess: () => {
      setQrCode(null);
      setPairingCode(null);
      stopPolling();
      queryClient.setQueryData<WhatsAppStatus>(['whatsappStatus', tenantId], () => ({ status: 'DISCONNECTED' }));
    },
  });

  const handleConnect = async () => {
    if (!tenantId) return;

    if (connectMethod === 'PHONE') {
      const clean = phoneInput.replace(/[^0-9]/g, '');
      if (clean.length < 7) {
        setPhoneError('Enter valid phone number with country code (e.g. 15550192834)');
        return;
      }
      setPhoneError('');
      setConnecting(true);
      setStatusMsg('Requesting pairing code from WhatsApp engine...');
      try {
        const res = await fetch('/api/whatsapp/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId, engine, method: 'PHONE', phoneNumber: clean }),
        });
        const data = await res.json();
        if (data.pairingCode) {
          setPairingCode(data.pairingCode);
          setConnecting(false);
          setStatusMsg('');
        }
      } catch {
        setConnecting(false);
        setStatusMsg('Engine offline. Please ensure whatsapp-engine service is running.');
      }
      return;
    }

    // QR method
    setConnecting(true);
    setQrCode(null);
    setStatusMsg('Initializing WhatsApp connection engine...');
    try {
      await fetch('/api/whatsapp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, engine, method: 'QR' }),
      });
      startQrPolling(tenantId);
    } catch {
      setConnecting(false);
      setStatusMsg('Failed to connect to engine.');
    }
  };

  const isConnected = waStatus?.status === 'CONNECTED';

  return (
    <div className="space-y-6">
      {/* Top Banner Status */}
      <div className="bg-white border border-[#c3c6d7] rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-2xl ${isConnected ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-amber-50 text-amber-600 border border-amber-200'}`}>
            <Phone className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-[#1c1b1f]">WhatsApp Business API Channel</h3>
              <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${isConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                {isConnected ? '● CONNECTED' : '○ DISCONNECTED'}
              </span>
            </div>
            <p className="text-xs text-[#49454f] mt-1">
              {isConnected
                ? `Active WhatsApp line: ${waStatus?.phoneNumber || '+1 (555) 019-2834'} • Quality Tier 1 (1,000 msgs/24h)`
                : 'Connect your agency WhatsApp phone number to enable automated sales AI auto-replies.'}
            </p>
          </div>
        </div>

        {isConnected ? (
          <button
            type="button"
            onClick={() => disconnectMutation.mutate()}
            disabled={disconnectMutation.isPending}
            className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 shadow-sm flex items-center gap-2 transition shrink-0"
          >
            <Power className="w-4 h-4" />
            {disconnectMutation.isPending ? 'Disconnecting...' : 'Disconnect Line'}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleConnect}
            disabled={connecting}
            className="px-6 py-2.5 bg-[#004ac6] hover:bg-[#003da3] text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2 transition shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${connecting ? 'animate-spin' : ''}`} />
            {connecting ? 'Initializing...' : 'Connect WhatsApp'}
          </button>
        )}
      </div>

      {/* Engine Selection & Connection Controls Card */}
      {!isConnected && (
        <div className="bg-white border border-[#c3c6d7] rounded-2xl p-6 shadow-sm space-y-6">
          <h4 className="text-sm font-bold text-[#1B4B91] flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#004ac6]" />
            Engine Selector & Connection Options
          </h4>

          {/* Provider Engine Choice */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
              type="button"
              onClick={() => setEngine('BAILEYS')}
              className={`p-4 rounded-xl border text-left transition ${
                engine === 'BAILEYS'
                  ? 'border-[#004ac6] bg-blue-50/50 ring-2 ring-[#004ac6]/20'
                  : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-[#1c1b1f]">Baileys (WebSockets)</span>
                <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">QR Web</span>
              </div>
              <p className="text-[11px] text-[#49454f]">High performance, lightweight socket engine. Fast QR pair.</p>
            </button>

            <button
              type="button"
              onClick={() => setEngine('OPENWA')}
              className={`p-4 rounded-xl border text-left transition ${
                engine === 'OPENWA'
                  ? 'border-[#004ac6] bg-blue-50/50 ring-2 ring-[#004ac6]/20'
                  : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-[#1c1b1f]">OpenWA (Chromium)</span>
                <span className="text-[10px] font-bold text-gray-600 bg-gray-200 px-2 py-0.5 rounded-full">Headless</span>
              </div>
              <p className="text-[11px] text-[#49454f]">Headless Chromium session with full web browser features.</p>
            </button>

            <button
              type="button"
              onClick={() => setEngine('META_CLOUD_API' as any)}
              className={`p-4 rounded-xl border text-left transition ${
                (engine as any) === 'META_CLOUD_API'
                  ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-600/20'
                  : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-[#1c1b1f]">Meta Cloud API</span>
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">Official API</span>
              </div>
              <p className="text-[11px] text-[#49454f]">Official Meta Graph REST API (WhatsApp Business Account).</p>
            </button>
          </div>

          {/* Meta Cloud API Form Container */}
          {(engine as any) === 'META_CLOUD_API' ? (
            <div className="space-y-4 p-5 bg-emerald-50/50 rounded-xl border border-emerald-200">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Meta WhatsApp Business Cloud API Credentials
                </h5>
                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">
                  Graph API v21.0
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">
                    Meta Phone Number ID <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 109876543210987"
                    value={metaPhoneId}
                    onChange={(e) => setMetaPhoneId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">
                    WhatsApp Business Account ID (WABA ID)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 987654321098765"
                    value={metaWabaId}
                    onChange={(e) => setMetaWabaId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">
                  Permanent System User Access Token <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  placeholder="EAAG..."
                  value={metaAccessToken}
                  onChange={(e) => setMetaAccessToken(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-mono outline-none focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">
                    Webhook Verification Token <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={metaVerifyToken}
                    onChange={(e) => setMetaVerifyToken(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-mono outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">
                    Webhook Callback URL (Meta App Dashboard)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value="https://oneai.drgodly.com/api/webhook/meta"
                      className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-xs font-mono text-slate-700"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => saveMetaMutation.mutate()}
                  disabled={saveMetaMutation.isPending || !metaPhoneId || !metaAccessToken}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md disabled:opacity-50 transition flex items-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  {saveMetaMutation.isPending ? 'Saving & Testing...' : 'Save & Connect Meta Cloud Line'}
                </button>

                {metaSaveSuccess && (
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-300 flex items-center gap-1.5 animate-fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Meta Credentials Saved & Line Connected!
                  </span>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Connect Method Toggles */}
              <div className="flex items-center gap-4 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => setConnectMethod('QR')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
                    connectMethod === 'QR' ? 'bg-[#1B4B91] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <QrCode className="w-4 h-4" />
                  QR Code Scanner
                </button>

                <button
                  type="button"
                  onClick={() => setConnectMethod('PHONE')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
                    connectMethod === 'PHONE' ? 'bg-[#1B4B91] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  8-Digit Phone Pairing Code
                </button>
              </div>

              {/* QR Code Container */}
              {connectMethod === 'QR' && qrCode && (
                <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 flex flex-col items-center justify-center space-y-3">
                  <p className="text-xs font-bold text-[#1c1b1f]">Scan QR Code with WhatsApp on your phone:</p>
                  <div className="p-3 bg-white rounded-xl shadow-inner border border-gray-200">
                    <img src={qrCode} alt="WhatsApp QR Code" className="w-52 h-52 object-contain" />
                  </div>
                  <p className="text-[11px] text-gray-500">Open WhatsApp &gt; Linked Devices &gt; Link a Device</p>
                </div>
              )}

              {/* Pairing Code Container */}
              {connectMethod === 'PHONE' && (
                <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <label className="block text-xs font-bold text-gray-700">Enter WhatsApp Phone Number with Country Code:</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. 15550192834"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs outline-none focus:border-[#004ac6]"
                    />
                    <button
                      type="button"
                      onClick={handleConnect}
                      disabled={connecting}
                      className="px-4 py-2 bg-[#004ac6] hover:bg-[#003da3] text-white text-xs font-bold rounded-lg transition"
                    >
                      Get Pairing Code
                    </button>
                  </div>
                  {phoneError && <p className="text-xs text-rose-600 font-semibold">{phoneError}</p>}
                  {pairingCode && (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-center space-y-1">
                      <p className="text-xs text-emerald-800 font-medium">Enter this pairing code in WhatsApp:</p>
                      <p className="text-2xl font-mono font-extrabold text-emerald-900 tracking-widest">{pairingCode}</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {statusMsg && <p className="text-xs text-blue-800 font-semibold bg-blue-50 p-3 rounded-lg border border-blue-200">{statusMsg}</p>}
        </div>
      )}

      {/* Instagram Direct Messaging Gateway Card */}
      <div className="bg-white border border-[#c3c6d7] rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center text-white shadow-sm">
              <InstagramIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-base font-bold text-[#1c1b1f]">Instagram Direct Messages</h4>
                {igStatus?.connected ? (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Connected {igStatus.username ? `(@${igStatus.username})` : ''}
                  </span>
                ) : (
                  <span className="text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">
                    Not Connected
                  </span>
                )}
              </div>
              <p className="text-xs text-[#49454f] mt-0.5">
                Connect your Instagram Professional / Creator account to let the AI Agent reply to incoming DMs automatically.
              </p>
            </div>
          </div>
          {igStatus?.connected && (
            <button
              type="button"
              onClick={() => disconnectIgMutation.mutate()}
              disabled={disconnectIgMutation.isPending}
              className="text-xs font-bold text-rose-600 hover:text-rose-700 border border-rose-200 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition"
            >
              {disconnectIgMutation.isPending ? 'Disconnecting...' : 'Disconnect'}
            </button>
          )}
        </div>

        {/* 1-Click Instagram OAuth 2.0 Connection Banner */}
        <div className="bg-gradient-to-r from-pink-50/90 via-purple-50/90 to-amber-50/90 border border-pink-200/90 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
          <div className="space-y-0.5 text-center sm:text-left">
            <h5 className="text-xs font-bold text-purple-950 flex items-center justify-center sm:justify-start gap-1.5">
              <Sparkles className="w-4 h-4 text-pink-600" />
              Recommended: 1-Click Instagram OAuth 2.0 Login
            </h5>
            <p className="text-[11px] text-purple-900 leading-relaxed">
              Login securely via Meta, approve on your phone, and OneAIAssist automatically acquires your Instagram Business Account ID and Page Token. Zero manual keys required.
            </p>
          </div>
          <button
            type="button"
            onClick={handleInstagramOAuthLogin}
            className="px-5 py-2.5 bg-gradient-to-r from-pink-500 via-rose-500 to-purple-600 hover:opacity-95 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-2 whitespace-nowrap active:scale-95"
          >
            <InstagramIcon className="w-4 h-4 text-white" />
            <span>Connect with Instagram</span>
          </button>
        </div>

        {/* Feedback Messages */}
        {igError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{igError}</span>
          </div>
        )}
        {igSaveSuccess && (
          <p className="text-xs text-emerald-700 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200 font-bold">
            ✓ Instagram Professional Account successfully connected! AI DM Gateway and Reels Publishing are active.
          </p>
        )}

        {/* Collapsible Manual Credentials Form */}
        <div className="border-t border-gray-100 pt-3">
          <button
            type="button"
            onClick={() => setShowManualIg(!showManualIg)}
            className="text-xs font-bold text-gray-600 hover:text-gray-900 flex items-center justify-between w-full py-1 transition"
          >
            <span className="flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-gray-500" />
              Advanced: Enter Instagram Account ID & Token Manually
            </span>
            <span className="text-[11px] text-[#004ac6] font-semibold">
              {showManualIg ? 'Hide Manual Options ▲' : 'Show Manual Options ▼'}
            </span>
          </button>

          {showManualIg && (
            <div className="space-y-4 pt-3 mt-2 border-t border-gray-100">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Instagram Business Account ID <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={igId}
                    onChange={(e) => setIgId(e.target.value)}
                    placeholder="e.g. 17841400000000000"
                    className="w-full px-3 py-2 bg-slate-50 border border-gray-300 rounded-lg text-xs outline-none focus:border-[#004ac6] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Instagram Handle / Username
                  </label>
                  <input
                    type="text"
                    value={igUsername}
                    onChange={(e) => setIgUsername(e.target.value)}
                    placeholder="e.g. @your_agency_official"
                    className="w-full px-3 py-2 bg-slate-50 border border-gray-300 rounded-lg text-xs outline-none focus:border-[#004ac6] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Connected Facebook Page ID
                  </label>
                  <input
                    type="text"
                    value={igPageId}
                    onChange={(e) => setIgPageId(e.target.value)}
                    placeholder="e.g. 102938475610293"
                    className="w-full px-3 py-2 bg-slate-50 border border-gray-300 rounded-lg text-xs outline-none focus:border-[#004ac6] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Page Access Token (Encrypted AES-256) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={igAccessToken}
                    onChange={(e) => setIgAccessToken(e.target.value)}
                    placeholder={igStatus?.connected ? "••••••••••••••••••••••••" : "EAAB..."}
                    className="w-full px-3 py-2 bg-slate-50 border border-gray-300 rounded-lg text-xs outline-none focus:border-[#004ac6] focus:bg-white"
                  />
                </div>
              </div>

              <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 text-[11px] text-amber-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
                  Meta Platform Policy & In-App Requirement:
                </p>
                <p>
                  1. Inside your Instagram mobile app: <strong>Settings & Privacy ➔ Messages & Story Replies ➔ Message Controls ➔ Connected Tools ➔ Toggle ON &quot;Allow Access to Messages&quot;</strong>.
                </p>
                <p>
                  2. Outbound AI responses are strictly permitted within <strong>24 hours</strong> of the customer&apos;s last DM.
                </p>
              </div>

              {/* Meta Graph API Test Feedback */}
              {igTestFeedback && (
                <div className={`p-3 rounded-xl border text-xs font-semibold ${
                  igTestFeedback.valid
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}>
                  {igTestFeedback.valid ? (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        Meta Connection Verified! Account: <strong>@{igTestFeedback.account?.username}</strong> ({igTestFeedback.account?.name || 'Verified'}) • Permissions Active for Reels & Publishing
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span>Meta API Error: {igTestFeedback.error}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => testIgMutation.mutate()}
                  disabled={testIgMutation.isPending || (!igStatus?.connected && !igId)}
                  className="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testIgMutation.isPending ? 'animate-spin' : ''}`} />
                  {testIgMutation.isPending ? 'Verifying with Meta...' : 'Test Meta Connection'}
                </button>

                <button
                  type="button"
                  onClick={() => saveIgMutation.mutate()}
                  disabled={saveIgMutation.isPending || !igId || (!igAccessToken && !igStatus?.connected)}
                  className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-rose-600 hover:from-purple-700 hover:to-rose-700 text-white font-bold text-xs rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {saveIgMutation.isPending ? 'Connecting...' : 'Save & Connect Instagram'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Facebook Page Integration Card */}
      <div className="bg-white border border-[#c3c6d7] rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#1877F2]">
              <FacebookIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-base font-bold text-[#1c1b1f]">Facebook Page Integration</h4>
                {fbStatus?.connected ? (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Connected {fbStatus.pageName ? `(${fbStatus.pageName})` : ''}
                    {fbStatus.inheritedFromInstagram && ' • Via Instagram'}
                  </span>
                ) : (
                  <span className="text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">
                    Not Connected
                  </span>
                )}
              </div>
              <p className="text-xs text-[#49454f] mt-0.5">
                Publish feed posts, healthcare announcements, photos, and video campaigns directly to your official Facebook Page.
              </p>
            </div>
          </div>
          {fbStatus?.connected && !fbStatus.inheritedFromInstagram && (
            <button
              type="button"
              onClick={() => disconnectFbMutation.mutate()}
              disabled={disconnectFbMutation.isPending}
              className="text-xs font-bold text-rose-600 hover:text-rose-700 border border-rose-200 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition"
            >
              {disconnectFbMutation.isPending ? 'Disconnecting...' : 'Disconnect'}
            </button>
          )}
        </div>

        {/* 1-Click OAuth 2.0 Connection Banner */}
        <div className="bg-gradient-to-r from-blue-50/90 to-indigo-50/90 border border-blue-200/90 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
          <div className="space-y-0.5 text-center sm:text-left">
            <h5 className="text-xs font-bold text-blue-950 flex items-center justify-center sm:justify-start gap-1.5">
              <Sparkles className="w-4 h-4 text-blue-600" />
              Recommended: 1-Click Facebook OAuth 2.0 Login
            </h5>
            <p className="text-[11px] text-blue-800 leading-relaxed">
              Login securely on Facebook, approve on your phone via 2FA, and OneAIAssist automatically acquires a never-expiring Page token. Zero password sharing required.
            </p>
          </div>
          <button
            type="button"
            onClick={handleFacebookOAuthLogin}
            className="px-5 py-2.5 bg-[#1877F2] hover:bg-[#166fe5] text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-2 whitespace-nowrap active:scale-95"
          >
            <FacebookIcon className="w-4 h-4 text-white" />
            <span>Connect with Facebook</span>
          </button>
        </div>

        {/* Feedback Messages */}
        {fbError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{fbError}</span>
          </div>
        )}
        {fbSaveSuccess && (
          <p className="text-xs text-emerald-700 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200 font-bold">
            ✓ Facebook Page successfully connected and encrypted! Publishing pipeline is active.
          </p>
        )}

        {/* Collapsible Manual Credentials Form */}
        <div className="border-t border-gray-100 pt-3">
          <button
            type="button"
            onClick={() => setShowManualFb(!showManualFb)}
            className="text-xs font-bold text-gray-600 hover:text-gray-900 flex items-center justify-between w-full py-1 transition"
          >
            <span className="flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-gray-500" />
              Advanced: Enter Page ID & Access Token Manually
            </span>
            <span className="text-[11px] text-[#004ac6] font-semibold">
              {showManualFb ? 'Hide Manual Options ▲' : 'Show Manual Options ▼'}
            </span>
          </button>

          {showManualFb && (
            <div className="space-y-4 pt-3 mt-2 border-t border-gray-100">
              {igPageId && !fbPageId && (
                <div className="flex items-center justify-between p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs text-blue-900">
                  <span>Detected Facebook Page ID linked to your Instagram: <strong>{igPageId}</strong></span>
                  <button
                    type="button"
                    onClick={() => {
                      setFbPageId(igPageId);
                      if (igAccessToken) setFbAccessToken(igAccessToken);
                      if (igUsername) setFbPageName(`${igUsername} Page`);
                    }}
                    className="px-3 py-1 bg-white hover:bg-blue-50 border border-blue-300 font-bold text-[11px] rounded-lg transition"
                  >
                    Auto-Fill from Instagram
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Facebook Page ID <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={fbPageId}
                    onChange={(e) => setFbPageId(e.target.value)}
                    placeholder="e.g. 102938475610293"
                    className="w-full px-3 py-2 bg-slate-50 border border-gray-300 rounded-lg text-xs outline-none focus:border-[#004ac6] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Facebook Page Name / Brand
                  </label>
                  <input
                    type="text"
                    value={fbPageName}
                    onChange={(e) => setFbPageName(e.target.value)}
                    placeholder="e.g. Prime Health Experts Official"
                    className="w-full px-3 py-2 bg-slate-50 border border-gray-300 rounded-lg text-xs outline-none focus:border-[#004ac6] focus:bg-white"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Page Access Token (Encrypted AES-256) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={fbAccessToken}
                    onChange={(e) => setFbAccessToken(e.target.value)}
                    placeholder={fbStatus?.connected ? "••••••••••••••••••••••••" : "EAAB..."}
                    className="w-full px-3 py-2 bg-slate-50 border border-gray-300 rounded-lg text-xs outline-none focus:border-[#004ac6] focus:bg-white"
                  />
                </div>
              </div>

              <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3 text-[11px] text-blue-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-700" />
                  Meta App Scopes & Token Requirements:
                </p>
                <p>
                  Requires <strong>pages_manage_posts</strong> and <strong>pages_read_engagement</strong> permissions. Generate a permanent Page Access Token from Meta Business Suite / Graph API Explorer for automated campaign distribution.
                </p>
              </div>

              {/* Meta Graph API Test Feedback */}
              {fbTestFeedback && (
                <div className={`p-3 rounded-xl border text-xs font-semibold ${
                  fbTestFeedback.valid
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}>
                  {fbTestFeedback.valid ? (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        Meta Connection Verified! Page: <strong>{fbTestFeedback.page?.name}</strong> (Category: {fbTestFeedback.page?.category || 'General'}) • Followers: {fbTestFeedback.page?.fanCount ?? 'Active'} • Ready for Publishing
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span>Meta API Error: {fbTestFeedback.error}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => testFbMutation.mutate()}
                  disabled={testFbMutation.isPending || (!fbStatus?.connected && !fbPageId)}
                  className="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testFbMutation.isPending ? 'animate-spin' : ''}`} />
                  {testFbMutation.isPending ? 'Verifying with Meta...' : 'Test Meta Connection'}
                </button>

                <button
                  type="button"
                  onClick={() => saveFbMutation.mutate()}
                  disabled={saveFbMutation.isPending || !fbPageId || (!fbAccessToken && !fbStatus?.connected)}
                  className="px-5 py-2.5 bg-[#1877F2] hover:bg-[#166fe5] text-white font-bold text-xs rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {saveFbMutation.isPending ? 'Connecting...' : 'Save & Connect Facebook'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>


      {/* LinkedIn Company / Member Integration Card */}
      <div className="bg-white border border-[#c3c6d7] rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#0A66C2]">
              <LinkedinIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-base font-bold text-[#1c1b1f]">LinkedIn Company & Profile Integration</h4>
                {liStatus?.connected ? (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Connected {liStatus.accountName ? `(${liStatus.accountName})` : ''}
                  </span>
                ) : (
                  <span className="text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">
                    Not Connected
                  </span>
                )}
              </div>
              <p className="text-xs text-[#49454f] mt-0.5">
                Publish thought leadership posts, promotional announcements, and media updates directly to your LinkedIn Company Page or Personal Profile.
              </p>
            </div>
          </div>
          {liStatus?.connected && (
            <button
              type="button"
              onClick={() => disconnectLiMutation.mutate()}
              disabled={disconnectLiMutation.isPending}
              className="text-xs font-bold text-rose-600 hover:text-rose-700 border border-rose-200 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition"
            >
              {disconnectLiMutation.isPending ? 'Disconnecting...' : 'Disconnect'}
            </button>
          )}
        </div>

        {/* 1-Click LinkedIn OAuth 2.0 Connection Banner */}
        <div className="bg-gradient-to-r from-blue-50/90 to-sky-50/90 border border-blue-200/90 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
          <div className="space-y-0.5 text-center sm:text-left">
            <h5 className="text-xs font-bold text-[#0A66C2] flex items-center justify-center sm:justify-start gap-1.5">
              <Sparkles className="w-4 h-4 text-[#0A66C2]" />
              Recommended: 1-Click LinkedIn OAuth 2.0 Login
            </h5>
            <p className="text-[11px] text-blue-900 leading-relaxed">
              Login securely on LinkedIn, approve in 1-click, and OneAIAssist automatically acquires your Member URN and 60-day OAuth token. Zero manual setup needed.
            </p>
          </div>
          <button
            type="button"
            onClick={handleLinkedInOAuthLogin}
            className="px-5 py-2.5 bg-[#0A66C2] hover:bg-[#004182] text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-2 whitespace-nowrap active:scale-95"
          >
            <LinkedinIcon className="w-4 h-4 text-white" />
            <span>Connect with LinkedIn</span>
          </button>
        </div>

        {/* Feedback Messages */}
        {liError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{liError}</span>
          </div>
        )}
        {liSaveSuccess && (
          <p className="text-xs text-emerald-700 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200 font-bold">
            ✓ LinkedIn Profile / Company Page successfully connected! UGC Marketing Publisher is active.
          </p>
        )}

        {/* Collapsible Manual Credentials Form */}
        <div className="border-t border-gray-100 pt-3">
          <button
            type="button"
            onClick={() => setShowManualLi(!showManualLi)}
            className="text-xs font-bold text-gray-600 hover:text-gray-900 flex items-center justify-between w-full py-1 transition"
          >
            <span className="flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-gray-500" />
              Advanced: Enter Member/Organization URN & Token Manually
            </span>
            <span className="text-[11px] text-[#004ac6] font-semibold">
              {showManualLi ? 'Hide Manual Options ▲' : 'Show Manual Options ▼'}
            </span>
          </button>

          {showManualLi && (
            <div className="space-y-4 pt-3 mt-2 border-t border-gray-100">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Posting As (Author Type)</label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs font-semibold text-gray-800 cursor-pointer">
                    <input
                      type="radio"
                      name="liAuthorType"
                      value="ORGANIZATION"
                      checked={liAuthorType === 'ORGANIZATION'}
                      onChange={() => setLiAuthorType('ORGANIZATION')}
                      className="text-[#0A66C2] focus:ring-[#0A66C2]"
                    />
                    Company / Organization Page
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-gray-800 cursor-pointer">
                    <input
                      type="radio"
                      name="liAuthorType"
                      value="PERSON"
                      checked={liAuthorType === 'PERSON'}
                      onChange={() => setLiAuthorType('PERSON')}
                      className="text-[#0A66C2] focus:ring-[#0A66C2]"
                    />
                    Personal Profile / Member
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    {liAuthorType === 'ORGANIZATION' ? 'LinkedIn Organization ID or URN' : 'LinkedIn Member URN / ID'} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={liAuthorUrn}
                    onChange={(e) => setLiAuthorUrn(e.target.value)}
                    placeholder={liAuthorType === 'ORGANIZATION' ? 'e.g. 98765432 or urn:li:organization:98765432' : 'e.g. urn:li:person:abcdef123'}
                    className="w-full px-3 py-2 bg-slate-50 border border-gray-300 rounded-lg text-xs outline-none focus:border-[#004ac6] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Display / Company Name
                  </label>
                  <input
                    type="text"
                    value={liAccountName}
                    onChange={(e) => setLiAccountName(e.target.value)}
                    placeholder="e.g. Prime Marketing Experts Company"
                    className="w-full px-3 py-2 bg-slate-50 border border-gray-300 rounded-lg text-xs outline-none focus:border-[#004ac6] focus:bg-white"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    OAuth 2.0 Access Token (Encrypted AES-256) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={liAccessToken}
                    onChange={(e) => setLiAccessToken(e.target.value)}
                    placeholder={liStatus?.connected ? "••••••••••••••••••••••••" : "AQV..."}
                    className="w-full px-3 py-2 bg-slate-50 border border-gray-300 rounded-lg text-xs outline-none focus:border-[#004ac6] focus:bg-white"
                  />
                </div>
              </div>

              <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3 text-[11px] text-blue-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-700" />
                  Required LinkedIn OAuth 2.0 Scopes:
                </p>
                <p>
                  For Organization Pages: <strong>w_organization_social</strong> and <strong>r_organization_social</strong>. For Personal Profiles: <strong>w_member_social</strong> and <strong>openid, profile, email</strong>.
                </p>
              </div>

              {/* LinkedIn API Test Feedback */}
              {liTestFeedback && (
                <div className={`p-3 rounded-xl border text-xs font-semibold ${
                  liTestFeedback.valid
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}>
                  {liTestFeedback.valid ? (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        LinkedIn Connection Verified! Name: <strong>{liTestFeedback.profile?.name}</strong> {liTestFeedback.profile?.email ? `(${liTestFeedback.profile.email})` : ''} • Ready for Campaign Publishing
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span>LinkedIn API Error: {liTestFeedback.error}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => testLiMutation.mutate()}
                  disabled={testLiMutation.isPending || (!liStatus?.connected && !liAuthorUrn)}
                  className="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testLiMutation.isPending ? 'animate-spin' : ''}`} />
                  {testLiMutation.isPending ? 'Verifying with LinkedIn...' : 'Test LinkedIn Connection'}
                </button>

                <button
                  type="button"
                  onClick={() => saveLiMutation.mutate()}
                  disabled={saveLiMutation.isPending || !liAuthorUrn || (!liAccessToken && !liStatus?.connected)}
                  className="px-5 py-2.5 bg-[#0A66C2] hover:bg-[#084e96] text-white font-bold text-xs rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {saveLiMutation.isPending ? 'Connecting...' : 'Save & Connect LinkedIn'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Native Email Marketing & Deliverability Gateway Card */}
      <div className="bg-white border border-[#c3c6d7] rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#004ac6]">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-base font-bold text-[#1c1b1f]">Native Email Marketing & Deliverability</h4>
              <p className="text-xs text-[#737686]">
                Multi-tenant sending infrastructure with SPF, DKIM, and DMARC verification
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {emailConfigData?.isAutoPaused ? (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Auto-Paused (High Complaints)
              </span>
            ) : emailConfigData?.configured ? (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Active & Connected
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600 border border-gray-200">
                Not Configured
              </span>
            )}
          </div>
        </div>

        {/* Provider Selection */}
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-2">Select Email Delivery Provider</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { id: 'RESEND', label: 'Resend', badge: 'Recommended' },
              { id: 'SES', label: 'Amazon SES', badge: 'Enterprise' },
              { id: 'SENDGRID', label: 'SendGrid', badge: 'Standard' },
              { id: 'SMTP', label: 'Custom SMTP', badge: 'Self-Hosted' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setEmailProvider(p.id as any)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  emailProvider === p.id
                    ? 'border-[#004ac6] bg-blue-50/50 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-bold ${emailProvider === p.id ? 'text-[#004ac6]' : 'text-gray-800'}`}>
                    {p.label}
                  </span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                    {p.badge}
                  </span>
                </div>
                <p className="text-[10px] text-gray-500">
                  {p.id === 'RESEND' ? 'Automated DKIM/DMARC' : p.id === 'SES' ? 'High-volume AWS infra' : p.id === 'SENDGRID' ? 'Twilio SendGrid engine' : 'Direct SMTP relay'}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Credentials & Sender Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              {emailProvider === 'SMTP' ? 'SMTP Host & Port / Password' : `${emailProvider} API Key`}
              <span className="text-[10px] font-normal text-emerald-600 ml-2 font-mono">🔒 AES-256-GCM Encrypted</span>
            </label>
            <input
              type="password"
              value={emailApiKey}
              onChange={(e) => setEmailApiKey(e.target.value)}
              placeholder="re_1234567890abcdef..."
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs outline-none focus:border-[#004ac6] font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">From Sender Name</label>
            <input
              type="text"
              value={emailFromName}
              onChange={(e) => setEmailFromName(e.target.value)}
              placeholder="e.g. Maya from Apex Health"
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs outline-none focus:border-[#004ac6]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">From Sender Email</label>
            <input
              type="email"
              value={emailFromEmail}
              onChange={(e) => setEmailFromEmail(e.target.value)}
              placeholder="e.g. care@apexinsurance.com"
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs outline-none focus:border-[#004ac6]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Reply-To Address (Optional)</label>
            <input
              type="email"
              value={emailReplyTo}
              onChange={(e) => setEmailReplyTo(e.target.value)}
              placeholder="e.g. support@apexinsurance.com"
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs outline-none focus:border-[#004ac6]"
            />
          </div>
        </div>

        {/* Sending Domains & DNS Verification Table */}
        <div className="pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h5 className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-[#004ac6]" />
                Sending Domains & DNS Authentication (SPF, DKIM, DMARC)
              </h5>
              <p className="text-[11px] text-gray-500">
                Verify your domain DNS to achieve 99%+ deliverability and prevent spam folder placement.
              </p>
            </div>
          </div>

          {/* Add Domain Input */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="Enter domain (e.g. yourcompany.com)"
              className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs outline-none focus:border-[#004ac6]"
            />
            <button
              type="button"
              onClick={() => addDomainMutation.mutate()}
              disabled={addDomainMutation.isPending || !newDomain}
              className="px-4 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white font-bold text-xs rounded-lg transition disabled:opacity-50"
            >
              {addDomainMutation.isPending ? 'Adding...' : '+ Add Domain'}
            </button>
          </div>

          {domainError && <p className="text-xs text-rose-600 font-semibold mb-3">{domainError}</p>}

          {/* Domain List Table */}
          {emailDomainsData && emailDomainsData.length > 0 ? (
            <div className="space-y-3">
              {emailDomainsData.map((d: any) => {
                const isExpanded = expandedDomainId === d.id;
                const dkimArray = Array.isArray(d.dkimRecords) ? d.dkimRecords : [];
                return (
                  <div key={d.id} className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50/50">
                    <div className="flex items-center justify-between p-3 bg-white border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-gray-900">{d.domain}</span>
                        {d.status === 'VERIFIED' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Verified
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                            <RefreshCw className="w-3 h-3 animate-spin" /> Pending DNS
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => verifyDomainMutation.mutate(d.domain)}
                          disabled={verifyDomainMutation.isPending}
                          className="px-3 py-1 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 font-bold text-[11px] rounded-lg transition flex items-center gap-1.5 shadow-sm"
                        >
                          <RefreshCw className={`w-3 h-3 ${verifyDomainMutation.isPending ? 'animate-spin' : ''}`} />
                          Verify DNS
                        </button>
                        <button
                          type="button"
                          onClick={() => setExpandedDomainId(isExpanded ? null : d.id)}
                          className="p-1 hover:bg-gray-100 rounded text-gray-500"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* DNS Records Expandable Drawer */}
                    {isExpanded && (
                      <div className="p-3 bg-gray-50 text-[11px] space-y-2 border-t border-gray-100">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                          Copy these records into your DNS provider (Cloudflare, GoDaddy, Route53):
                        </p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left bg-white border border-gray-200 rounded-lg overflow-hidden text-[10px]">
                            <thead className="bg-gray-50 border-b border-gray-200 font-bold text-gray-600">
                              <tr>
                                <th className="p-2">Type</th>
                                <th className="p-2">Host / Name</th>
                                <th className="p-2">Value</th>
                                <th className="p-2">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 font-mono">
                              {/* SPF */}
                              <tr>
                                <td className="p-2 font-bold text-blue-600">TXT (SPF)</td>
                                <td className="p-2">{d.spfRecord?.name || '@'}</td>
                                <td className="p-2 truncate max-w-[200px] flex items-center gap-1">
                                  <span>{d.spfRecord?.value || 'v=spf1 include:resend.com ~all'}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleCopy(d.spfRecord?.value || 'v=spf1 include:resend.com ~all')}
                                    className="text-gray-400 hover:text-gray-700"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                </td>
                                <td className="p-2 text-emerald-600 font-bold">{d.status === 'VERIFIED' ? '✓' : 'Pending'}</td>
                              </tr>
                              {/* DKIM */}
                              {dkimArray.map((dk: any, idx: number) => (
                                <tr key={idx}>
                                  <td className="p-2 font-bold text-purple-600">CNAME (DKIM)</td>
                                  <td className="p-2">{dk.name || `resend._domainkey.${d.domain}`}</td>
                                  <td className="p-2 truncate max-w-[200px] flex items-center gap-1">
                                    <span>{dk.value || 'dkim.resend.com'}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleCopy(dk.value || 'dkim.resend.com')}
                                      className="text-gray-400 hover:text-gray-700"
                                    >
                                      <Copy className="w-3 h-3" />
                                    </button>
                                  </td>
                                  <td className="p-2 text-emerald-600 font-bold">{d.status === 'VERIFIED' ? '✓' : 'Pending'}</td>
                                </tr>
                              ))}
                              {/* DMARC */}
                              <tr>
                                <td className="p-2 font-bold text-indigo-600">TXT (DMARC)</td>
                                <td className="p-2">{d.dmarcRecord?.name || `_dmarc.${d.domain}`}</td>
                                <td className="p-2 truncate max-w-[200px] flex items-center gap-1">
                                  <span>{d.dmarcRecord?.value || 'v=DMARC1; p=none;'}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleCopy(d.dmarcRecord?.value || 'v=DMARC1; p=none;')}
                                    className="text-gray-400 hover:text-gray-700"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                </td>
                                <td className="p-2 text-emerald-600 font-bold">{d.status === 'VERIFIED' ? '✓' : 'Pending'}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-4 border border-dashed border-gray-200 rounded-xl text-center text-xs text-gray-500">
              No sending domains registered yet. Add your brand domain above to generate SPF and DKIM records.
            </div>
          )}
        </div>

        {/* Deliverability & Reputation Health Section */}
        <div className="pt-4 border-t border-gray-100 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h5 className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#004ac6]" />
                Sender Reputation & Deliverability Health
              </h5>
              <p className="text-[11px] text-gray-500">
                Automated compliance monitoring: warning at 0.1% complaints, safety auto-pause circuit breaker at 0.3%.
              </p>
            </div>
            {deliverabilityData && (
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                deliverabilityData.healthStatus === 'HEALTHY'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : deliverabilityData.healthStatus === 'WARNING'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}>
                {deliverabilityData.healthStatus === 'HEALTHY' && '● Sender Health: Optimal'}
                {deliverabilityData.healthStatus === 'WARNING' && '▲ Warning: Elevated Complaints'}
                {deliverabilityData.healthStatus === 'PAUSED' && '✕ Sending Auto-Paused'}
              </span>
            )}
          </div>

          {/* Alert Banners */}
          {deliverabilityData?.isAutoPaused && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                <div>
                  <p className="text-xs font-bold text-rose-900">
                    Sending Paused by Deliverability Circuit Breaker
                  </p>
                  <p className="text-[11px] text-rose-700">
                    Spam complaint rate has reached {deliverabilityData?.metrics?.complaintRate || 0}%, exceeding the 0.3% threshold.
                    Clean your list and remove unengaged contacts before resuming.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => resumeSendingMutation.mutate()}
                disabled={resumeSendingMutation.isPending}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg transition whitespace-nowrap shadow-sm disabled:opacity-50"
              >
                {resumeSendingMutation.isPending ? 'Resuming...' : 'Resume Sending'}
              </button>
            </div>
          )}

          {deliverabilityData?.isWarning && !deliverabilityData?.isAutoPaused && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <p className="text-xs text-amber-900 font-medium">
                <strong>Deliverability Warning:</strong> Complaint rate is at {deliverabilityData?.metrics?.complaintRate}%. Approaching the 0.3% auto-pause limit. Check your email frequency and unsubscribe headers.
              </p>
            </div>
          )}

          {/* Metric Meters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Delivered</span>
              <span className="text-base font-extrabold text-slate-800">
                {(deliverabilityData?.metrics?.totalDelivered || 0).toLocaleString()}
              </span>
            </div>
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Complaint Rate</span>
              <div className="flex items-baseline gap-1">
                <span className={`text-base font-extrabold ${
                  (deliverabilityData?.metrics?.complaintRate || 0) >= 0.3
                    ? 'text-rose-600'
                    : (deliverabilityData?.metrics?.complaintRate || 0) >= 0.1
                    ? 'text-amber-600'
                    : 'text-slate-800'
                }`}>
                  {deliverabilityData?.metrics?.complaintRate ?? 0}%
                </span>
                <span className="text-[10px] text-slate-400 font-semibold">(max 0.1%)</span>
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Bounce Rate</span>
              <span className="text-base font-extrabold text-slate-800">
                {deliverabilityData?.metrics?.bounceRate ?? 0}%
              </span>
            </div>
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Warm-Up Stage</span>
              <span className="text-xs font-extrabold text-indigo-700 block mt-1">
                {deliverabilityData?.warmup?.recommendedStage || 'Stage 1'}
              </span>
              <span className="text-[9px] text-slate-400 font-semibold">
                {deliverabilityData?.warmup?.dailyQuota || 1000}/day ({deliverabilityData?.warmup?.hourlyRate || 100}/hr)
              </span>
            </div>
          </div>
        </div>

        {/* Feedback Messages */}
        {emailError && <p className="text-xs text-rose-600 font-semibold">{emailError}</p>}
        {emailSaveSuccess && (
          <p className="text-xs text-emerald-700 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200 font-bold">
            ✓ Email configuration and provider credentials securely encrypted and saved!
          </p>
        )}
        {copiedValue && (
          <p className="text-xs text-blue-700 bg-blue-50 p-2 rounded border border-blue-200">
            Copied DNS record to clipboard!
          </p>
        )}

        {/* Save Button */}
        <div className="flex justify-end pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={() => saveEmailMutation.mutate()}
            disabled={saveEmailMutation.isPending || !emailFromName || !emailFromEmail}
            className="px-5 py-2.5 bg-[#004ac6] hover:bg-[#003da6] text-white font-bold text-xs rounded-xl shadow-sm transition disabled:opacity-50"
          >
            {saveEmailMutation.isPending ? 'Saving...' : 'Save Email Configuration'}
          </button>
        </div>
      </div>

      {/* Phone Alias & Display Settings */}
      <div className="bg-white border border-[#c3c6d7] rounded-2xl p-6 shadow-sm space-y-4">
        <h4 className="text-sm font-bold text-[#1B4B91] flex items-center gap-2">
          <Phone className="w-4 h-4 text-[#004ac6]" />
          Phone Line Alias & Outbound Messaging Label
        </h4>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Display Alias Label</label>
          <input
            type="text"
            value={phoneAlias}
            onChange={(e) => setPhoneAlias(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs outline-none focus:border-[#004ac6]"
          />
          <p className="text-[11px] text-gray-500 mt-1">This label appears on internal lead logs and broadcast headers.</p>
        </div>
      </div>
    </div>
  );
}
