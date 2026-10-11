import 'dotenv/config';
import express from 'express';
import http from 'http';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import qrcode from 'qrcode';
import { setSocketIO } from './lib/socket-server';
import { getTenantPrisma, prisma } from './lib/db/index';
import { decrypt } from './lib/encryption';
import {
  connectTenant,
  sessions,
  qrCodes,
  pairingCodes,
  startInboundJobWorker,
} from './whatsapp-engine/engine-logic';
import {
  connectTenantOpenWA,
  openwaSessions,
  openwaQrCodes,
} from './whatsapp-engine/openwa-logic';
import { MessageService } from './whatsapp-engine/MessageService';
import { TransportManager } from './whatsapp-engine/transport/TransportManager';
import { enqueueInboundJob } from './whatsapp-engine/agents/IngressService';
import { createMetaWebhookRouter } from './whatsapp-engine/routes/metaWebhook';
import { createIMessageWebhookRouter } from './whatsapp-engine/routes/imessageWebhook';
import { createInstagramWebhookRouter } from './whatsapp-engine/routes/instagramWebhook';

process.on('uncaughtException', (err: any) => {
  console.warn('[Unified Server] Process exception caught:', err?.message || err);
});

process.on('unhandledRejection', (reason: any) => {
  console.warn('[Unified Server] Unhandled promise rejection caught:', reason?.message || reason);
});

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3000', 10);
const hostname = process.env.HOSTNAME || '0.0.0.0';

const nextApp = next({ dev });
const handle = nextApp.getRequestHandler();

