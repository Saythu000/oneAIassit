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
      const msg = errorDescription || error || 'Authorization was cancelled or denied.';
      return new NextResponse(
        `<html><body style="font-family: sans-serif; padding: 30px; text-align: center; background: #fff1f2;">
          <h3 style="color: #9f1239;">Facebook Connection Cancelled</h3>
          <p style="color: #be123c;">${msg}</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'META_AUTH_ERROR', error: ${JSON.stringify(msg)} }, '*');
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
        console.warn('[Facebook Callback] State decode fallback:', e);
      }
    }

    const appId = process.env.NEXT_PUBLIC_META_APP_ID || process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;

    if (!appId || !appSecret) {
      return new NextResponse(
        `<html><body style="font-family: sans-serif; padding: 30px; text-align: center;">
          <h3 style="color: #b91c1c;">Missing Meta App Credentials</h3>
          <p>Please configure META_APP_SECRET and NEXT_PUBLIC_META_APP_ID in your server environment.</p>
        </body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    const originHost = request.headers.get('host') || 'localhost:3000';
    const protocol = request.headers.get('x-forwarded-proto') || (originHost.includes('localhost') ? 'http' : 'https');
    const redirectUri = `${protocol}://${originHost}/api/auth/facebook/callback`;

    // 1. Exchange code for Short-Lived User Access Token
    const tokenUrl = `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&client_secret=${appSecret}&code=${code}`;

    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json().catch(() => ({}));

    if (!tokenRes.ok || !tokenData.access_token) {
      const errMsg = tokenData?.error?.message || 'Failed to exchange authorization code for access token.';
      return new NextResponse(
        `<html><body style="font-family: sans-serif; padding: 30px; text-align: center; background: #fff1f2;">
          <h3 style="color: #9f1239;">Token Exchange Failed</h3>
          <p style="color: #be123c;">${errMsg}</p>
        </body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    const shortLivedToken = tokenData.access_token;

    // 2. Exchange for 60-day Long-Lived User Access Token
    const longLivedUrl = `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortLivedToken}`;
    const longLivedRes = await fetch(longLivedUrl);
    const longLivedData = await longLivedRes.json().catch(() => ({}));

    const userAccessToken = longLivedData.access_token || shortLivedToken;

    // 3. Fetch user's managed Pages with Never-Expiring Page Access Tokens
    const pagesUrl = `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,category,access_token,tasks,instagram_business_account{id,username}&access_token=${encodeURIComponent(
      userAccessToken
    )}`;

    const pagesRes = await fetch(pagesUrl);
    const pagesData = await pagesRes.json().catch(() => ({}));

    if (!pagesRes.ok || !Array.isArray(pagesData.data) || pagesData.data.length === 0) {
      return new NextResponse(
        `<html><body style="font-family: sans-serif; padding: 30px; text-align: center; background: #fffbe6;">
          <h3 style="color: #92400e;">No Facebook Pages Found</h3>
          <p style="color: #b45309;">Your Facebook user account does not administer any Facebook Pages. Please create a Page or ensure you have Admin/Editor permissions on an existing Page.</p>
          <script>
            setTimeout(() => window.close(), 4000);
          </script>
        </body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Pick the primary managed page (first page with tasks or highest priority)
    const primaryPage = pagesData.data[0];
    const pageId = primaryPage.id;
    const pageName = primaryPage.name;
    const pageAccessToken = primaryPage.access_token;

    // Encrypt the never-expiring Page Access Token
    const encryptedToken = encrypt(pageAccessToken);

    const db = getTenantPrisma(tenantId, 'ADMIN');

    // 4. Upsert PlatformConnection for FACEBOOK
    const accountIdentifier = `${pageId} | ${pageName}`;
    await (db as any).platformConnection.upsert({
      where: {
        tenantId_platform: { tenantId, platform: 'FACEBOOK' },
      },
      update: {
        status: 'CONNECTED',
        accountName: accountIdentifier,
        accessToken: encryptedToken,
        connectedAt: new Date(),
      },
      create: {
        tenantId,
        platform: 'FACEBOOK',
        status: 'CONNECTED',
        accountName: accountIdentifier,
        accessToken: encryptedToken,
        connectedAt: new Date(),
      },
    });

    // 5. If this Facebook Page is linked to an Instagram Business account, auto-sync Instagram!
    let connectedInstagram = false;
    let igUsername = '';
    if (primaryPage.instagram_business_account?.id) {
      const igId = primaryPage.instagram_business_account.id;
      igUsername = primaryPage.instagram_business_account.username || pageName;
      try {
        await (db as any).instagramAccount.upsert({
          where: { tenantId },
          update: {
            instagramId: igId,
            username: igUsername,
            pageId,
            pageAccessToken: encryptedToken,
            status: 'CONNECTED',
          },
          create: {
            tenantId,
            instagramId: igId,
            username: igUsername,
            pageId,
            pageAccessToken: encryptedToken,
            status: 'CONNECTED',
          },
        });
        connectedInstagram = true;
      } catch (igSyncErr) {
        console.warn('[Facebook Callback] Instagram auto-link skipped:', igSyncErr);
      }
    }

    // 6. Return friendly success page with postMessage to update parent window
    return new NextResponse(
      `<!DOCTYPE html>
      <html>
        <head>
          <title>Facebook Connected Successfully</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f0fdf4; }
            .card { background: white; padding: 32px; border-radius: 16px; border: 1px solid #bbf7d0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); text-align: center; max-width: 420px; }
            h2 { color: #166534; margin: 0 0 8px; font-size: 20px; }
            p { color: #15803d; margin: 0 0 16px; font-size: 14px; }
            .sub { color: #6b7280; font-size: 12px; }
            .badge { display: inline-block; background: #dcfce7; color: #166534; font-weight: bold; padding: 4px 12px; border-radius: 9999px; margin-bottom: 12px; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="badge">✓ OAuth 2.0 Verified</div>
            <h2>Facebook Page Connected!</h2>
            <p>Page: <strong>${pageName}</strong></p>
            ${connectedInstagram ? `<p style="font-size: 12px; color: #7e22ce;">Linked Instagram Account (<strong>@${igUsername}</strong>) was also connected automatically!</p>` : ''}
            <div class="sub">Closing window and updating dashboard...</div>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: 'META_AUTH_SUCCESS',
                pageId: ${JSON.stringify(pageId)},
                pageName: ${JSON.stringify(pageName)},
                hasInstagram: ${connectedInstagram}
              }, '*');
            }
            setTimeout(() => {
              window.close();
            }, 1200);
          </script>
        </body>
      </html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  } catch (err: any) {
    console.error('[Facebook OAuth Callback Fatal Error]:', err);
    return new NextResponse(
      `<html><body style="font-family: sans-serif; padding: 30px; text-align: center; background: #fff1f2;">
        <h3 style="color: #9f1239;">Authentication Exception</h3>
        <p style="color: #be123c;">${err.message || 'An unexpected error occurred during Facebook connection.'}</p>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
}
