import 'dotenv/config';
import { Client } from 'pg';

async function main() {
  console.log('Applying contextMessageId migration to Message table as database owner...');
  const connStr = process.env.DATABASE_URL; if (!connStr) throw new Error('DATABASE_URL required');

  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  try {
    await client.query(`
      ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "contextMessageId" TEXT;
    `);
    await client.query(`
      GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO oneai_app;
    `);
    console.log('✅ Added contextMessageId column to Message table & granted permissions!');
    console.log('✅ Added contextMessageId column to Message table!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    await client.end();
  }
}

main();
