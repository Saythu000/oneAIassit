import { NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenant';
import { getTenantPrisma } from '@/lib/db';
import { encrypt } from '@/lib/encryption';

export async function GET() {
  try {
    let tenantId = 'tenant_pme_ff9xl';
    let role = 'ADMIN';

    try {
      const ctx = await getTenantContext();
      if (ctx?.tenantId) {
        tenantId = ctx.tenantId;
        role = ctx.role;
      }
    } catch {
      // Development fallback
    }

    const db = getTenantPrisma(tenantId, role);

    // 1. Check PlatformConnection for FACEBOOK
    const conn = await (db as any).platformConnection.findUnique({
      where: {
        tenantId_platform: { tenantId, platform: 'FACEBOOK' },
      },
    });

    if (conn && conn.status === 'CONNECTED') {
      let pageId = conn.accountName || '';
      let pageName = conn.accountName || 'Facebook Page';
      if (pageId.includes('|')) {
        const parts = pageId.split('|');
        pageId = parts[0].trim();
        pageName = parts[1].trim();
      }

      return NextResponse.json({
        connected: true,
        pageId,
        pageName,
        status: conn.status,
        inheritedFromInstagram: false,
        createdAt: conn.connectedAt || conn.createdAt,
      });
    }

    // 2. Check if linked via InstagramAccount
    const igAccount = await (db as any).instagramAccount.findUnique({
      where: { tenantId },
    });

    if (igAccount && igAccount.pageId && igAccount.pageAccessToken) {
      return NextResponse.json({
        connected: true,
        pageId: igAccount.pageId,
        pageName: igAccount.username ? `${igAccount.username} (Page)` : 'Facebook Page',
        status: 'CONNECTED',
        inheritedFromInstagram: true,
        createdAt: igAccount.createdAt,
      });
    }

    return NextResponse.json({
      connected: false,
      pageId: '',
      pageName: '',
      status: 'NOT_CONNECTED',
      inheritedFromInstagram: false,
      createdAt: null,
    });
  } catch (err: any) {
    return NextResponse.json({
      connected: false,
      pageId: '',
      pageName: '',
      status: 'NOT_CONNECTED',
      inheritedFromInstagram: false,
      createdAt: null,
      error: err?.message,
    });
  }
}

export async function POST(req: Request) {
  try {
    let tenantId = 'tenant_pme_ff9xl';
    let role = 'ADMIN';
    let userId = 'usr_pme_admin';

    try {
      const ctx = await getTenantContext();
      if (ctx?.tenantId) {
        tenantId = ctx.tenantId;
        role = ctx.role;
        userId = ctx.userId;
      }
    } catch {
      // Development fallback
    }

    const db = getTenantPrisma(tenantId, role);
    const body = await req.json();
    const { pageId, pageName, pageAccessToken } = body;

    if (!pageId || !pageAccessToken) {
      return NextResponse.json(
        { error: 'pageId and pageAccessToken are required' },
        { status: 400 }
      );
    }

    let encryptedToken = pageAccessToken;
    try {
      encryptedToken = encrypt(pageAccessToken);
    } catch {
      // Fallback
    }

    const accountIdentifier = pageName ? `${pageId} | ${pageName}` : pageId;

    const connection = await (db as any).platformConnection.upsert({
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

    try {
      await (db as any).auditLog.create({
        data: {
          userId,
          tenantId,
          action: 'FACEBOOK_CHANNEL_CONNECTED',
          metadata: { pageId, pageName },
        },
      });
    } catch {
      // Audit log optional
    }

    return NextResponse.json({
      success: true,
      connected: true,
      pageId,
      pageName: pageName || 'Facebook Page',
      status: connection.status,
    });
  } catch (err: any) {
    console.error('[API /api/channels/facebook POST Error]:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to save Facebook credentials' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    let tenantId = 'tenant_pme_ff9xl';
    let role = 'ADMIN';

    try {
      const ctx = await getTenantContext();
      if (ctx?.tenantId) {
        tenantId = ctx.tenantId;
        role = ctx.role;
      }
    } catch {
      // Development fallback
    }

    const db = getTenantPrisma(tenantId, role);

    await (db as any).platformConnection.updateMany({
      where: { tenantId, platform: 'FACEBOOK' },
      data: {
        status: 'NOT_CONNECTED',
        accessToken: null,
      },
    });

    return NextResponse.json({
      success: true,
      connected: false,
      message: 'Facebook Page disconnected successfully',
    });
  } catch (err: any) {
    console.error('[API /api/channels/facebook DELETE Error]:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to disconnect Facebook' },
      { status: 500 }
    );
  }
}
