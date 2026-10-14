import { NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenant';
import { LinkedinPublisher } from '@/lib/social/linkedinPublisher';

export async function GET() {
  try {
    let tenantId = 'tenant_pme_ff9xl';
    try {
      const ctx = await getTenantContext();
      if (ctx?.tenantId) tenantId = ctx.tenantId;
    } catch {
      // Development fallback
    }

    const verification = await LinkedinPublisher.verifyConnection(tenantId);
    return NextResponse.json({
      success: verification.valid,
      ...verification,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        valid: false,
        error: err?.message || 'LinkedIn verification check failed',
      },
      { status: 500 }
    );
  }
}
