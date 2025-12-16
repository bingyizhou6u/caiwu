import { applyD1Migrations, env } from 'cloudflare:test'
import { createDb } from '../src/db/index.js'
import { systemConfig } from '../src/db/schema.js'
import { drizzle } from 'drizzle-orm/d1'

// Initialize DB with schema
export async function initTestDb(dbBinding: D1Database) {
  const db = drizzle(dbBinding)
  // Apply migrations is tricky in unit tests without a real migration file runner
  // For integration tests with @cloudflare/vitest-pool-workers, it handles migrations via wrangler.toml if configured
  // But often we need to seed data.

  // For now, we assume the environment is fresh.
  // We can use applyD1Migrations if we have migration files and want to run them.
  // await applyD1Migrations(dbBinding, env.DB_MIGRATIONS)

  return db
}

export async function applySchema(db: D1Database) {
  const schemaSql = await import('../src/db/schema.sql?raw').then(m => m.default)
  const statements = schemaSql.split(';').filter(s => s.trim().length > 0)
  for (const statement of statements) {
    await db.prepare(statement).run()
  }
}
