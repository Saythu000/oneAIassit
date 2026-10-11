import { NextResponse } from 'next/server';
import { EmailTrackingService } from '@/lib/email/tracking';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const data = searchParams.get('d');
    const signature = searchParams.get('s');

    if (!data || !signature) {
      return NextResponse.redirect(new URL('/', req.url));
    }

    const decoded = EmailTrackingService.decodeTrackingPayload(data, signature);

    if (!decoded.valid || !decoded.data || !decoded.data.targetUrl) {
      return NextResponse.redirect(new URL('/', req.url));
    }

    const { tenantId, campaignId, customerId, targetUrl } = decoded.data;

    // Asynchronously record click event and update campaign analytics
    EmailTrackingService.recordEmailEvent({
      tenantId,
      email: customerId ? `cust_${customerId}` : 'unknown',
      eventType: 'CLICK',
      customerId,
      campaignId,
      url: targetUrl,
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    }).catch((err) => console.error('[Tracking Click] Event log error:', err));

    // Redirect to the target URL with UTM parameters
    return NextResponse.redirect(new URL(targetUrl, req.url));
  } catch (err) {
    return NextResponse.redirect(new URL('/', req.url));
  }
}
