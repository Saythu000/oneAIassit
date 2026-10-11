import { NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenant';
import { getTenantPrisma } from '@/lib/db';
import { normalizePhoneNumber } from '@/whatsapp-engine/agents/IdentityResolver';

export async function POST(req: Request) {
  try {
    const { tenantId, role } = await getTenantContext();
    const db = getTenantPrisma(tenantId, role);

    const body = await req.json();
    const { rows, consentConfirmed } = body;

    // Strict compliance check
    if (!consentConfirmed) {
      return NextResponse.json({
        error: 'Consent declaration required: You must confirm that these contacts explicitly opted in to receive marketing communications.',
      }, { status: 400 });
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No contact rows provided for import.' }, { status: 400 });
    }

    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const errors: Array<{ row: number; error: string }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rawName = (row.name || row.displayName || row.fullName || '').trim();
      const rawPhone = (row.phone || row.primaryPhone || row.mobile || '').trim();
      const rawEmail = (row.email || row.mail || '').trim().toLowerCase();
      const rawTags = Array.isArray(row.tags) ? row.tags : (row.tags ? String(row.tags).split(',').map(t => t.trim()) : []);

      if (!rawPhone && !rawEmail) {
        errors.push({ row: i + 1, error: 'Row has neither phone nor email.' });
        skippedCount++;
        continue;
      }

      const normalizedPhone = rawPhone ? normalizePhoneNumber(rawPhone) : `temp_em_${Date.now()}_${i}`;
      const displayName = rawName || (rawEmail ? rawEmail.split('@')[0] : `Contact ${normalizedPhone.slice(-4)}`);

      try {
        // Find existing customer by phone or email
        const existing = await db.customer.findFirst({
          where: {
            tenantId,
            OR: [
              ...(rawEmail ? [{ email: rawEmail }] : []),
              ...(rawPhone ? [{ primaryPhone: normalizedPhone }] : []),
            ],
          },
        });

        if (existing) {
          // Merge tags and update email if missing
          const mergedTags = Array.from(new Set([...existing.tags, ...rawTags]));
          await db.customer.update({
            where: { id: existing.id },
            data: {
              displayName: existing.displayName || displayName,
              email: existing.email || rawEmail || null,
              emailConsentStatus: existing.emailConsentStatus === 'UNSUBSCRIBED' ? 'UNSUBSCRIBED' : 'SUBSCRIBED',
              emailConsentSource: existing.emailConsentSource || 'CSV_IMPORT',
              emailConsentTimestamp: existing.emailConsentTimestamp || new Date(),
              tags: mergedTags,
            },
          });
          updatedCount++;
        } else {
          // Create new customer
          const newCust = await db.customer.create({
            data: {
              tenantId,
              displayName,
              primaryPhone: normalizedPhone,
              email: rawEmail || null,
              optedIn: true,
              optedInAt: new Date(),
              emailConsentStatus: 'SUBSCRIBED',
              emailConsentSource: 'CSV_IMPORT',
              emailConsentTimestamp: new Date(),
              tags: rawTags,
              customerChannels: {
                create: [
                  ...(rawPhone ? [{
                    tenantId,
                    channel: 'WHATSAPP' as const,
                    channelIdentifier: normalizedPhone,
                    channelMetadata: {},
                  }] : []),
                  ...(rawEmail ? [{
                    tenantId,
                    channel: 'EMAIL' as const,
                    channelIdentifier: rawEmail,
                    channelMetadata: {},
                  }] : []),
                ],
              },
            },
          });
          importedCount++;
        }
      } catch (rowErr: any) {
        errors.push({ row: i + 1, error: rowErr.message });
        skippedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      imported: importedCount,
      updated: updatedCount,
      skipped: skippedCount,
      errors: errors.slice(0, 10), // return first 10 errors for feedback
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Import failed' }, { status: 500 });
  }
}
