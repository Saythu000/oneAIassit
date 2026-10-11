const { Client } = require('pg');

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
  }
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  try {
    await client.connect();
    const res = await client.query('SELECT id, email, role, "tenantId" FROM "User"');
    console.log('Users in database:');
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error('Error listing database users:', err);
  } finally {
    await client.end();
  }
}

run();
