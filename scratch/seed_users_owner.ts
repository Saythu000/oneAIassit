import 'dotenv/config';
import { Client } from 'pg';
import bcrypt from 'bcryptjs';

async function seedUsersSuperuser() {
  console.log('Seeding core users via superuser connection...');

  const connStr = process.env.DATABASE_URL; if (!connStr) throw new Error('DATABASE_URL required');
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  try {
    const hashedPassword = await bcrypt.hash('password123', 10);

    // 1. Ensure Tenant PME exists
    await client.query(`
      INSERT INTO "Tenant" ("id", "name", "slug", "status", "isDraft", "subscriptionPlan", "subscriptionStatus", "contactEmail", "primaryColor", "secondaryColor", "heroTagline", "heroDescription")
      VALUES ('tenant_pme_ff9xl', 'Prime Marketing Experts', 'prime-marketing-experts', 'ACTIVE', false, 'ENTERPRISE', 'ACTIVE', 'admin@primemarketingexperts.com', '#004ac6', '#00788c', 'Leading Digital Insurance & Growth Marketing', 'Enterprise AI assistants and omni-channel campaigns for insurance providers.')
      ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "slug" = EXCLUDED."slug", "contactEmail" = EXCLUDED."contactEmail";
    `);
    console.log('✅ Tenant Prime Marketing Experts upserted');

    // 2. Ensure Tenant Apex exists
    const apexRes = await client.query(`
      INSERT INTO "Tenant" ("id", "name", "slug", "status", "isDraft", "subscriptionPlan", "subscriptionStatus", "contactEmail")
      VALUES ('tenant_apex_default', 'Apex Assurance Group', 'apex-assurance', 'ACTIVE', false, 'ENTERPRISE', 'ACTIVE', 'support@apex-assurance.com')
      ON CONFLICT ("slug") DO UPDATE SET "name" = EXCLUDED."name"
      RETURNING "id";
    `);
    const apexId = apexRes.rows[0]?.id || 'tenant_apex_default';
    console.log(`✅ Tenant Apex Assurance upserted (${apexId})`);

    // 3. Upsert Users
    const users = [
      { id: 'usr_pme_admin', email: 'admin@primemarketingexperts.com', role: 'ADMIN', tenantId: 'tenant_pme_ff9xl' },
      { id: 'usr_pme_manager', email: 'manager@primemarketingexperts.com', role: 'MANAGER', tenantId: 'tenant_pme_ff9xl' },
      { id: 'usr_pme_agent', email: 'agent@primemarketingexperts.com', role: 'AGENT', tenantId: 'tenant_pme_ff9xl' },
      { id: 'usr_apex_admin', email: 'admin@agency.com', role: 'ADMIN', tenantId: apexId },
      { id: 'usr_apex_manager', email: 'manager@agency.com', role: 'MANAGER', tenantId: apexId },
      { id: 'usr_apex_agent', email: 'agent@agency.com', role: 'AGENT', tenantId: apexId },
    ];

    for (const u of users) {
      await client.query(`
        INSERT INTO "User" ("id", "email", "hashedPassword", "role", "tenantId", "twoFactorEnabled")
        VALUES ($1, $2, $3, $4::"Role", $5, false)
        ON CONFLICT ("email") DO UPDATE SET "hashedPassword" = $3, "role" = $4::"Role", "tenantId" = $5;
      `, [u.id, u.email, hashedPassword, u.role, u.tenantId]);
      console.log(`✅ User upserted: ${u.email} (${u.role}) -> Password 'password123'`);
    }

    // Grant privileges to oneai_app
    await client.query(`
      GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO oneai_app;
      GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO oneai_app;
    `);

    console.log('✅ All core users created and permissions granted!');
  } catch (err) {
    console.error('❌ Seeding failed:', err);
  } finally {
    await client.end();
  }
}

seedUsersSuperuser();
