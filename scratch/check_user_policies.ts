import 'dotenv/config';
import { Client } from 'pg';

async function checkPolicies() {
  const connStr = process.env.DATABASE_URL; if (!connStr) throw new Error('DATABASE_URL required');
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const res = await client.query(`
    SELECT polname, polcmd, polqual, polwithcheck, relrowsecurity
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    WHERE c.relname = 'User';
  `);
  console.log('User policies:', res.rows);
  await client.end();
}

checkPolicies();