nextApp.prepare().then(() => {
  const app = express();
  app.use(cors());

  // Scope express.json() only to Express endpoints so Next.js App Router request body streams remain undisturbed
  const expressJson = express.json();
  app.use('/api/whatsapp', expressJson);
  app.use('/api/webhook/meta', expressJson);
  app.use('/api/webhooks/imessage', expressJson);
  app.use('/api/webhooks/instagram', expressJson);

  const server = http.createServer(app);

  // Attach Socket.io to the exact same HTTP server on /socket.io
  const io = new SocketIOServer(server, {
    path: '/socket.io',
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  setSocketIO(io);

  // Socket.io room management
  io.on('connection', (socket) => {
    const tenantId = socket.handshake.query.tenantId as string;
    if (tenantId) {
      socket.join(`tenant_${tenantId}`);
      console.log(`[Socket.io] Client joined room: tenant_${tenantId}`);
    }

    socket.on('disconnect', () => {
      // Disconnected cleanly
    });
  });

  // Mount Meta, iMessage, and Instagram Webhook routers
  app.use(createMetaWebhookRouter(io));
  app.use(createIMessageWebhookRouter(io));
  app.use(createInstagramWebhookRouter(io));

  // ==========================================
  // WhatsApp Engine Direct REST Endpoints
  // ==========================================

  // Initiate WhatsApp Connection (QR or 8-digit Pairing Code)
  app.post('/api/whatsapp/connect', async (req, res) => {
    try {
      const { tenantId, engine, phoneNumber, method } = req.body;
      if (!tenantId) {
        return res.status(400).json({ error: 'tenantId is required' });
      }

      const useOpenWA = engine === 'OPENWA' || process.env.WA_ENGINE === 'OPENWA';
      const db = getTenantPrisma(tenantId, 'ADMIN');

      const session = await db.whatsAppNumber.findUnique({
        where: { tenantId },
      });

      if (session?.status === 'CONNECTED' && (sessions.has(tenantId) || openwaSessions.has(tenantId))) {
        return res.json({ status: 'CONNECTED' });
      }

      if (useOpenWA) {
        connectTenantOpenWA(tenantId, io).catch((e) => console.error('[OpenWA Engine] Error:', e));
        const openwaQr = openwaQrCodes.get(tenantId);
        if (openwaQr) {
          return res.json({ status: 'QR_PENDING', qr: openwaQr, engine: 'OPENWA' });
        }
        return res.json({ status: 'INITIALIZING', engine: 'OPENWA', message: 'Generating OpenWA QR code, please wait...' });
      }

      // Trigger Baileys connection asynchronously
      connectTenant(tenantId, io, phoneNumber);

      if (method === 'PHONE' && phoneNumber) {
        const code = pairingCodes.get(tenantId);
        if (code) {
          return res.json({ status: 'PAIRING_CODE_PENDING', pairingCode: code, engine: 'BAILEYS' });
        }
        return res.json({ status: 'INITIALIZING', engine: 'BAILEYS', message: 'Generating pairing code, please wait...' });
      }

      // In-memory QR code check
      const qrRaw = qrCodes.get(tenantId);
      if (qrRaw) {
        const qrDataUrl = qrRaw.startsWith('data:image') ? qrRaw : await qrcode.toDataURL(qrRaw);
        return res.json({ status: 'QR_PENDING', qr: qrDataUrl, engine: 'BAILEYS' });
      }

      return res.json({ status: 'INITIALIZING', engine: 'BAILEYS', message: 'Generating QR code, please wait...' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown connection error';
      return res.status(500).json({ error: msg });
    }
  });

  // Get WhatsApp Connection Status
  app.get('/api/whatsapp/status', async (req, res) => {
    try {
      const tenantId = (req.query.tenantId as string) || (req.body?.tenantId as string);
      if (!tenantId) {
        return res.json({ status: 'DISCONNECTED', phoneNumber: null });
      }

      const db = getTenantPrisma(tenantId, 'ADMIN');
      const session = await db.whatsAppNumber.findUnique({
        where: { tenantId },
      });

      if (!session) {
        return res.json({ status: 'DISCONNECTED', phoneNumber: null });
      }

      let phone = null;
      if (session.phoneNumber) {
        try {
          phone = decrypt(session.phoneNumber);
        } catch {
          // Decryption failed or already plaintext
        }
      }

      const isConnected = session.status === 'CONNECTED' && sessions.has(tenantId);

      return res.json({
        status: isConnected ? 'CONNECTED' : session.status,
        phoneNumber: phone,
      });
    } catch (err: unknown) {
      return res.json({ status: 'DISCONNECTED', phoneNumber: null });
    }
  });

  // Disconnect WhatsApp Session
  app.post('/api/whatsapp/disconnect', async (req, res) => {
    try {
      const tenantId = (req.body?.tenantId as string) || (req.query?.tenantId as string);
      if (!tenantId) {
        return res.json({ success: true, status: 'DISCONNECTED' });
      }

      const sock = sessions.get(tenantId);
      if (sock) {
        try {
          await sock.logout();
        } catch {
          // Ignore logout error
        }
        sessions.delete(tenantId);
      }
      qrCodes.delete(tenantId);
      pairingCodes.delete(tenantId);

      const db = getTenantPrisma(tenantId, 'ADMIN');
      await db.whatsAppNumber.upsert({
        where: { tenantId },
        create: { tenantId, sessionData: '', status: 'DISCONNECTED', phoneNumber: null },
        update: { sessionData: '', status: 'DISCONNECTED', phoneNumber: null },
      });

      io.to(`tenant_${tenantId}`).emit('whatsapp_status', { status: 'DISCONNECTED' });
      return res.json({ success: true, status: 'DISCONNECTED' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Disconnect failed';
      return res.status(500).json({ error: msg });
    }
  });

  // Outbound Send WhatsApp Message
  app.post('/api/whatsapp/send', async (req, res) => {
    try {
      const { tenantId, to, text, mediaId, mimeType, clientMessageId, conversationId } = req.body;
      if (!tenantId || !to || !conversationId) {
        return res.status(400).json({ error: 'tenantId, to, and conversationId are required' });
      }
      if (!text && !mediaId) {
        return res.status(400).json({ error: 'Either text or mediaId is required' });
      }

      let hasSession = sessions.has(tenantId) || openwaSessions.has(tenantId);
      if (!hasSession) {
        try {
          const db = getTenantPrisma(tenantId, 'ADMIN');
          const sessionRecord = await db.whatsAppNumber.findUnique({ where: { tenantId } });
          if (sessionRecord?.status === 'CONNECTED') {
            console.log(`[Unified Server] Auto-connecting tenant ${tenantId} session for outbound send...`);
            connectTenant(tenantId, io);
            for (let i = 0; i < 15; i++) {
              await new Promise((r) => setTimeout(r, 200));
              if (sessions.has(tenantId) || openwaSessions.has(tenantId)) {
                hasSession = true;
                break;
              }
            }
          }
        } catch (e) {
          console.warn(`[Unified Server] Auto-connect failed for tenant ${tenantId}:`, e);
        }
      }

      if (!hasSession) {
        return res.status(400).json({ error: 'WhatsApp session is not active for this tenant. Please connect WhatsApp from Settings.' });
      }

      const result = await MessageService.sendMessage(
        tenantId,
        { to, text, mediaId, mimeType, clientMessageId, conversationId },
        io
      );

      return res.json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Outbound send error';
      return res.status(500).json({ error: msg });
    }
  });

  // Typing Indicator
  app.post('/api/whatsapp/typing', async (req, res) => {
    try {
      const { tenantId, to, on } = req.body;
      if (!tenantId || !to) {
        return res.status(400).json({ error: 'tenantId and to are required' });
      }
      const transport = TransportManager.getTransport(tenantId);
      await transport.setTyping(to, on !== false);
      return res.json({ success: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Typing indicator error';
      return res.status(500).json({ error: msg });
    }
  });

  // Webchat Inbound Event Hook
  app.post('/api/whatsapp/webchat/inbound', async (req, res) => {
    try {
      const { tenantId, conversationId, text, messageId } = req.body;
      if (!tenantId || !conversationId || !text || !messageId) {
        return res.status(400).json({ error: 'tenantId, conversationId, text, and messageId are required' });
      }

      io.to(`tenant_${tenantId}`).emit('new_message', {
        conversationId,
        message: {
          id: messageId,
          content: text,
          direction: 'INBOUND',
          senderType: 'CUSTOMER',
          createdAt: new Date(),
        },
      });

      const db = getTenantPrisma(tenantId, 'ADMIN');
      const config = await db.tenantAIConfig.findUnique({
        where: { tenantId },
      });

      if (config?.isActive) {
        const conversation = await db.conversation.findUnique({
          where: { id: conversationId },
          include: { customer: true },
        });

        const enqueueRes = await enqueueInboundJob({
          tenantId,
          wamId: messageId,
          senderPhone: conversation?.customer?.primaryPhone || 'webchat_user',
          payload: { text, from: 'webchat_user' },
        });

        if (enqueueRes.accepted && enqueueRes.jobId) {
          await db.inboundMessageJob.update({
            where: { id: enqueueRes.jobId },
            data: {
              conversationId,
              messageId,
              status: 'QUEUED',
            },
          });
        }
      }

      return res.json({ success: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Inbound webchat error';
      return res.status(500).json({ error: msg });
    }
  });

  // Generic Socket.io Emit Gateway
  app.post('/api/whatsapp/emit', async (req, res) => {
    try {
      const { tenantId, event, data } = req.body;
      if (!tenantId || !event) {
        return res.status(400).json({ error: 'tenantId and event are required' });
      }
      io.to(`tenant_${tenantId}`).emit(event, data);
      return res.json({ success: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Emit error';
      return res.status(500).json({ error: msg });
    }
  });

  // Next.js handles all other pages, dashboard views, and NextAuth endpoints
  app.use((req, res) => {
    return handle(req, res);
  });

  // Start Unified Server on single port
  server.listen(port, async () => {
    console.log(`====================================================`);
    console.log(`🚀 OneAIAssist Unified Server running on port ${port}`);
    console.log(`👉 Web Dashboard:   http://${hostname}:${port}`);
    console.log(`👉 Socket.io WSS:   http://${hostname}:${port}/socket.io`);
    console.log(`👉 WhatsApp Engine: Running in-process on port ${port}`);
    console.log(`====================================================`);

    startInboundJobWorker(io);

    // Restore active sessions from PostgreSQL
    try {
      const activeSessions = await prisma.whatsAppNumber.findMany({
        where: { status: 'CONNECTED' },
      });
      console.log(`[Unified Server] Restoring ${activeSessions.length} active sessions on startup...`);
      for (const session of activeSessions) {
        if (session.tenantId) {
          connectTenant(session.tenantId, io);
        }
      }
    } catch (err) {
      console.warn('[Unified Server] Session restore warning:', err);
    }
  });
}).catch((err) => {
  console.error('Failed to initialize Next.js unified server:', err);
  process.exit(1);
});
