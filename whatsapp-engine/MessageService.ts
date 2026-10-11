import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getTenantPrisma } from '../lib/db/index';
import { TransportManager } from './transport/TransportManager';
import { decrypt } from '../lib/encryption';

const pexecFile = promisify(execFile);

/**
 * Transcodes browser webm audio recordings or generic audio files to native WhatsApp ogg/opus using FFmpeg.
 */
export async function transcodeAudioForWhatsApp(srcFilePath: string): Promise<string> {
  if (!fs.existsSync(srcFilePath)) return srcFilePath;

  const outFilePath = `${srcFilePath}.ogg`;
  try {
    await pexecFile('ffmpeg', [
      '-y', '-loglevel', 'error',
      '-i', srcFilePath,
      '-vn', '-c:a', 'libopus', '-b:a', '64k',
      outFilePath,
    ]);
    if (fs.existsSync(outFilePath) && fs.statSync(outFilePath).size > 0) {
      console.log(`[AudioTranscoder] Successfully transcoded ${srcFilePath} to WhatsApp ogg/opus: ${outFilePath}`);
      return outFilePath;
    }
  } catch (err: any) {
    console.warn(`[AudioTranscoder] FFmpeg transcoding unavailable or failed (${err?.message || err}). Sending raw file.`);
  }

  return srcFilePath;
}

function findMediaFile(mediaId: string): string | null {
  const mediaDir = path.join(__dirname, '../public/media');
  if (!fs.existsSync(mediaDir)) return null;
  const files = fs.readdirSync(mediaDir);
  const found = files.find(f => f.startsWith(mediaId));
  return found ? path.join(mediaDir, found) : null;
}

export interface SendMessageParams {
  to: string;
  text?: string;
  mediaId?: string;
  mimeType?: string;
  clientMessageId?: string;
  conversationId: string;
}

export class MessageService {
  static async sendMessage(tenantId: string, params: SendMessageParams, io: any) {
    const db = getTenantPrisma(tenantId, 'ADMIN');

    // 1. Idempotency Check
    if (params.clientMessageId) {
      const existing = await db.message.findUnique({
        where: { clientMessageId: params.clientMessageId },
      });
      if (existing) {
        console.log(`[MessageService] Duplicate message detected for clientMessageId ${params.clientMessageId}. Returning existing.`);
        return { success: true, messageId: existing.id, duplicated: true };
      }
    }

    // 2. Resolve secure media if present
    let localFilePath: string | null = null;
    if (params.mediaId) {
      localFilePath = findMediaFile(params.mediaId);
      if (!localFilePath) {
        throw new Error(`Media asset with ID ${params.mediaId} not found.`);
      }
    }

    // 3. Decrypt recipient if encrypted, or resolve CustomerChannel channelIdentifier
    let targetPhone = params.to;

    if (targetPhone && !targetPhone.includes('@') && (targetPhone.includes(':') || targetPhone.length > 25)) {
      try {
        targetPhone = decrypt(targetPhone);
      } catch (err) {
        console.warn(`[MessageService] Phone string decryption warning for ${targetPhone}:`, err);
      }
    }

    // 4. Determine conversation channel & transport
    let convChannel = 'WHATSAPP';
    if (params.conversationId) {
      try {
        const conv = await db.conversation.findUnique({
          where: { id: params.conversationId },
          select: { channel: true, customer: { select: { email: true, primaryPhone: true } } },
        });
        if (conv?.channel) {
          convChannel = conv.channel;
        }
        if (convChannel === 'EMAIL' && conv?.customer?.email) {
          targetPhone = conv.customer.email;
        }
      } catch {}
    }

    if (params.conversationId && convChannel !== 'EMAIL') {
      try {
        const channel = await db.customerChannel.findFirst({
          where: {
            tenantId,
            channel: convChannel as any,
            customer: { conversations: { some: { id: params.conversationId } } },
          },
          include: { customer: true },
        });

        if (channel?.customer?.primaryPhone) {
          let dec = channel.customer.primaryPhone;
          if (dec.includes(':') || dec.length > 25) {
            try { dec = decrypt(dec); } catch {}
          }
          const clean = dec.replace(/[^\d]/g, '');
          if (clean.length >= 10 && clean.length <= 14) {
            targetPhone = dec;
          }
        }

        const cleanTarget = targetPhone ? targetPhone.split('@')[0].replace(/[^\d]/g, '') : '';
        if ((!cleanTarget || cleanTarget.length > 14 || cleanTarget.length < 10) && channel?.channelIdentifier) {
          targetPhone = channel.channelIdentifier;
        }
      } catch (err) {
        console.warn(`[MessageService] CustomerChannel lookup fallback for ${params.conversationId}:`, err);
      }
    }

    const transport = TransportManager.getTransport(tenantId, convChannel);
    let result: { messageId: string } = { messageId: '' };
    let messageType: 'TEXT' | 'IMAGE' | 'VIDEO' | 'OTHER' = 'TEXT';
    let sendStatus: 'SENT' | 'FAILED' = 'SENT';

    try {
      if (localFilePath && params.mimeType) {
        if (params.mimeType.startsWith('image/')) {
          result = await transport.sendImage(targetPhone, {
            filePath: localFilePath,
            caption: params.text,
          });
          messageType = 'IMAGE';
        } else if (params.mimeType.startsWith('video/')) {
          result = await transport.sendVideo(targetPhone, {
            filePath: localFilePath,
            caption: params.text,
          });
          messageType = 'VIDEO';
        } else if (params.mimeType.startsWith('audio/')) {
          const finalAudioPath = await transcodeAudioForWhatsApp(localFilePath);
          result = await transport.sendAudio(targetPhone, {
            filePath: finalAudioPath,
            ptt: true,
          });
          messageType = 'OTHER';
        } else {
          throw new Error(`Unsupported MIME type: ${params.mimeType}`);
        }
      } else {
        if (!params.text) {
          throw new Error('Message text or media is required.');
        }
        result = await transport.sendText(targetPhone, params.text);
        messageType = 'TEXT';
      }
    } catch (sendErr: any) {
      console.error(`[MessageService] Outbound transport delivery failed for target ${targetPhone}:`, sendErr);
      sendStatus = 'FAILED';
      // Re-throw so caller route receives explicit error payload
      throw sendErr;
    }

    // 5. Create database record
    const dbMessage = await db.message.create({
      data: {
        tenantId,
        conversationId: params.conversationId,
        direction: 'OUTBOUND',
        senderType: 'AGENT',
        content: params.text || '',
        channel: convChannel as any,
        channelMessageId: result.messageId || null,
        messageType,
        status: sendStatus,
        clientMessageId: params.clientMessageId || null,
        mediaId: params.mediaId || null,
        sentAt: new Date(),
      },
    });

    // 6. Update conversation timestamp
    await db.conversation.update({
      where: { id: params.conversationId },
      data: { lastMessageAt: new Date() },
    });

    // 7. Emit Socket.io update (broadcasting to tenant namespace)
    io.to(`tenant_${tenantId}`).emit('new_message', {
      conversationId: params.conversationId,
      message: {
        id: dbMessage.id,
        content: dbMessage.content,
        direction: dbMessage.direction,
        senderType: dbMessage.senderType,
        createdAt: dbMessage.createdAt.toISOString(),
        messageType: dbMessage.messageType,
        status: dbMessage.status,
      },
    });

    return { success: true, messageId: dbMessage.id };
  }
}
