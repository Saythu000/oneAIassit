import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import dns from 'dns';

// Ensure IPv4 is prioritized for database host resolution to prevent IPv6 ENETUNREACH/ETIMEDOUT on dual-stack environments
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

const origLookup = dns.lookup;
(dns as any).lookup = function (hostname: any, options: any, callback: any) {
  let cb = callback;
  let opts = options;
  if (typeof options === 'function') {
    cb = options;
    opts = {};
  }
  return origLookup(hostname, { ...opts, family: 4 }, (err: any, address: any, family: any) => {
    if (opts && opts.all && !Array.isArray(address) && address) {
      return cb(err, [{ address, family: family || 4 }]);
    }
    return cb(err, address, family);
  });
};

const globalForPrisma = global as unknown as { prisma: PrismaClient; pgPool: Pool };

let prismaInstance: PrismaClient;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set.');
}

const poolConfig = {
  connectionString,
  max: 20,
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 30000,
  keepAlive: true,
};

if (process.env.NODE_ENV === 'production') {
  const pool = new Pool(poolConfig);
  const adapter = new PrismaPg(pool);
  prismaInstance = new PrismaClient({ adapter });
} else {
  // Prevent multiple client/pool instances during hot reloading
  if (!globalForPrisma.pgPool) {
    globalForPrisma.pgPool = new Pool(poolConfig);
  }
  if (!globalForPrisma.prisma || !(globalForPrisma.prisma as any).marketingCampaign) {
    const adapter = new PrismaPg(globalForPrisma.pgPool);
    globalForPrisma.prisma = new PrismaClient({
      adapter,
      log: ['query', 'error', 'warn'],
    });
  }
  prismaInstance = globalForPrisma.prisma;
}

export const prisma = prismaInstance;
export const pool = globalForPrisma.pgPool || new Pool(poolConfig);

/**
 * Returns a Prisma Client instance extended with Row-Level Security (RLS) policies.
 * Wraps every transaction in a PostgreSQL set_config call to set app.current_tenant_id and app.current_user_role.
 */
export function getTenantPrisma(tenantId: string, role: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          try {
            await prisma.$executeRawUnsafe(
              `SELECT set_config('app.current_tenant_id', $1, false), set_config('app.current_user_role', $2, false);`,
              tenantId,
              role
            );
          } catch {
            // Gracefully ignore session config error if connection pool is constrained
          }
          return await query(args);
        },
      },
    },
  });
}
