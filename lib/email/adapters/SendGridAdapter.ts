import { IEmailProviderAdapter, OutboundEmail, EmailProviderCredentials, EmailSendResult, DomainStatusResult } from '../types';

export class SendGridAdapter implements IEmailProviderAdapter {
  readonly providerName = 'SENDGRID';

  async send(email: OutboundEmail, creds: EmailProviderCredentials): Promise<EmailSendResult> {
    if (!creds.apiKey || creds.apiKey.startsWith('mock_')) {
      console.log(`[SendGridAdapter] Mock dispatch to ${email.to}`);
      return { messageId: `sg_mock_${Date.now()}`, status: 'SENT' };
    }

    try {
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${creds.apiKey}`,
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: email.to }] }],
          from: { email: creds.fromEmail, name: creds.fromName },
          subject: email.subject,
          content: [
            { type: 'text/html', value: email.html },
            ...(email.text ? [{ type: 'text/plain', value: email.text }] : []),
          ],
        }),
      });

      const messageId = res.headers.get('x-message-id') || `sg_${Date.now()}`;
      return { messageId, status: res.ok ? 'SENT' : 'FAILED' };
    } catch (err: any) {
      return { messageId: '', status: 'FAILED', error: err.message };
    }
  }

  async verifyDomain(domain: string, _creds: EmailProviderCredentials): Promise<DomainStatusResult> {
    return {
      domain,
      status: 'PENDING',
      records: [
        { record: 'SPF', name: domain, type: 'TXT', value: 'v=spf1 include:sendgrid.net ~all', status: 'PENDING' },
        { record: 'DKIM', name: `s1._domainkey.${domain}`, type: 'CNAME', value: `s1.domainkey.sendgrid.net`, status: 'PENDING' },
        { record: 'DMARC', name: `_dmarc.${domain}`, type: 'TXT', value: 'v=DMARC1; p=none;', status: 'PENDING' },
      ],
    };
  }
}
