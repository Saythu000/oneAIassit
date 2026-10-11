import { NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenant';
import { getTenantPrisma } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { tenantId, role } = await getTenantContext();
    const db = getTenantPrisma(tenantId, role);

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const channel = searchParams.get('channel');

    const where: any = { tenantId };

    if (channel && channel !== 'ALL') {
      where.channel = channel;
    }
    if (category && category !== 'ALL') {
      where.category = category;
    }
    if (status && status !== 'ALL') {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { body: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
      ];
    }

    const templates = await db.template.findMany({
      where,
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
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ templates });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unauthorized';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId, role } = await getTenantContext();
    const db = getTenantPrisma(tenantId, role);

    const bodyData = await req.json();
    const {
      name,
      channel = 'WHATSAPP',
      category = 'MARKETING',
      language = 'en',
      body = '',
      subject,
      previewText,
      htmlBody,
      plainText,
      jsonDesign,
      headerType = 'NONE',
      header,
      footer,
      ctaButtons,
      autoSubmit = false,
    } = bodyData;

    if (!name) {
      return NextResponse.json(
        { error: 'Template name is required.' },
        { status: 400 }
      );
    }

    if (channel === 'EMAIL' && !htmlBody && !body) {
      return NextResponse.json(
        { error: 'Email template HTML body content is required.' },
        { status: 400 }
      );
    }

    // Format name to lowercase with underscores
    const formattedName = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_');

    // Check duplicate name per tenant
    const existing = await db.template.findFirst({
      where: { tenantId, name: formattedName },
      select: { id: true, name: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: `Template with name "${formattedName}" already exists.` },
        { status: 400 }
      );
    }

    let initialStatus = 'DRAFT';

    if (autoSubmit && channel === 'WHATSAPP') {
      console.log(`[META TEMPLATE STUB] Submitting template "${formattedName}" to Meta WABA endpoint...`);
      initialStatus = 'PENDING';
    } else if (channel === 'EMAIL') {
      // Email templates don't require Meta approval; they are immediately APPROVED
      initialStatus = 'APPROVED';
    }

    const finalHtml = htmlBody || body || '';
    const finalPlain = plainText || (finalHtml ? finalHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '');

    const template = await db.template.create({
      data: {
        tenantId,
        name: formattedName,
        channel: channel as any,
        category,
        language,
        subject: subject || null,
        previewText: previewText || null,
        htmlBody: finalHtml || null,
        plainText: finalPlain || null,
        jsonDesign: jsonDesign || null,
        body: body || finalPlain || '',
        content: body || finalPlain || '',
        header,
        footer,
        ctaButtons: ctaButtons || [],
        status: initialStatus as any,
      },
    });

    return NextResponse.json({ template, success: true }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unauthorized';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
