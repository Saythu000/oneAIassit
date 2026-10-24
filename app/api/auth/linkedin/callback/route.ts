import { NextResponse } from 'next/server';
import { getTenantPrisma } from '@/lib/db';
import { encrypt } from '@/lib/encryption';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (error || !code) {
      const msg = errorDescription || error || 'LinkedIn authorization was cancelled or denied.';
      return new NextResponse(
        `<html><body style="font-family: sans-serif; padding: 30px; text-align: center; background: #fff1f2;">
          <h3 style="color: #9f1239;">LinkedIn Connection Cancelled</h3>
          <p style="color: #be123c;">${msg}</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'LINKEDIN_AUTH_ERROR', error: ${JSON.stringify(msg)} }, '*');
            }
            setTimeout(() => window.close(), 2500);
          </script>
        </body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Decode state
    let tenantId = 'tenant_pme_ff9xl';
    if (state) {
      try {
        const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
        if (decoded.tenantId) tenantId = decoded.tenantId;
      } catch (e) {
        console.warn('[LinkedIn Callback] State decode fallback:', e);
      }
    }

    const clientId = process.env.NEXT_PUBLIC_LINKEDIN_CLIENT_ID || process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return new NextResponse(
        `<html><body style="font-family: sans-serif; padding: 30px; text-align: center;">
          <h3 style="color: #b91c1c;">Missing LinkedIn App Credentials</h3>
          <p>Please configure LINKEDIN_CLIENT_SECRET and NEXT_PUBLIC_LINKEDIN_CLIENT_ID in your server environment.</p>
        </body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    const originHost = request.headers.get('host') || 'localhost:3000';
    const protocol = request.headers.get('x-forwarded-proto') || (originHost.includes('localhost') ? 'http' : 'https');
    const redirectUri = `${protocol}://${originHost}/api/auth/linkedin/callback`;

    // 1. Exchange authorization code for Access Token
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString(),
    });

    const tokenData = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenData.access_token) {
      const errMsg = tokenData.error_description || tokenData.error || 'Failed to exchange token with LinkedIn.';
      return new NextResponse(
        `<html><body style="font-family: sans-serif; padding: 30px; text-align: center; background: #fff1f2;">
          <h3 style="color: #9f1239;">LinkedIn Token Exchange Failed</h3>
          <p style="color: #be123c;">${errMsg}</p>
        </body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    const accessToken = tokenData.access_token;

    // 2. Query LinkedIn UserInfo via OpenID Connect endpoint
    const userRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const userData = await userRes.json().catch(() => ({}));

    const personSub = userData.sub || '';
    const authorUrn = personSub ? `urn:li:person:${personSub}` : '';
    const profileName = userData.name || userData.given_name || 'LinkedIn Member';
    const profileEmail = userData.email || '';

    // 3. Encrypt the Access Token
    let encryptedToken = accessToken;
    try {
      encryptedToken = encrypt(accessToken);
    } catch {
      // Fallback
    }

    const db = getTenantPrisma(tenantId, 'ADMIN');

    // 4. Upsert PlatformConnection for LINKEDIN
    const accountIdentifier = authorUrn ? `${authorUrn} | ${profileName}` : profileName;
    await (db as any).platformConnection.upsert({
      where: {
        tenantId_platform: { tenantId, platform: 'LINKEDIN' },
      },
      update: {
        status: 'CONNECTED',
        accountName: accountIdentifier,
        accessToken: encryptedToken,
        connectedAt: new Date(),
      },
      create: {
        tenantId,
        platform: 'LINKEDIN',
        status: 'CONNECTED',
        accountName: accountIdentifier,
        accessToken: encryptedToken,
        connectedAt: new Date(),
      },
    });

    // 5. Return success page with postMessage to update parent window
    return new NextResponse(
      `<!DOCTYPE html>
      <html>
        <head>
          <title>LinkedIn Connected Successfully</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f0f7ff; }
            .card { background: white; padding: 32px; border-radius: 16px; border: 1px solid #bfdbfe; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); text-align: center; max-width: 440px; }
            h2 { color: #1e40af; margin: 0 0 8px; font-size: 20px; }
            p { color: #374151; margin: 0 0 16px; font-size: 14px; }
            .sub { color: #6b7280; font-size: 12px; }
            .badge { display: inline-block; background: #dbeafe; color: #1e40af; font-weight: bold; padding: 4px 12px; border-radius: 9999px; margin-bottom: 12px; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="badge">✓ LinkedIn OAuth 2.0 Verified</div>
            <h2>LinkedIn Connected!</h2>
            <p>Profile: <strong>${profileName}</strong> ${profileEmail ? `<span style="color:#6b7280">(${profileEmail})</span>` : ''}</p>
            <p style="font-size: 12px; color: #0284c7; font-family: monospace;">URN: ${authorUrn}</p>
            <div class="sub">Closing window and updating dashboard...</div>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: 'LINKEDIN_AUTH_SUCCESS',
                authorUrn: ${JSON.stringify(authorUrn)},
                name: ${JSON.stringify(profileName)},
                email: ${JSON.stringify(profileEmail)}
              }, '*');
            }
            setTimeout(() => {
              window.close();
            }, 1400);
          </script>
        </body>
      </html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  } catch (err: any) {
    console.error('[LinkedIn OAuth Callback Fatal Error]:', err);
    return new NextResponse(
      `<html><body style="font-family: sans-serif; padding: 30px; text-align: center; background: #fff1f2;">
        <h3 style="color: #9f1239;">Authentication Exception</h3>
        <p style="color: #be123c;">${err.message || 'An unexpected error occurred during LinkedIn connection.'}</p>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
}
