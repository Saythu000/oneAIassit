import { NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenant';
import { InstagramPublisher } from '@/lib/social/instagramPublisher';

export async function POST(req: Request) {
  try {
    let tenantId = 'tenant_pme_ff9xl';
    try {
      const ctx = await getTenantContext();
      if (ctx?.tenantId) tenantId = ctx.tenantId;
    } catch {
      // Development fallback
    }

    const body = await req.json();
    const { mediaType = 'FEED', mediaUrl, caption } = body;

    if (!mediaUrl) {
      return NextResponse.json({ error: 'mediaUrl is required for test publishing' }, { status: 400 });
    }

    const result = await InstagramPublisher.publishMedia(tenantId, {
      mediaType,
      mediaUrl,
      caption: caption || '⚡ Test post published via OneAIAssist Marketing Suite',
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[API /api/channels/instagram/test-post Error]:', err);
    return NextResponse.json({
      success: false,
      error: err?.message || 'Failed to publish test post',
    }, { status: 500 });
  }
}
