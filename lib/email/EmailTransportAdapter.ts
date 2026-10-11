import { IMessageTransport, SendResult } from '@/whatsapp-engine/transport/IMessageTransport';
import { ProviderFactory } from './ProviderFactory';
import { EmailSuppressionService } from './suppression';
import { getTenantPrisma } from '@/lib/db';

export class EmailTransportAdapter implements IMessageTransport {
  constructor(private readonly tenantId: string) {}

  async sendText(to: string, text: string): Promise<SendResult> {
    const cleanEmail = to.trim().toLowerCase();

    // 1. Send-Time Suppression Check (Mandatory Compliance)
    const suppression = await EmailSuppressionService.isEmailSuppressed(this.tenantId, cleanEmail);
    if (suppression.suppressed) {
      throw new Error(`Email delivery blocked: Recipient ${cleanEmail} is suppressed (${suppression.reason}).`);
    }

    // 2. Resolve Tenant Email Credentials & Config
    const { adapter, creds, config } = await ProviderFactory.getTenantCredentials(this.tenantId);

    // 3. Deliverability Auto-Pause Circuit Breaker
    if (config?.isAutoPaused) {
      throw new Error(`Email delivery auto-paused for tenant ${this.tenantId}: High complaint rate (${config.complaintRate}%). Sending halted.`);
    }

    // 4. Construct Email Payload with RFC 8058 List-Unsubscribe headers & Open Pixel
    const appUrl = process.env.NEXTAUTH_URL || 'https://oneai.drgodly.com';
    const unsubUrl = `${appUrl}/api/channels/email/unsubscribe?email=${encodeURIComponent(cleanEmail)}&tenantId=${this.tenantId}`;
    const { EmailTrackingService } = await import('./tracking');
    const trackingPixelUrl = EmailTrackingService.generateOpenTrackingPixelUrl(appUrl, this.tenantId);

    const headers: Record<string, string> = {
      'List-Unsubscribe': `<${unsubUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    };

    // Auto-append compliant CAN-SPAM footer if plain text and invisible 1x1 tracking pixel
    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; color: #1c1b1f; line-height: 1.6;">
        <div>${text.replace(/\n/g, '<br/>')}</div>
        <hr style="margin: 32px 0 16px 0; border: none; border-top: 1px solid #e0e0e0;" />
        <footer style="font-size: 12px; color: #737686; line-height: 1.5;">
          <p style="margin: 0;">Sent by ${creds.fromName} via OneAIAssist Platform.</p>
          <p style="margin: 4px 0 0 0;">
            To stop receiving these emails, you can 
            <a href="${unsubUrl}" style="color: #004ac6; text-decoration: underline;">unsubscribe here</a>.
          </p>
        </footer>
        <img src="${trackingPixelUrl}" width="1" height="1" style="display:none !important;" alt="" />
      </div>
    `;

    const result = await adapter.send({
      to: cleanEmail,
      subject: `Message from ${creds.fromName}`,
      html: htmlBody,
      text: `${text}\n\nUnsubscribe: ${unsubUrl}`,
      headers,
    }, creds);

    if (result.status === 'FAILED') {
      throw new Error(result.error || 'Email dispatch failed via provider.');
    }

    // Record initial delivery event
    EmailTrackingService.recordEmailEvent({
      tenantId: this.tenantId,
      email: cleanEmail,
      eventType: 'DELIVERED',
      messageId: result.messageId,
    }).catch((err) => console.error('[EmailTransport] Error logging delivery event:', err));

    return { messageId: result.messageId };
  }

  async sendImage(to: string, opts: { filePath: string; caption?: string }): Promise<SendResult> {
    const text = opts.caption ? `${opts.caption}\n\n[Attached Image: ${opts.filePath}]` : `[Attached Image: ${opts.filePath}]`;
    return this.sendText(to, text);
  }

  async sendVideo(to: string, opts: { filePath: string; caption?: string }): Promise<SendResult> {
    const text = opts.caption ? `${opts.caption}\n\n[Attached Video: ${opts.filePath}]` : `[Attached Video: ${opts.filePath}]`;
    return this.sendText(to, text);
  }

  async sendAudio(to: string, opts: { filePath: string; ptt?: boolean }): Promise<SendResult> {
    return this.sendText(to, `[Voice Message Audio: ${opts.filePath}]`);
  }

  async setTyping(_to: string, _on: boolean): Promise<void> {
    // No-op for asynchronous email
  }

  async getStatus(): Promise<string> {
    const db = getTenantPrisma(this.tenantId, 'ADMIN');
    const config = await db.tenantEmailConfig.findUnique({ where: { tenantId: this.tenantId } });
    if (!config) return 'DISCONNECTED';
    if (config.isAutoPaused) return 'PAUSED';
    return 'CONNECTED';
  }

  async disconnect(): Promise<void> {
    // Stateless HTTP provider
  }
}
