import 'dotenv/config';
import { Client } from 'pg';

async function main() {
  console.log('Applying Meta Cloud API DDL migration to WhatsAppNumber table...');
  const connStr = process.env.DATABASE_URL; if (!connStr) throw new Error('DATABASE_URL required');

  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  try {
    await client.query(`
      ALTER TABLE "WhatsAppNumber" 
        ADD COLUMN IF NOT EXISTS "provider" TEXT NOT NULL DEFAULT 'BAILEYS',
        ADD COLUMN IF NOT EXISTS "metaPhoneNumberId" TEXT,
        ADD COLUMN IF NOT EXISTS "metaWabaId" TEXT,
        ADD COLUMN IF NOT EXISTS "metaAccessToken" TEXT,
        ADD COLUMN IF NOT EXISTS "metaVerifyToken" TEXT;
    `);
    await client.query(`
      GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO oneai_app;
    `);
    console.log('✅ Added Meta Cloud API columns to WhatsAppNumber table & granted permissions!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    await client.end();
  }
}

main();
