import { Client } from 'pg';

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
  }
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  console.log('Connected to database as owner. Resetting public schema...');

  try {
    await client.query('DROP SCHEMA public CASCADE;');
    await client.query('CREATE SCHEMA public;');
    await client.query('GRANT ALL ON SCHEMA public TO public;');
    console.log('✅ Public schema dropped and recreated successfully.');
  } catch (err) {
    console.error('Error resetting database:', err);
  } finally {
    await client.end();
  }
}

run().catch(console.error);
