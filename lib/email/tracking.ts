import crypto from 'node:crypto';
import { getTenantPrisma } from '@/lib/db';
import { EmailSuppressionService } from './suppression';

export interface TrackingLinkParams {
  tenantId: string;
  campaignId?: string;
  customerId?: string;
  originalUrl: string;
}

export class EmailTrackingService {
  private static readonly SECRET = process.env.ENCRYPTION_SECRET || 'oneaiassist_default_secret_key_32b';

  /**
   * Generates a tamper-proof signed tracking URL with custom UTM tags.
   */
  static generateTrackingUrl(appBaseUrl: string, params: TrackingLinkParams): string {
    const { tenantId, campaignId, customerId, originalUrl } = params;

    // Attach automatic UTM tagging if originalUrl doesn't have it
    let targetWithUtm = originalUrl;
    try {
      const parsed = new URL(originalUrl);
      if (!parsed.searchParams.has('utm_source')) {
        parsed.searchParams.set('utm_source', 'oneaiassist_email');
        parsed.searchParams.set('utm_medium', 'email');
        if (campaignId) parsed.searchParams.set('utm_campaign', campaignId);
      }
      targetWithUtm = parsed.toString();
    } catch {
      // Keep originalUrl if relative or unparseable
    }

    const payload = JSON.stringify({
      t: tenantId,
      c: campaignId || '',
      u: customerId || '',
      url: targetWithUtm,
    });

    const signature = crypto
      .createHmac('sha256', this.SECRET)
      .update(payload)
      .digest('hex');

    const encodedPayload = Buffer.from(payload).toString('base64url');
    return `${appBaseUrl}/api/channels/email/track/click?d=${encodedPayload}&s=${signature}`;
  }

  /**
   * Generates a 1x1 transparent tracking pixel URL.
   */
  static generateOpenTrackingPixelUrl(appBaseUrl: string, tenantId: string, campaignId?: string, customerId?: string): string {
    const payload = JSON.stringify({
      t: tenantId,
      c: campaignId || '',
      u: customerId || '',
    });

    const signature = crypto
      .createHmac('sha256', this.SECRET)
      .update(payload)
      .digest('hex');

    const encodedPayload = Buffer.from(payload).toString('base64url');
    return `${appBaseUrl}/api/channels/email/track/open?d=${encodedPayload}&s=${signature}`;
  }

  /**
   * Verifies and decodes tracking URL parameters.
   */
  static decodeTrackingPayload(encodedData: string, signature: string): {
    valid: boolean;
    data?: { tenantId: string; campaignId?: string; customerId?: string; targetUrl?: string };
  } {
    try {
      const rawPayload = Buffer.from(encodedData, 'base64url').toString('utf-8');
      const expectedSignature = crypto
        .createHmac('sha256', this.SECRET)
        .update(rawPayload)
        .digest('hex');

      if (signature !== expectedSignature) {
        return { valid: false };
      }

      const parsed = JSON.parse(rawPayload);
      return {
        valid: true,
        data: {
          tenantId: parsed.t,
          campaignId: parsed.c || undefined,
          customerId: parsed.u || undefined,
          targetUrl: parsed.url,
        },
      };
    } catch {
      return { valid: false };
    }
  }

