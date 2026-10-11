import { IEmailProviderAdapter, OutboundEmail, EmailProviderCredentials, EmailSendResult, DomainStatusResult, DnsRecordItem } from '../types';

export class ResendProviderAdapter implements IEmailProviderAdapter {
  readonly providerName = 'RESEND';

  async send(email: OutboundEmail, creds: EmailProviderCredentials): Promise<EmailSendResult> {
    let fromEmail = creds.fromEmail || 'onboarding@resend.dev';
    const fromName = creds.fromName || 'OneAI Support';
    const isFreeMail = /@(gmail\.com|yahoo\.com|outlook\.com|hotmail\.com|icloud\.com)$/i.test(fromEmail);
    if (isFreeMail) {
      fromEmail = 'onboarding@resend.dev';
    }

    const sender = email.from && !/@(gmail\.com|yahoo\.com|outlook\.com|hotmail\.com|icloud\.com)/i.test(email.from)
      ? email.from
      : `"${fromName}" <${fromEmail}>`;
    const replyTo = email.replyTo || creds.replyToEmail || creds.fromEmail || undefined;

    // Resend REST API
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${creds.apiKey}`,
      },
      body: JSON.stringify({
        from: sender,
        to: [email.to],
        subject: email.subject,
        html: email.html,
        text: email.text,
        reply_to: replyTo,
        headers: email.headers,
        tags: email.tags,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg = data.message || `Resend API failed with status ${res.status}`;
      return { messageId: '', status: 'FAILED', error: errMsg };
    }

    return {
      messageId: data.id || '',
      status: 'SENT',
    };
  }

  async registerDomain(domain: string, creds: EmailProviderCredentials): Promise<DomainStatusResult> {
    const res = await fetch('https://api.resend.com/domains', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${creds.apiKey}`,
      },
      body: JSON.stringify({ name: domain }),
    });

    const data = await res.json().catch(() => ({}));
    return this.parseResendDomain(domain, data);
  }

  async verifyDomain(domain: string, creds: EmailProviderCredentials): Promise<DomainStatusResult> {
    // 1. Fetch domain list to find domain id
    const listRes = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${creds.apiKey}` },
    });
    const listData = await listRes.json().catch(() => ({}));
    const found = Array.isArray(listData.data) ? listData.data.find((d: any) => d.name === domain) : null;

    if (!found?.id) {
      // If not yet registered with Resend, register it
      return this.registerDomain(domain, creds);
    }

    // 2. Trigger verify on domain
    const verifyRes = await fetch(`https://api.resend.com/domains/${found.id}/verify`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${creds.apiKey}` },
    });
    const verifyData = await verifyRes.json().catch(() => ({}));

    // 3. Get domain details
    const getRes = await fetch(`https://api.resend.com/domains/${found.id}`, {
      headers: { Authorization: `Bearer ${creds.apiKey}` },
    });
    const domainDetails = await getRes.json().catch(() => ({}));

    return this.parseResendDomain(domain, domainDetails);
  }

  private parseResendDomain(domain: string, data: any): DomainStatusResult {
    const records: DnsRecordItem[] = [];
    const isVerified = data.status === 'verified';

    if (Array.isArray(data.records)) {
      for (const r of data.records) {
        records.push({
          record: (r.record || 'TXT').toUpperCase() as any,
          name: r.name || domain,
          type: r.type || 'TXT',
          value: r.value || '',
          status: r.status === 'verified' ? 'VERIFIED' : 'PENDING',
          ttl: r.ttl?.toString() || 'Auto',
        });
      }
    } else {
      // Standard recommended DNS defaults if mock or pending
      records.push(
        { record: 'SPF', name: domain, type: 'TXT', value: 'v=spf1 include:resend.com ~all', status: isVerified ? 'VERIFIED' : 'PENDING' },
        { record: 'DKIM', name: `resend._domainkey.${domain}`, type: 'CNAME', value: `dkim.resend.com`, status: isVerified ? 'VERIFIED' : 'PENDING' },
        { record: 'DMARC', name: `_dmarc.${domain}`, type: 'TXT', value: 'v=DMARC1; p=none;', status: isVerified ? 'VERIFIED' : 'PENDING' }
      );
    }

    return {
      domain,
      status: isVerified ? 'VERIFIED' : 'PENDING',
      records,
    };
  }
}
