import { NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenant';

export async function GET(request: Request) {
  try {
    let tenantId = 'tenant_pme_ff9xl';
    try {
      const ctx = await getTenantContext();
      if (ctx?.tenantId) tenantId = ctx.tenantId;
    } catch {
      // Fallback in local/dev
    }

    const appId = process.env.NEXT_PUBLIC_META_APP_ID || process.env.META_APP_ID;
    if (!appId) {
      return new NextResponse(
        `<html><body><script>
          alert("Meta App ID is not configured! Please add NEXT_PUBLIC_META_APP_ID to your .env file.");
          window.close();
        </script></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    const { searchParams } = new URL(request.url);
    const originHost = request.headers.get('host') || 'localhost:3000';
    const protocol = request.headers.get('x-forwarded-proto') || (originHost.includes('localhost') ? 'http' : 'https');
    const redirectUri = `${protocol}://${originHost}/api/auth/facebook/callback`;

    // Create state token containing tenantId and a random CSRF nonce
    const nonce = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const statePayload = JSON.stringify({ tenantId, nonce });
    const state = Buffer.from(statePayload).toString('base64url');

    const scopes = [
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_posts',
      'instagram_basic',
      'instagram_content_publish',
    ].join(',');

    const authUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&scope=${scopes}&state=${state}&response_type=code`;

    return NextResponse.redirect(authUrl);
  } catch (err: any) {
    console.error('[Facebook OAuth Initiation Error]:', err);
    return NextResponse.json({ error: err.message || 'Failed to initiate Facebook OAuth' }, { status: 500 });
  }
}
