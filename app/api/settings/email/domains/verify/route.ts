import { NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenant';
import { DomainVerificationService } from '@/lib/email/domainVerification';

export async function POST(req: Request) {
  try {
    const { tenantId, role } = await getTenantContext();
    if (role !== 'ADMIN' && role !== 'PLATFORM_OWNER') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { domain } = body;

    if (!domain) {
      return NextResponse.json({ error: 'Domain name required' }, { status: 400 });
    }

    const result = await DomainVerificationService.verifyDomain(tenantId, domain.trim().toLowerCase());
    return NextResponse.json({ success: true, verification: result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Verification failed' }, { status: 500 });
  }
}
