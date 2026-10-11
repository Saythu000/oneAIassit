const { Client } = require('pg');

const sql = `
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MessageType') THEN
    CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO', 'LOCATION', 'OTHER');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MessageStatus') THEN
    CREATE TYPE "MessageStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED');
  END IF;
END
$$;

ALTER TABLE "BotConfig" ADD COLUMN IF NOT EXISTS "stopKeyword" text DEFAULT 'STOP';
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "automationEnabled" boolean DEFAULT true;

ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "messageType" "MessageType" DEFAULT 'TEXT';
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "status" "MessageStatus" DEFAULT 'SENT';
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "clientMessageId" text;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "providerMessageId" text;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "mediaId" text;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "sentAt" timestamp with time zone;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "deliveredAt" timestamp with time zone;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "readAt" timestamp with time zone;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "failedAt" timestamp with time zone;

DROP INDEX IF EXISTS "Message_clientMessageId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Message_clientMessageId_key" ON "Message"("clientMessageId");
`;

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  console.log('Running migrations...');
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    await client.query(sql);
    console.log('✅ Migrations completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}

run();
