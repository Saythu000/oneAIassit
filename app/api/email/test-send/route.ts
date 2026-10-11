import { NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenant';
import { getTenantPrisma } from '@/lib/db';
import { EmailTemplateEngine } from '@/lib/email/templateEngine';
import { ProviderFactory } from '@/lib/email/ProviderFactory';

export async function POST(req: Request) {
  try {
    const { tenantId, role } = await getTenantContext();
    const db = getTenantPrisma(tenantId, role);

    const body = await req.json();
    const {
      recipientEmail,
      subject,
      htmlBody,
      previewText,
      templateId,
    } = body;

    if (!recipientEmail || !recipientEmail.includes('@')) {
      return NextResponse.json(
        { error: 'Valid recipient email address is required.' },
        { status: 400 }
      );
    }

    let finalSubject = subject;
    let finalHtml = htmlBody;

    // If templateId provided, load template from DB
    if (templateId) {
      const template = await db.template.findUnique({
        where: { id: templateId, tenantId },
      });
      if (!template) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }
      finalSubject = finalSubject || template.subject || template.name;
      finalHtml = finalHtml || template.htmlBody || template.body;
    }

    if (!finalSubject || !finalHtml) {
      return NextResponse.json(
        { error: 'Email subject and HTML body content are required.' },
        { status: 400 }
      );
    }

    // 1. Run Pre-Send Deliverability Checklist
    const preSendCheck = EmailTemplateEngine.validatePreSend({
      subject: finalSubject,
      htmlBody: finalHtml,
    });

    // 2. Render personalization test variables
    const sampleContext = {
      first_name: 'Alex',
      last_name: 'Taylor',
      name: 'Alex Taylor',
      email: recipientEmail,
      company: 'Acme Corp',
      policy_number: 'POL-99214',
      unsubscribe_url: `https://${req.headers.get('host') || 'localhost:3000'}/unsubscribe?demo=test`,
      sender_address: '100 Innovation Way, Suite 400, San Francisco, CA 94107',
    };

    const renderedSubject = `[TEST SEND] ${EmailTemplateEngine.render(finalSubject, sampleContext)}`;
    const renderedHtml = EmailTemplateEngine.render(finalHtml, sampleContext);
    const plainText = EmailTemplateEngine.htmlToPlainText(renderedHtml);

    // 3. Resolve active tenant email config
    const emailConfig = await db.tenantEmailConfig.findUnique({
      where: { tenantId },
    });

    if (!emailConfig) {
      return NextResponse.json(
        {
          error: 'Email channel is not configured. Please add provider credentials under Settings > Channels > Email Marketing first.',
        },
        { status: 400 }
      );
    }

    const { adapter, creds } = await ProviderFactory.getTenantCredentials(tenantId);

    const fromAddress = `${creds.fromName || 'OneAI Support'} <${creds.fromEmail}>`;

    const sendResult = await adapter.send({
      from: fromAddress,
      to: recipientEmail,
      subject: renderedSubject,
      html: renderedHtml,
      text: plainText,
      replyTo: emailConfig.replyToEmail || undefined,
      headers: {
        'X-OneAI-Test-Send': 'true',
      },
    }, creds);

    if (sendResult.status !== 'SENT') {
      return NextResponse.json(
        {
          success: false,
          status: sendResult.status,
          error: sendResult.error || 'Failed to dispatch test email via provider',
          preSendCheck,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      status: 'SENT',
      messageId: sendResult.messageId,
      preSendCheck,
      rendered: {
        subject: renderedSubject,
        recipient: recipientEmail,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
