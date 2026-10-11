import { NextResponse } from 'next/server';
import { EmailSuppressionService } from '@/lib/email/suppression';
import { EmailTrackingService } from '@/lib/email/tracking';
import { getTenantPrisma } from '@/lib/db';

/**
 * RFC 8058 One-Click List-Unsubscribe Endpoint
 * Accepts both GET (manual user browser visit) and POST (RFC 8058 one-click from email clients).
 */
export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');
    const tenantId = searchParams.get('tenantId');

    if (!email || !tenantId) {
      return NextResponse.json({ error: 'Missing email or tenantId' }, { status: 400 });
    }

    await EmailSuppressionService.suppressEmail(tenantId, email, 'MANUAL_UNSUBSCRIBE');

    await EmailTrackingService.recordEmailEvent({
      tenantId,
      email,
      eventType: 'UNSUBSCRIBE',
    });

    return NextResponse.json({ success: true, message: 'Unsubscribed successfully.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error processing unsubscribe';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');
    const tenantId = searchParams.get('tenantId');
    const customerId = searchParams.get('cid');

    let resolvedEmail = email;
    let resolvedTenantId = tenantId;

    if (customerId && !resolvedEmail) {
      // Find customer by ID across tenants
      const db = getTenantPrisma(tenantId || 'system', 'ADMIN');
      const customer = await db.customer.findUnique({
        where: { id: customerId },
        select: { email: true, tenantId: true },
      });
      if (customer) {
        resolvedEmail = customer.email;
        resolvedTenantId = customer.tenantId;
      }
    }

    if (resolvedEmail && resolvedTenantId) {
      await EmailSuppressionService.suppressEmail(resolvedTenantId, resolvedEmail, 'MANUAL_UNSUBSCRIBE');
      await EmailTrackingService.recordEmailEvent({
        tenantId: resolvedTenantId,
        email: resolvedEmail,
        eventType: 'UNSUBSCRIBE',
      });
    }

    // Return friendly HTML confirmation page
    return new NextResponse(
      `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Unsubscribed Successfully</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #1e293b; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: white; padding: 40px; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); max-width: 440px; text-align: center; border: 1px solid #e2e8f0; }
    h1 { font-size: 20px; font-weight: 700; color: #0f172a; margin-top: 16px; margin-bottom: 8px; }
    p { font-size: 14px; color: #64748b; line-height: 1.5; margin: 0; }
    .icon { font-size: 48px; color: #10b981; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✓</div>
    <h1>You have been unsubscribed</h1>
    <p>Your email preference has been updated immediately. You will no longer receive marketing communications from this sender.</p>
  </div>
</body>
</html>`,
      {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  } catch (err: unknown) {
    return new NextResponse('Error updating email preferences.', { status: 500 });
  }
}
