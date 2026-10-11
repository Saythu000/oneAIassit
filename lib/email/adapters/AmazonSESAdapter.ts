import { IEmailProviderAdapter, OutboundEmail, EmailProviderCredentials, EmailSendResult, DomainStatusResult } from '../types';

export class AmazonSESAdapter implements IEmailProviderAdapter {
  readonly providerName = 'SES';

  async send(email: OutboundEmail, creds: EmailProviderCredentials): Promise<EmailSendResult> {
    // If running in development/test or via API key
    if (!creds.apiKey || creds.apiKey.startsWith('mock_')) {
      console.log(`[SESAdapter] Mock dispatch to ${email.to}`);
      return { messageId: `ses_mock_${Date.now()}`, status: 'SENT' };
    }

    // In production, uses AWS SES API
    try {
      const endpoint = `https://email.us-east-1.amazonaws.com/v2/email/outbound-emails`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Amz-Security-Token': creds.apiKey,
        },
        body: JSON.stringify({
          FromEmailAddress: `"${creds.fromName}" <${creds.fromEmail}>`,
          Destination: { ToAddresses: [email.to] },
          Content: {
            Simple: {
              Subject: { Data: email.subject },
              Body: { Html: { Data: email.html }, Text: { Data: email.text || '' } },
            },
          },
        }),
      });

      const data = await res.json().catch(() => ({}));
      return { messageId: data.MessageId || `ses_${Date.now()}`, status: res.ok ? 'SENT' : 'FAILED' };
    } catch (err: any) {
      return { messageId: '', status: 'FAILED', error: err.message };
    }
  }

  async verifyDomain(domain: string, _creds: EmailProviderCredentials): Promise<DomainStatusResult> {
    return {
      domain,
      status: 'PENDING',
      records: [
        { record: 'SPF', name: domain, type: 'TXT', value: 'v=spf1 include:amazonses.com ~all', status: 'PENDING' },
        { record: 'DKIM', name: `ses._domainkey.${domain}`, type: 'CNAME', value: `${domain}.dkim.amazonses.com`, status: 'PENDING' },
        { record: 'DMARC', name: `_dmarc.${domain}`, type: 'TXT', value: 'v=DMARC1; p=none;', status: 'PENDING' },
      ],
    };
  }
}
