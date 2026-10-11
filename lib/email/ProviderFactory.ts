import { getTenantPrisma } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { IEmailProviderAdapter, EmailProviderCredentials } from './types';
import { ResendProviderAdapter } from './adapters/ResendProviderAdapter';
import { AmazonSESAdapter } from './adapters/AmazonSESAdapter';
import { SendGridAdapter } from './adapters/SendGridAdapter';
import { SmtpProviderAdapter } from './adapters/SmtpProviderAdapter';

export class ProviderFactory {
  private static resendAdapter = new ResendProviderAdapter();
  private static sesAdapter = new AmazonSESAdapter();
  private static sendGridAdapter = new SendGridAdapter();
  private static smtpAdapter = new SmtpProviderAdapter();

  static getAdapter(providerName: string = 'RESEND'): IEmailProviderAdapter {
    const normalized = providerName.toUpperCase();
    if (normalized === 'SES' || normalized === 'AMAZON_SES') return this.sesAdapter;
    if (normalized === 'SENDGRID') return this.sendGridAdapter;
    if (normalized === 'SMTP') return this.smtpAdapter;
    return this.resendAdapter;
  }

  static async getTenantCredentials(tenantId: string): Promise<{ adapter: IEmailProviderAdapter; creds: EmailProviderCredentials; config: any }> {
    const db = getTenantPrisma(tenantId, 'ADMIN');
    const config = await db.tenantEmailConfig.findUnique({
      where: { tenantId },
    });

    if (!config) {
      // Fallback to platform-level env configuration
      const fallbackApiKey = process.env.RESEND_API_KEY || process.env.EMAIL_API_KEY || 'mock_email_key';
      const fromName = process.env.DEFAULT_FROM_NAME || 'OneAIAssist Care';
      const fromEmail = process.env.DEFAULT_FROM_EMAIL || 'notifications@oneaiassist.com';

      return {
        adapter: this.resendAdapter,
        creds: {
          apiKey: fallbackApiKey,
          fromName,
          fromEmail,
        },
        config: null,
      };
    }

    let apiKey = '';
    if (config.encryptedApiKey) {
      try {
        apiKey = decrypt(config.encryptedApiKey);
      } catch (err) {
        console.error(`[ProviderFactory] Decryption failed for tenant ${tenantId} email API key:`, err);
        apiKey = config.encryptedApiKey; // Fallback in case raw key was passed in testing
      }
    }

    const adapter = this.getAdapter(config.provider);
    return {
      adapter,
      creds: {
        apiKey,
        fromName: config.fromName,
        fromEmail: config.fromEmail,
        replyToEmail: config.replyToEmail,
      },
      config,
    };
  }
}
