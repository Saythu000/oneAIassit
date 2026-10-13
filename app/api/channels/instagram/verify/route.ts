import { NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenant';
import { InstagramPublisher } from '@/lib/social/instagramPublisher';

export async function GET() {
  try {
    let tenantId = 'tenant_pme_ff9xl';
    try {
      const ctx = await getTenantContext();
      if (ctx?.tenantId) tenantId = ctx.tenantId;
    } catch {
      // In development fallback
    }

    const verification = await InstagramPublisher.verifyAccount(tenantId);
    return NextResponse.json({
      success: verification.valid,
      ...verification,
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      valid: false,
      error: err?.message || 'Verification check failed',
    }, { status: 500 });
  }
}
