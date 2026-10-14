import { NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenant';
import { LinkedinPublisher } from '@/lib/social/linkedinPublisher';

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
    const { text, mediaUrl, link, title } = body;

    const result = await LinkedinPublisher.publishPost(tenantId, {
      text: text || '⚡ Test post published via OneAIAssist Marketing Suite to LinkedIn',
      mediaUrl,
      link,
      title,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[API /api/channels/linkedin/test-post Error]:', err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Failed to publish test post to LinkedIn',
      },
      { status: 500 }
    );
  }
}
