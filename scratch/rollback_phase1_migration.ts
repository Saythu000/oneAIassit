import 'dotenv/config';
import { Client } from 'pg';

async function rollback() {
  console.log('Rolling back Phase 1 migration changes...');
  const connStr = process.env.DATABASE_URL; if (!connStr) throw new Error('DATABASE_URL required');
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    await client.query(`
      DROP TABLE IF EXISTS "DynamicIntakeQuestion" CASCADE;
      DROP TYPE IF EXISTS "ValidationType" CASCADE;
      ALTER TABLE "Customer" DROP COLUMN IF EXISTS "primaryCustomerId";
      ALTER TABLE "IntakeSession" 
        DROP COLUMN IF EXISTS "currentFieldKey",
        DROP COLUMN IF EXISTS "interruptionCount",
        DROP COLUMN IF EXISTS "isComplete";
      ALTER TABLE "InboundMessageJob" 
        DROP COLUMN IF EXISTS "wamId",
        DROP COLUMN IF EXISTS "senderPhone",
        DROP COLUMN IF EXISTS "recipientId",
        DROP COLUMN IF EXISTS "payload",
        DROP COLUMN IF EXISTS "lockedAt";
    `);
    console.log('✅ Rollback completed cleanly.');
  } catch (err) {
    console.error('❌ Rollback error:', err);
  } finally {
    await client.end();
  }
}

rollback();
