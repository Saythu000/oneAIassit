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

    const originHost = request.headers.get('host') || 'localhost:3000';
    const protocol = request.headers.get('x-forwarded-proto') || (originHost.includes('localhost') ? 'http' : 'https');
    const redirectUri = `${protocol}://${originHost}/api/auth/facebook/callback`;

    // State with tenantId, nonce, and target indicator
    const nonce = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const statePayload = JSON.stringify({ tenantId, nonce, target: 'instagram' });
    const state = Buffer.from(statePayload).toString('base64url');

    const scopes = [
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_posts',
      'instagram_basic',
      'instagram_content_publish',
    ];

    const fbAuthUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&scope=${scopes.join(',')}&state=${state}&response_type=code`;

    return NextResponse.redirect(fbAuthUrl);
  } catch (err: any) {
    return new NextResponse(`Error initializing Instagram authorization: ${err?.message}`, { status: 500 });
  }
}
