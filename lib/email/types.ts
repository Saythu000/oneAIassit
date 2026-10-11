export interface OutboundEmail {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  tags?: Array<{ name: string; value: string }>;
}

export interface EmailSendResult {
  messageId: string;
  status: 'SENT' | 'QUEUED' | 'FAILED';
  error?: string;
}

export interface DnsRecordItem {
  record: 'SPF' | 'DKIM' | 'DMARC' | 'MX';
  name: string;
  type: string;
  value: string;
  status: 'VERIFIED' | 'PENDING' | 'FAILED';
  ttl?: string;
}

export interface DomainStatusResult {
  domain: string;
  status: 'VERIFIED' | 'PENDING' | 'FAILED';
  records: DnsRecordItem[];
}

export interface EmailProviderCredentials {
  apiKey: string;
  fromName: string;
  fromEmail: string;
  replyToEmail?: string | null;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
}

export interface IEmailProviderAdapter {
  readonly providerName: string;
  send(email: OutboundEmail, creds: EmailProviderCredentials): Promise<EmailSendResult>;
  registerDomain?(domain: string, creds: EmailProviderCredentials): Promise<DomainStatusResult>;
  verifyDomain?(domain: string, creds: EmailProviderCredentials): Promise<DomainStatusResult>;
}
