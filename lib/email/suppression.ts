import { getTenantPrisma } from '@/lib/db';

export type SuppressionReason = 'HARD_BOUNCE' | 'COMPLAINT' | 'MANUAL_UNSUBSCRIBE' | 'ADMIN_SUPPRESSED';

export interface SuppressionCheckResult {
  suppressed: boolean;
  reason?: string;
}

export class EmailSuppressionService {
  /**
   * Check whether an email is suppressed globally for the given tenant.
   * Enforced at send-time, blocking unauthorized marketing sends.
   */
  static async isEmailSuppressed(tenantId: string, email: string): Promise<SuppressionCheckResult> {
    if (!email || !email.includes('@')) {
      return { suppressed: true, reason: 'INVALID_EMAIL_FORMAT' };
    }

    const cleanEmail = email.trim().toLowerCase();
    const db = getTenantPrisma(tenantId, 'ADMIN');

    // 1. Check GlobalSuppression table
    const suppressionRecord = await db.globalSuppression.findUnique({
      where: {
        tenantId_email: {
          tenantId,
          email: cleanEmail,
        },
      },
    });

    if (suppressionRecord) {
      return {
        suppressed: true,
        reason: suppressionRecord.reason,
      };
    }

    // 2. Check Customer record consent state
    const customer = await db.customer.findFirst({
      where: {
        tenantId,
        email: cleanEmail,
      },
      select: {
        emailConsentStatus: true,
      },
    });

    if (customer && ['UNSUBSCRIBED', 'BOUNCED', 'COMPLAINED'].includes(customer.emailConsentStatus)) {
      return {
        suppressed: true,
        reason: `CUSTOMER_${customer.emailConsentStatus}`,
      };
    }

    return { suppressed: false };
  }

  /**
   * Add an email to the suppression list and update customer consent
   */
  static async suppressEmail(tenantId: string, email: string, reason: SuppressionReason): Promise<void> {
    const cleanEmail = email.trim().toLowerCase();
    const db = getTenantPrisma(tenantId, 'ADMIN');

    // 1. Upsert GlobalSuppression
    await db.globalSuppression.upsert({
      where: {
        tenantId_email: {
          tenantId,
          email: cleanEmail,
        },
      },
      update: { reason },
      create: {
        tenantId,
        email: cleanEmail,
        reason,
      },
    });

    // 2. Update all matching customer records
    const consentStatus = reason === 'HARD_BOUNCE' ? 'BOUNCED' : (reason === 'COMPLAINT' ? 'COMPLAINED' : 'UNSUBSCRIBED');
    await db.customer.updateMany({
      where: {
        tenantId,
        email: cleanEmail,
      },
      data: {
        emailConsentStatus: consentStatus,
        optedOutAt: new Date(),
      },
    });
  }

  /**
   * Remove an email from the suppression list (e.g. admin unblock or customer re-opt-in)
   */
  static async unsuppressEmail(tenantId: string, email: string): Promise<void> {
    const cleanEmail = email.trim().toLowerCase();
    const db = getTenantPrisma(tenantId, 'ADMIN');

    await db.globalSuppression.deleteMany({
      where: {
        tenantId,
        email: cleanEmail,
      },
    });

    await db.customer.updateMany({
      where: {
        tenantId,
        email: cleanEmail,
      },
      data: {
        emailConsentStatus: 'SUBSCRIBED',
        optedOutAt: null,
      },
    });
  }
}
