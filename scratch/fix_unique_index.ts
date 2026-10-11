import { Client } from 'pg';

async function fixSchema() {
  const client = new Client({
    connectionString:
      process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  console.log('Altering InboundMessageJob columns to nullable...');
  await client.query(`
    ALTER TABLE "InboundMessageJob" ALTER COLUMN "conversationId" DROP NOT NULL;
    ALTER TABLE "InboundMessageJob" ALTER COLUMN "messageId" DROP NOT NULL;
  `);

  console.log('✅ InboundMessageJob conversationId & messageId are now nullable.');
  await client.end();
}

fixSchema().catch(console.error);
