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

    const conn = await (db as any).platformConnection.findUnique({
      where: {
        tenantId_platform: { tenantId, platform: 'LINKEDIN' },
      },
    });

    if (conn && conn.status === 'CONNECTED') {
      let authorUrn = conn.accountName || '';
      let accountName = conn.accountName || 'LinkedIn Account';
      if (authorUrn.includes('|')) {
        const parts = authorUrn.split('|');
        authorUrn = parts[0].trim();
        accountName = parts[1].trim();
      }

      const authorType = authorUrn.includes('organization') ? 'ORGANIZATION' : 'PERSON';

      return NextResponse.json({
        connected: true,
        authorUrn,
        accountName,
        authorType,
        status: conn.status,
        createdAt: conn.connectedAt || conn.createdAt,
      });
    }

    return NextResponse.json({
      connected: false,
      authorUrn: '',
      accountName: '',
      authorType: 'ORGANIZATION',
      status: 'NOT_CONNECTED',
      createdAt: null,
    });
  } catch (err: any) {
    return NextResponse.json({
      connected: false,
      authorUrn: '',
      accountName: '',
      authorType: 'ORGANIZATION',
      status: 'NOT_CONNECTED',
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
    let { authorUrn, accountName, accessToken, authorType = 'ORGANIZATION' } = body;

    if (!authorUrn || !accessToken) {
      return NextResponse.json(
        { error: 'authorUrn and accessToken are required' },
        { status: 400 }
      );
    }

    // Format authorUrn if plain ID is provided
    if (!authorUrn.startsWith('urn:li:')) {
      if (authorType === 'ORGANIZATION') {
        authorUrn = `urn:li:organization:${authorUrn.trim()}`;
      } else {
        authorUrn = `urn:li:person:${authorUrn.trim()}`;
      }
    }

    let encryptedToken = accessToken;
    try {
      encryptedToken = encrypt(accessToken);
    } catch {
      // Fallback
    }

    const accountIdentifier = accountName ? `${authorUrn} | ${accountName}` : authorUrn;

    const connection = await (db as any).platformConnection.upsert({
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

    try {
      await (db as any).auditLog.create({
        data: {
          userId,
          tenantId,
          action: 'LINKEDIN_CHANNEL_CONNECTED',
          metadata: { authorUrn, accountName },
        },
      });
    } catch {
      // Audit log optional
    }

    return NextResponse.json({
      success: true,
      connected: true,
      authorUrn,
      accountName: accountName || 'LinkedIn Account',
      status: connection.status,
    });
  } catch (err: any) {
    console.error('[API /api/channels/linkedin POST Error]:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to save LinkedIn credentials' },
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
      where: { tenantId, platform: 'LINKEDIN' },
      data: {
        status: 'NOT_CONNECTED',
        accessToken: null,
      },
    });

    return NextResponse.json({
      success: true,
      connected: false,
      message: 'LinkedIn disconnected successfully',
    });
  } catch (err: any) {
    console.error('[API /api/channels/linkedin DELETE Error]:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to disconnect LinkedIn' },
      { status: 500 }
    );
  }
}
