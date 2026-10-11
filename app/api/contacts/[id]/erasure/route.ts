import { NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenant';
import { getTenantPrisma } from '@/lib/db';
import { EmailSuppressionService } from '@/lib/email/suppression';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { tenantId, role } = await getTenantContext();
    if (role !== 'ADMIN' && role !== 'PLATFORM_OWNER') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const db = getTenantPrisma(tenantId, role);
    const customerId = params.id;

    const customer = await db.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer || customer.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // 1. If email existed, suppress it permanently so marketing never reaches them again
    if (customer.email) {
      await EmailSuppressionService.suppressEmail(tenantId, customer.email, 'MANUAL_UNSUBSCRIBE');
    }

    // 2. Anonymize customer data (Right to Erasure compliance)
    await db.customer.update({
      where: { id: customerId },
      data: {
        displayName: 'Anonymized Contact',
        primaryPhone: `erased_${Date.now()}`,
        email: null,
        optedIn: false,
        optedOutAt: new Date(),
        emailConsentStatus: 'UNSUBSCRIBED',
        tags: [],
        location: null,
        consentIp: null,
      },
    });

    // 3. Clear customer channels
    await db.customerChannel.deleteMany({
      where: { customerId, tenantId },
    });

    return NextResponse.json({
      success: true,
      message: 'Contact successfully erased and anonymized in compliance with GDPR / DPDP.',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erasure failed' }, { status: 500 });
  }
}
