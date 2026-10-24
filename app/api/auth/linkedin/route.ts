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

    const clientId = process.env.NEXT_PUBLIC_LINKEDIN_CLIENT_ID || process.env.LINKEDIN_CLIENT_ID;
    if (!clientId) {
      return new NextResponse(
        `<html><body><script>
          alert("LinkedIn Client ID is not configured! Please add NEXT_PUBLIC_LINKEDIN_CLIENT_ID to your .env file.");
          window.close();
        </script></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    const originHost = request.headers.get('host') || 'localhost:3000';
    const protocol = request.headers.get('x-forwarded-proto') || (originHost.includes('localhost') ? 'http' : 'https');
    const redirectUri = `${protocol}://${originHost}/api/auth/linkedin/callback`;

    // Create state containing tenantId and a random CSRF nonce
    const nonce = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const statePayload = JSON.stringify({ tenantId, nonce });
    const state = Buffer.from(statePayload).toString('base64url');

    // Scopes for OpenID profile discovery and posting
    const scopes = ['openid', 'profile', 'email', 'w_member_social'];

    const liAuthUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&state=${state}&scope=${encodeURIComponent(scopes.join(' '))}`;

    return NextResponse.redirect(liAuthUrl);
  } catch (err: any) {
    return new NextResponse(`Error initializing LinkedIn authorization: ${err?.message}`, { status: 500 });
  }
}
