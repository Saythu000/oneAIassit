import { NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenant';
import { getTenantPrisma } from '@/lib/db';
import { encrypt, decrypt } from '@/lib/encryption';

export async function GET() {
  try {
    const { tenantId, role } = await getTenantContext();
    const db = getTenantPrisma(tenantId, role);

    const config = await db.tenantEmailConfig.findUnique({
      where: { tenantId },
    });

    if (!config) {
      return NextResponse.json({
        configured: false,
        provider: 'RESEND',
        fromName: 'Apex Insurance',
        fromEmail: 'care@apexinsurance.com',
        replyToEmail: '',
        dailySendQuota: 1000,
        hourlySendRate: 100,
        complaintRate: 0.0,
        isAutoPaused: false,
      });
    }

    let maskedKey = '••••••••••••••••';
    try {
      const dec = decrypt(config.encryptedApiKey);
      maskedKey = dec.length > 8 ? `${dec.slice(0, 4)}••••${dec.slice(-4)}` : '••••••••';
    } catch {}

    return NextResponse.json({
      configured: true,
      provider: config.provider,
      apiKeyMasked: maskedKey,
      fromName: config.fromName,
      fromEmail: config.fromEmail,
      replyToEmail: config.replyToEmail || '',
      dailySendQuota: config.dailySendQuota,
      hourlySendRate: config.hourlySendRate,
      complaintRate: config.complaintRate,
      isAutoPaused: config.isAutoPaused,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unauthorized' }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId, role } = await getTenantContext();
    if (role !== 'ADMIN' && role !== 'PLATFORM_OWNER') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const db = getTenantPrisma(tenantId, role);
    const body = await req.json();
    const { provider, apiKey, fromName, fromEmail, replyToEmail, dailySendQuota, hourlySendRate } = body;

    if (!fromName || !fromEmail) {
      return NextResponse.json({ error: 'Sender name and email are required' }, { status: 400 });
    }

    // Encrypt apiKey if a new one is provided
    let encryptedKey: string | undefined;
    if (apiKey && !apiKey.includes('••••')) {
      encryptedKey = encrypt(apiKey.trim());
    }

    const existing = await db.tenantEmailConfig.findUnique({ where: { tenantId } });

    const finalKey = encryptedKey || existing?.encryptedApiKey;
    if (!finalKey) {
      return NextResponse.json({ error: 'Provider API key is required' }, { status: 400 });
    }

    const updated = await db.tenantEmailConfig.upsert({
      where: { tenantId },
      update: {
        provider: provider || 'RESEND',
        encryptedApiKey: finalKey,
        fromName,
        fromEmail,
        replyToEmail: replyToEmail || null,
        dailySendQuota: dailySendQuota ? Number(dailySendQuota) : undefined,
        hourlySendRate: hourlySendRate ? Number(hourlySendRate) : undefined,
      },
      create: {
        tenantId,
        provider: provider || 'RESEND',
        encryptedApiKey: finalKey,
        fromName,
        fromEmail,
        replyToEmail: replyToEmail || null,
        dailySendQuota: dailySendQuota ? Number(dailySendQuota) : 1000,
        hourlySendRate: hourlySendRate ? Number(hourlySendRate) : 100,
      },
    });

    return NextResponse.json({
      success: true,
      config: {
        provider: updated.provider,
        fromName: updated.fromName,
        fromEmail: updated.fromEmail,
        replyToEmail: updated.replyToEmail,
      },
    });
  } catch (err: any) {
    console.error('[EmailConfig Error]:', err);
    const status = err.message?.includes('Unauthorized') || err.message?.includes('No active session') ? 401 : 500;
    return NextResponse.json({ error: err.message || 'Internal error' }, { status });
  }
}
