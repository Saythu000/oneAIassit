import { getTenantPrisma } from '@/lib/db';

export interface UnifiedSegmentFilter {
  type: 'all' | 'tag' | 'stage' | 'date_range' | 'email_engagement' | 'channel_consent';
  value?: any;
  emailActivity?: 'OPENED_LAST_30_DAYS' | 'CLICKED_ANY' | 'NEVER_BOUNCED';
  channelConsent?: 'EMAIL_SUBSCRIBED' | 'WHATSAPP_OPTED_IN';
}

export class SegmentationService {
  /**
   * Builds a unified Prisma `where` clause that applies to WhatsApp, Instagram, and Email.
   */
  static async buildUnifiedCustomerFilter(
    tenantId: string,
    filter: UnifiedSegmentFilter,
    targetChannel: 'EMAIL' | 'WHATSAPP' | 'INSTAGRAM' = 'EMAIL'
  ): Promise<any> {
    const where: any = { tenantId, optedOutAt: null };

    // 1. Channel Consent Requirements
    if (targetChannel === 'EMAIL') {
      where.email = { not: null };
      where.emailConsentStatus = 'SUBSCRIBED';
    } else if (targetChannel === 'WHATSAPP') {
      where.primaryPhone = { not: '' };
      where.optedIn = true;
    }

    // 2. Base Segment Filter (Tags, Stage, Date Range)
    if (filter.type === 'tag' && filter.value) {
      const v = String(filter.value).trim();
      const variants = Array.from(new Set([
        v,
        v.toUpperCase(),
        v.toLowerCase(),
        v.charAt(0).toUpperCase() + v.slice(1).toLowerCase(),
      ]));
      where.tags = { hasSome: variants };
    } else if (filter.type === 'stage' && filter.value) {
      where.leads = {
        some: {
          status: filter.value,
        },
      };
    } else if (filter.type === 'date_range' && filter.value) {
      const { start, end } = typeof filter.value === 'object' ? filter.value : { start: '', end: '' };
      let gte: Date | undefined;
      let lte: Date | undefined;
      if (start && start.trim()) gte = new Date(start.includes('T') ? start : `${start}T00:00:00`);
      if (end && end.trim()) lte = new Date(end.includes('T') ? end : `${end}T23:59:59.999`);
      if (gte || lte) {
        const dateCond: any = {};
        if (gte) dateCond.gte = gte;
        if (lte) dateCond.lte = lte;
        where.createdAt = dateCond;
      }
    }

    // 3. Email-specific behavioral filters
    if (filter.emailActivity) {
      if (filter.emailActivity === 'OPENED_LAST_30_DAYS') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        where.emailEvents = {
          some: {
            eventType: 'OPEN',
            createdAt: { gte: thirtyDaysAgo },
          },
        };
      } else if (filter.emailActivity === 'CLICKED_ANY') {
        where.emailEvents = {
          some: {
            eventType: 'CLICK',
          },
        };
      } else if (filter.emailActivity === 'NEVER_BOUNCED') {
        where.emailEvents = {
          none: {
            eventType: { in: ['BOUNCE_HARD', 'BOUNCE_SOFT'] },
          },
        };
      }
    }

    return where;
  }

  /**
   * Preview total audience count and opted-out count for a given unified filter.
   */
  static async countSegmentAudience(
    tenantId: string,
    filter: UnifiedSegmentFilter,
    targetChannel: 'EMAIL' | 'WHATSAPP' | 'INSTAGRAM' = 'EMAIL'
  ): Promise<{ audienceCount: number; optedOutCount: number }> {
    const db = getTenantPrisma(tenantId, 'ADMIN');
    const where = await this.buildUnifiedCustomerFilter(tenantId, filter, targetChannel);

    const audienceCount = await db.customer.count({ where });

    let optedOutWhere: any = { tenantId };
    if (targetChannel === 'EMAIL') {
      optedOutWhere.OR = [
        { emailConsentStatus: { in: ['UNSUBSCRIBED', 'BOUNCED', 'COMPLAINED'] } },
        { NOT: { optedOutAt: null } },
      ];
    } else {
      optedOutWhere.NOT = { optedOutAt: null };
    }

    const optedOutCount = await db.customer.count({ where: optedOutWhere });

    return { audienceCount, optedOutCount };
  }
}