  /**
   * Records an email event (DELIVERED, OPEN, CLICK, BOUNCE, COMPLAINT, UNSUBSCRIBE)
   * Updates campaign metrics, contact timeline, and deliverability complaint rates.
   */
  static async recordEmailEvent(params: {
    tenantId: string;
    email: string;
    eventType: 'DELIVERED' | 'OPEN' | 'CLICK' | 'BOUNCE_HARD' | 'BOUNCE_SOFT' | 'COMPLAINT' | 'UNSUBSCRIBE';
    messageId?: string;
    customerId?: string;
    campaignId?: string;
    url?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: any;
  }): Promise<void> {
    const {
      tenantId,
      email,
      eventType,
      messageId,
      customerId,
      campaignId,
      url,
      ipAddress,
      userAgent,
      metadata,
    } = params;

    const db = getTenantPrisma(tenantId, 'ADMIN');
    const cleanEmail = email.trim().toLowerCase();

    // 1. Resolve customer if not passed directly
    let targetCustomerId = customerId;
    if (!targetCustomerId) {
      const cust = await db.customer.findFirst({
        where: { tenantId, email: cleanEmail },
        select: { id: true },
      });
      if (cust) targetCustomerId = cust.id;
    }

    // 2. Persist EmailEvent
    await db.emailEvent.create({
      data: {
        tenantId,
        email: cleanEmail,
        eventType,
        messageId: messageId || null,
        customerId: targetCustomerId || null,
        campaignId: campaignId || null,
        url: url || null,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        metadata: metadata || undefined,
      },
    });

    // 3. Update BroadcastCampaign live counters
    if (campaignId) {
      if (eventType === 'DELIVERED') {
        await db.broadcastCampaign.update({
          where: { id: campaignId },
          data: { delivered: { increment: 1 } },
        });
      } else if (eventType === 'OPEN') {
        await db.broadcastCampaign.update({
          where: { id: campaignId },
          data: { read: { increment: 1 } },
        });
      } else if (eventType === 'CLICK') {
        await db.broadcastCampaign.update({
          where: { id: campaignId },
          data: { replied: { increment: 1 } }, // tracked as engagement/click
        });
      } else if (eventType === 'BOUNCE_HARD') {
        await db.broadcastCampaign.update({
          where: { id: campaignId },
          data: { failed: { increment: 1 } },
        });
      } else if (eventType === 'UNSUBSCRIBE' || eventType === 'COMPLAINT') {
        await db.broadcastCampaign.update({
          where: { id: campaignId },
          data: { optedOut: { increment: 1 } },
        });
      }
    }

    // 4. Handle Compliance Suppression & Auto-Pause Circuit Breaker
    if (eventType === 'BOUNCE_HARD') {
      await EmailSuppressionService.suppressEmail(tenantId, cleanEmail, 'HARD_BOUNCE');
    } else if (eventType === 'COMPLAINT') {
      await EmailSuppressionService.suppressEmail(tenantId, cleanEmail, 'COMPLAINT');

      // Check complaint rate circuit breaker (warn at 0.1%, auto-pause at 0.3%)
      const totalSent = await db.emailEvent.count({
        where: { tenantId, eventType: 'DELIVERED' },
      });
      const totalComplaints = await db.emailEvent.count({
        where: { tenantId, eventType: 'COMPLAINT' },
      });

      if (totalSent > 50) {
        const rate = (totalComplaints / totalSent) * 100;
        await db.tenantEmailConfig.updateMany({
          where: { tenantId },
          data: {
            complaintRate: Number(rate.toFixed(3)),
            isAutoPaused: rate >= 0.3,
          },
        });
      }
    } else if (eventType === 'UNSUBSCRIBE') {
      await EmailSuppressionService.suppressEmail(tenantId, cleanEmail, 'MANUAL_UNSUBSCRIBE');
    }

    // 5. Write event to Contact Timeline (Message table) for Unified Inbox & Timeline
    if (targetCustomerId) {
      let conversation = await db.conversation.findFirst({
        where: { tenantId, customerId: targetCustomerId, channel: 'EMAIL' },
      });

      if (!conversation) {
        conversation = await db.conversation.create({
          data: {
            tenantId,
            customerId: targetCustomerId,
            channel: 'EMAIL',
            status: 'OPEN',
          },
        });
      }

      let timelineText = '';
      if (eventType === 'OPEN') timelineText = `📬 Contact opened email (approximate)`;
      else if (eventType === 'CLICK') timelineText = `🖱️ Contact clicked link: ${url || 'campaign URL'}`;
      else if (eventType === 'BOUNCE_HARD') timelineText = `⚠️ Email bounced permanently (Hard Bounce). Contact auto-suppressed.`;
      else if (eventType === 'COMPLAINT') timelineText = `🚫 Spam complaint reported. Contact auto-suppressed.`;
      else if (eventType === 'UNSUBSCRIBE') timelineText = `🔕 Contact unsubscribed via One-Click / RFC 8058.`;

      if (timelineText) {
        await db.message.create({
          data: {
            tenantId,
            conversationId: conversation.id,
            direction: 'INBOUND',
            senderType: 'BOT',
            content: timelineText,
            channel: 'EMAIL',
          },
        });
      }
    }
  }
}
