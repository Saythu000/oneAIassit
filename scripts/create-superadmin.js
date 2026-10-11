const { Client } = require('pg');
const bcrypt = require('bcryptjs');

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
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    // Check if superadmin already exists
    const checkRes = await client.query('SELECT id FROM "User" WHERE email = $1', ['superadmin@agency.com']);
    if (checkRes.rows.length > 0) {
      console.log('Superadmin user already exists.');
      return;
    }

    const insertRes = await client.query(
      `INSERT INTO "User" (id, email, "hashedPassword", role, "twoFactorEnabled", "totpSecret", "createdAt") 
       VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id`,
      ['superadmin-user-id', 'superadmin@agency.com', hashedPassword, 'PLATFORM_OWNER', false, 'JBSWY3DPEHPK3PXP']
    );
    console.log('Superadmin user created successfully with ID:', insertRes.rows[0].id);
  } catch (err) {
    console.error('Error creating superadmin:', err);
  } finally {
    await client.end();
  }
}

run();
