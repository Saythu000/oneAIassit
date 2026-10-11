import { NextResponse } from 'next/server';
import { EmailTrackingService } from '@/lib/email/tracking';

// Transparent 1x1 GIF tracking pixel bytes
const TRANSPARENT_GIF_BUFFER = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const data = searchParams.get('d');
    const signature = searchParams.get('s');

    if (!data || !signature) {
      return new NextResponse(TRANSPARENT_GIF_BUFFER, {
        status: 200,
        headers: {
          'Content-Type': 'image/gif',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      });
    }

    const decoded = EmailTrackingService.decodeTrackingPayload(data, signature);

    if (decoded.valid && decoded.data) {
      const { tenantId, campaignId, customerId } = decoded.data;

      // Asynchronously record event so tracking response remains instantaneous
      EmailTrackingService.recordEmailEvent({
        tenantId,
        email: customerId ? `cust_${customerId}` : 'unknown',
        eventType: 'OPEN',
        customerId,
        campaignId,
        ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
        userAgent: req.headers.get('user-agent') || undefined,
      }).catch((err) => console.error('[Tracking Open] Event log error:', err));
    }

    return new NextResponse(TRANSPARENT_GIF_BUFFER, {
      status: 200,
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    });
  } catch (err) {
    return new NextResponse(TRANSPARENT_GIF_BUFFER, {
      status: 200,
      headers: { 'Content-Type': 'image/gif' },
    });
  }
}
