import 'dotenv/config';
import { Client } from 'pg';

async function main() {
  console.log('Applying Phase 1 Dual-Agent DDL migration to Neon PostgreSQL...');
  const connStr = process.env.DATABASE_URL; if (!connStr) throw new Error('DATABASE_URL required');

  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  try {
    await client.query('BEGIN;');

    // 1. Create ValidationType enum if not exists
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ValidationType') THEN
          CREATE TYPE "ValidationType" AS ENUM ('NUMBER', 'US_STATE', 'CURRENCY', 'ENUM', 'PHONE', 'EMAIL', 'DATE', 'TEXT');
        END IF;
      END $$;
    `);
    console.log('✅ ValidationType enum verified/created');

    // 2. Add InboundJobStatus enum values if not present
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InboundJobStatus') THEN
          CREATE TYPE "InboundJobStatus" AS ENUM ('RECEIVED', 'QUEUED', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
        ELSE
          BEGIN
            ALTER TYPE "InboundJobStatus" ADD VALUE IF NOT EXISTS 'RECEIVED';
            ALTER TYPE "InboundJobStatus" ADD VALUE IF NOT EXISTS 'QUEUED';
          EXCEPTION
            WHEN duplicate_object THEN NULL;
          END;
        END IF;
      END $$;
    `);
    console.log('✅ InboundJobStatus enum verified/updated');

    // 3. Create DynamicIntakeQuestion table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "DynamicIntakeQuestion" (
        "id" TEXT NOT NULL,
        "tenantId" TEXT NOT NULL,
        "stepOrder" INTEGER NOT NULL,
        "fieldKey" TEXT NOT NULL,
        "questionPrompt" TEXT NOT NULL,
        "validationType" "ValidationType" NOT NULL DEFAULT 'TEXT',
        "isMandatory" BOOLEAN NOT NULL DEFAULT true,
        "isSkippable" BOOLEAN NOT NULL DEFAULT false,
        "options" JSONB,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT "DynamicIntakeQuestion_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "DynamicIntakeQuestion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "DynamicIntakeQuestion_tenantId_stepOrder_key" UNIQUE ("tenantId", "stepOrder"),
        CONSTRAINT "DynamicIntakeQuestion_tenantId_fieldKey_key" UNIQUE ("tenantId", "fieldKey")
      );
      CREATE INDEX IF NOT EXISTS "DynamicIntakeQuestion_tenantId_isActive_idx" ON "DynamicIntakeQuestion"("tenantId", "isActive");
    `);
    console.log('✅ DynamicIntakeQuestion table & unique constraints created');

    // 4. Update InboundMessageJob table with wamId and unique constraint
    await client.query(`
      CREATE TABLE IF NOT EXISTS "InboundMessageJob" (
        "id" TEXT NOT NULL,
        "tenantId" TEXT NOT NULL,
        "wamId" TEXT,
        "senderPhone" TEXT,
        "recipientId" TEXT,
        "payload" JSONB,
        "conversationId" TEXT,
        "messageId" TEXT,
        "status" "InboundJobStatus" NOT NULL DEFAULT 'RECEIVED',
        "attempts" INTEGER NOT NULL DEFAULT 0,
        "maxAttempts" INTEGER NOT NULL DEFAULT 3,
        "lastError" TEXT,
        "lockedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "processedAt" TIMESTAMP(3),

        CONSTRAINT "InboundMessageJob_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "InboundMessageJob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );

      ALTER TABLE "InboundMessageJob" 
        ADD COLUMN IF NOT EXISTS "wamId" TEXT,
        ADD COLUMN IF NOT EXISTS "senderPhone" TEXT,
        ADD COLUMN IF NOT EXISTS "recipientId" TEXT,
        ADD COLUMN IF NOT EXISTS "payload" JSONB,
        ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "maxAttempts" INTEGER NOT NULL DEFAULT 3,
        ADD COLUMN IF NOT EXISTS "lastError" TEXT,
        ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

      CREATE UNIQUE INDEX IF NOT EXISTS "InboundMessageJob_tenantId_wamId_key" ON "InboundMessageJob"("tenantId", "wamId") WHERE "wamId" IS NOT NULL;
      CREATE INDEX IF NOT EXISTS "InboundMessageJob_tenantId_idx" ON "InboundMessageJob"("tenantId");
      CREATE INDEX IF NOT EXISTS "InboundMessageJob_status_createdAt_idx" ON "InboundMessageJob"("status", "createdAt");
    `);
    console.log('✅ InboundMessageJob table & DB-level wamId unique constraint verified');

    // 5. Update IntakeSession with field-key progression
    await client.query(`
      CREATE TABLE IF NOT EXISTS "IntakeSession" (
        "id" TEXT NOT NULL,
        "tenantId" TEXT NOT NULL,
        "leadId" TEXT NOT NULL,
        "customerId" TEXT NOT NULL,
        "flowId" TEXT NOT NULL DEFAULT 'default_intake',
        "flowVersion" TEXT NOT NULL DEFAULT '1.0',
        "status" "IntakeSessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
        "currentFieldKey" TEXT,
        "interruptionCount" INTEGER NOT NULL DEFAULT 0,
        "isComplete" BOOLEAN NOT NULL DEFAULT false,
        "collectedFields" JSONB NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "completedAt" TIMESTAMP(3),

        CONSTRAINT "IntakeSession_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "IntakeSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "IntakeSession_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "IntakeSession_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "IntakeSession_leadId_key" UNIQUE ("leadId")
      );

      ALTER TABLE "IntakeSession"
        ADD COLUMN IF NOT EXISTS "currentFieldKey" TEXT,
        ADD COLUMN IF NOT EXISTS "interruptionCount" INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "isComplete" BOOLEAN NOT NULL DEFAULT false;
    `);
    console.log('✅ IntakeSession table updated with currentFieldKey & interruptionCount');

    // 6. Add primaryCustomerId to Customer table
    await client.query(`
      ALTER TABLE "Customer"
        ADD COLUMN IF NOT EXISTS "primaryCustomerId" TEXT;

      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Customer_primaryCustomerId_fkey') THEN
          ALTER TABLE "Customer"
            ADD CONSTRAINT "Customer_primaryCustomerId_fkey"
            FOREIGN KEY ("primaryCustomerId") REFERENCES "Customer"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$;
    `);
    console.log('✅ Customer dependent primaryCustomerId relation added');

    // 7. Enable RLS and Grant Permissions
    await client.query(`
      ALTER TABLE "DynamicIntakeQuestion" ENABLE ROW LEVEL SECURITY;
      ALTER TABLE "InboundMessageJob" ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS dynamic_question_tenant_isolation ON "DynamicIntakeQuestion";
      CREATE POLICY dynamic_question_tenant_isolation ON "DynamicIntakeQuestion"
        FOR ALL USING (
          "tenantId" = current_setting('app.current_tenant_id', true)
          OR current_setting('app.current_user_role', true) = 'PLATFORM_OWNER'
        );

      DROP POLICY IF EXISTS inbound_job_tenant_isolation ON "InboundMessageJob";
      CREATE POLICY inbound_job_tenant_isolation ON "InboundMessageJob"
        FOR ALL USING (
          "tenantId" = current_setting('app.current_tenant_id', true)
          OR current_setting('app.current_user_role', true) = 'PLATFORM_OWNER'
        );

      GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO oneai_app;
      GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO oneai_app;
    `);
    console.log('✅ RLS policies enabled and permissions granted to oneai_app');

    // 8. Seed default questions for existing tenants
    const tenantsRes = await client.query('SELECT "id" FROM "Tenant"');
    const defaultQuestions = [
      { step: 1, key: 'age', type: 'NUMBER', prompt: 'To help us find the best plan for you, what is your age?', mandatory: true, skippable: false, options: null },
      { step: 2, key: 'state', type: 'US_STATE', prompt: 'Which US State do you reside in? (e.g., NY, TX, CA, FL)', mandatory: true, skippable: false, options: null },
      { step: 3, key: 'family_size', type: 'NUMBER', prompt: 'How many family members (including yourself) would you like to insure?', mandatory: true, skippable: false, options: null },
      { step: 4, key: 'budget', type: 'CURRENCY', prompt: 'What is your approximate target monthly budget for health coverage?', mandatory: true, skippable: false, options: null },
      { step: 5, key: 'conditions', type: 'TEXT', prompt: 'Do you or any family members have any pre-existing health conditions? (Reply None if none)', mandatory: false, skippable: true, options: null },
    ];

    for (const tenant of tenantsRes.rows) {
      for (const q of defaultQuestions) {
        await client.query(`
          INSERT INTO "DynamicIntakeQuestion" ("id", "tenantId", "stepOrder", "fieldKey", "questionPrompt", "validationType", "isMandatory", "isSkippable", "options", "isActive")
          VALUES ($1, $2, $3, $4, $5, $6::"ValidationType", $7, $8, $9, true)
          ON CONFLICT ("tenantId", "stepOrder") DO UPDATE SET
            "fieldKey" = EXCLUDED."fieldKey",
            "questionPrompt" = EXCLUDED."questionPrompt",
            "validationType" = EXCLUDED."validationType",
            "isMandatory" = EXCLUDED."isMandatory",
            "isSkippable" = EXCLUDED."isSkippable";
        `, [`diq_${tenant.id}_${q.step}`, tenant.id, q.step, q.key, q.prompt, q.type, q.mandatory, q.skippable, q.options]);
      }
      console.log(`✅ Default questions seeded for tenant: ${tenant.id}`);
    }

    await client.query('COMMIT;');
    console.log('\n🎉 Phase 1 DDL migration and seeding completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK;');
    console.error('❌ Migration failed:', err);
    throw err;
  } finally {
    await client.end();
  }
}

main();
