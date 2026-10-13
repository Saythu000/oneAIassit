import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';

const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
];
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB to support high-res Reels & Videos

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File size exceeds maximum 100MB limit' }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type '${file.type}'. Only images and videos (PNG, JPG, WEBP, MP4, MOV) are allowed.` },
        { status: 400 }
      );
    }

    // 1. Ensure public upload directory exists
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'marketing');
    await fs.mkdir(uploadDir, { recursive: true });

    // 2. Sanitize and generate unique filename
    const cleanOriginalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueFilename = `${Date.now()}_${cleanOriginalName}`;
    const filePath = path.join(uploadDir, uniqueFilename);

    // 3. Write file bytes to disk
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.writeFile(filePath, buffer);

    // 4. Construct Public URL accessible to Meta Graph API
    let baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;

    if (!baseUrl) {
      const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3000';
      const proto = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
      baseUrl = `${proto}://${host}`;
    }

    // Ensure baseUrl has no trailing slash
    baseUrl = baseUrl.replace(/\/+$/, '');
    const publicUrl = `${baseUrl}/uploads/marketing/${uniqueFilename}`;

    return NextResponse.json({
      success: true,
      url: publicUrl,
      fileName: file.name,
      storedFileName: uniqueFilename,
      fileSize: file.size,
      mimeType: file.type,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to upload media file';
    console.error('[API /api/marketing/upload Error]:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
