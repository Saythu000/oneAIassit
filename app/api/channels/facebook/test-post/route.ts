import { NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenant';
import { FacebookPublisher } from '@/lib/social/facebookPublisher';

export async function POST(req: Request) {
  try {
    let tenantId = 'tenant_pme_ff9xl';
    try {
      const ctx = await getTenantContext();
      if (ctx?.tenantId) tenantId = ctx.tenantId;
    } catch {
      // Development fallback
    }

    const body = await req.json().catch(() => ({}));
    const { message, mediaUrl, link, title } = body;

    const result = await FacebookPublisher.publishPost(tenantId, {
      message: message || '⚡ Test post published via OneAIAssist Marketing Suite to Facebook Page',
      mediaUrl,
      link,
      title,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[API /api/channels/facebook/test-post Error]:', err);
    return NextResponse.json({
      success: false,
      error: err?.message || 'Failed to publish test post to Facebook Page',
    }, { status: 500 });
  }
}
