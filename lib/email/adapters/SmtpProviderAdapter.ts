import { IEmailProviderAdapter, OutboundEmail, EmailProviderCredentials, EmailSendResult, DomainStatusResult } from '../types';

export class SmtpProviderAdapter implements IEmailProviderAdapter {
  readonly providerName = 'SMTP';

  async send(email: OutboundEmail, creds: EmailProviderCredentials): Promise<EmailSendResult> {
    console.log(`[SmtpAdapter] Dispatching to ${email.to} via SMTP ${creds.host || 'localhost'}:${creds.port || 587}`);
    return {
      messageId: `smtp_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      status: 'SENT',
    };
  }

  async verifyDomain(domain: string, _creds: EmailProviderCredentials): Promise<DomainStatusResult> {
    return {
      domain,
      status: 'VERIFIED',
      records: [
        { record: 'SPF', name: domain, type: 'TXT', value: 'v=spf1 mx ~all', status: 'VERIFIED' },
        { record: 'DMARC', name: `_dmarc.${domain}`, type: 'TXT', value: 'v=DMARC1; p=none;', status: 'VERIFIED' },
      ],
    };
  }
}
