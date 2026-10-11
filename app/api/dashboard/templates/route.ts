import { NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenant';
import { getTenantPrisma } from '@/lib/db';

export async function GET() {
  try {
    const { tenantId, role } = await getTenantContext();
    const db = getTenantPrisma(tenantId, role);

    const templates = await db.template.findMany({
      where: { tenantId },
      select: {
        id: true,
        tenantId: true,
        name: true,
        category: true,
        channel: true,
        language: true,
        subject: true,
        previewText: true,
        htmlBody: true,
        plainText: true,
        jsonDesign: true,
        body: true,
        content: true,
        header: true,
        footer: true,
        ctaButtons: true,
        status: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(templates);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unauthorized';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId, role } = await getTenantContext();
    const db = getTenantPrisma(tenantId, role);

    const body = await req.json();
    const {
      name,
      channel = 'WHATSAPP',
      category,
      language,
      body: templateBody,
      subject,
      previewText,
      htmlBody,
      plainText,
      jsonDesign,
      header,
      footer,
      ctaButtons,
      status,
    } = body;

    if (!name || (!templateBody && !htmlBody)) {
      return NextResponse.json({ error: 'Name and template body content are required' }, { status: 400 });
    }

    const finalHtml = htmlBody || templateBody || '';
    const finalPlain = plainText || (finalHtml ? finalHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '');

    const template = await db.template.create({
      data: {
        tenantId,
        name,
        channel: channel as any,
        category: category || 'MARKETING',
        language: language || 'en',
        subject: subject || null,
        previewText: previewText || null,
        htmlBody: finalHtml || null,
        plainText: finalPlain || null,
        jsonDesign: jsonDesign || null,
        body: templateBody || finalPlain || '',
        content: templateBody || finalPlain || '', // keep content in sync
        header: header || null,
        footer: footer || null,
        ctaButtons: ctaButtons || null,
        status: status || 'APPROVED',
      },
    });

    return NextResponse.json(template);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
