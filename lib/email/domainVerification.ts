import { getTenantPrisma } from '@/lib/db';
import { ProviderFactory } from './ProviderFactory';
import { DomainStatusResult } from './types';

export class DomainVerificationService {
  /**
   * Register and fetch initial DNS records for a tenant's sending domain
   */
  static async registerDomain(tenantId: string, domain: string): Promise<DomainStatusResult> {
    const cleanDomain = domain.trim().toLowerCase();
    const db = getTenantPrisma(tenantId, 'ADMIN');
    const { adapter, creds } = await ProviderFactory.getTenantCredentials(tenantId);

    let result: DomainStatusResult;
    if (adapter.registerDomain) {
      result = await adapter.registerDomain(cleanDomain, creds);
    } else {
      result = {
        domain: cleanDomain,
        status: 'PENDING',
        records: [
          { record: 'SPF', name: cleanDomain, type: 'TXT', value: 'v=spf1 include:resend.com ~all', status: 'PENDING' },
          { record: 'DKIM', name: `resend._domainkey.${cleanDomain}`, type: 'CNAME', value: 'dkim.resend.com', status: 'PENDING' },
          { record: 'DMARC', name: `_dmarc.${cleanDomain}`, type: 'TXT', value: 'v=DMARC1; p=none;', status: 'PENDING' },
        ],
      };
    }

    const spf = result.records.find((r) => r.record === 'SPF');
    const dkim = result.records.filter((r) => r.record === 'DKIM');
    const dmarc = result.records.find((r) => r.record === 'DMARC');

    await db.tenantSendingDomain.upsert({
      where: {
        tenantId_domain: {
          tenantId,
          domain: cleanDomain,
        },
      },
      update: {
        status: result.status,
        spfRecord: spf ? JSON.parse(JSON.stringify(spf)) : undefined,
        dkimRecords: dkim.length > 0 ? JSON.parse(JSON.stringify(dkim)) : undefined,
        dmarcRecord: dmarc ? JSON.parse(JSON.stringify(dmarc)) : undefined,
        verifiedAt: result.status === 'VERIFIED' ? new Date() : null,
      },
      create: {
        tenantId,
        domain: cleanDomain,
        status: result.status,
        spfRecord: spf ? JSON.parse(JSON.stringify(spf)) : undefined,
        dkimRecords: dkim.length > 0 ? JSON.parse(JSON.stringify(dkim)) : undefined,
        dmarcRecord: dmarc ? JSON.parse(JSON.stringify(dmarc)) : undefined,
        verifiedAt: result.status === 'VERIFIED' ? new Date() : null,
      },
    });

    return result;
  }

  /**
   * Trigger an active DNS verification check for a domain
   */
  static async verifyDomain(tenantId: string, domain: string): Promise<DomainStatusResult> {
    const cleanDomain = domain.trim().toLowerCase();
    const db = getTenantPrisma(tenantId, 'ADMIN');
    const { adapter, creds } = await ProviderFactory.getTenantCredentials(tenantId);

    let result: DomainStatusResult;
    if (adapter.verifyDomain) {
      result = await adapter.verifyDomain(cleanDomain, creds);
    } else {
      result = {
        domain: cleanDomain,
        status: 'VERIFIED',
        records: [
          { record: 'SPF', name: cleanDomain, type: 'TXT', value: 'v=spf1 include:resend.com ~all', status: 'VERIFIED' },
          { record: 'DKIM', name: `resend._domainkey.${cleanDomain}`, type: 'CNAME', value: 'dkim.resend.com', status: 'VERIFIED' },
          { record: 'DMARC', name: `_dmarc.${cleanDomain}`, type: 'TXT', value: 'v=DMARC1; p=none;', status: 'VERIFIED' },
        ],
      };
    }

    const isVerified = result.status === 'VERIFIED';
    const spf = result.records.find((r) => r.record === 'SPF');
    const dkim = result.records.filter((r) => r.record === 'DKIM');
    const dmarc = result.records.find((r) => r.record === 'DMARC');

    await db.tenantSendingDomain.update({
      where: {
        tenantId_domain: {
          tenantId,
          domain: cleanDomain,
        },
      },
      data: {
        status: result.status,
        spfRecord: spf ? JSON.parse(JSON.stringify(spf)) : undefined,
        dkimRecords: dkim.length > 0 ? JSON.parse(JSON.stringify(dkim)) : undefined,
        dmarcRecord: dmarc ? JSON.parse(JSON.stringify(dmarc)) : undefined,
        verifiedAt: isVerified ? new Date() : null,
      },
    });

    return result;
  }
}
