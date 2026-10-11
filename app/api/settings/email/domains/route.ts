import { NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenant';
import { getTenantPrisma } from '@/lib/db';
import { DomainVerificationService } from '@/lib/email/domainVerification';

export async function GET() {
  try {
    const { tenantId, role } = await getTenantContext();
    const db = getTenantPrisma(tenantId, role);

    const domains = await db.tenantSendingDomain.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(domains);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unauthorized' }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId, role } = await getTenantContext();
    if (role !== 'ADMIN' && role !== 'PLATFORM_OWNER') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { domain } = body;

    if (!domain || !domain.includes('.')) {
      return NextResponse.json({ error: 'Valid domain name required (e.g. yourcompany.com)' }, { status: 400 });
    }

    const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    const result = await DomainVerificationService.registerDomain(tenantId, cleanDomain);

    return NextResponse.json({ success: true, domain: result });
  } catch (err: any) {
    console.error('[EmailDomain Error]:', err);
    const status = err.message?.includes('Unauthorized') || err.message?.includes('No active session') ? 401 : 500;
    return NextResponse.json({ error: err.message || 'Registration failed' }, { status });
  }
}
