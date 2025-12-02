import { DrizzleD1Database } from 'drizzle-orm/d1'
import { eq, inArray } from 'drizzle-orm'
import * as schema from '../db/schema.js'
import { siteConfig } from '../db/schema.js'
import { Errors } from '../utils/errors.js'

export class SiteConfigService {
    constructor(private db: DrizzleD1Database<typeof schema>) { }

    async getConfigs() {
        const configs = await this.db.select().from(siteConfig).orderBy(siteConfig.configKey).all()

        return configs.map(config => ({
            id: config.id,
            config_key: config.configKey,
            config_value: config.isEncrypted === 1 && config.configValue
                ? '***已配置***'
                : config.configValue || '',
            description: config.description,
            is_encrypted: config.isEncrypted === 1,
            created_at: config.createdAt,
            updated_at: config.updatedAt,
        }))
    }

    async updateConfig(key: string, value: string) {
        const existing = await this.db.query.siteConfig.findFirst({
            where: eq(siteConfig.configKey, key)
        })

        if (!existing) {
            throw Errors.NOT_FOUND('config key')
        }

        await this.db.update(siteConfig)
            .set({
                configValue: value,
                updatedAt: Date.now()
            })
            .where(eq(siteConfig.configKey, key))
            .execute()

        return { ok: true }
    }

    async batchUpdateConfigs(updates: Record<string, string>) {
        const keys = Object.keys(updates)
        if (keys.length === 0) {
            return { ok: true, updated: 0 }
        }

        const existing = await this.db.select({ configKey: siteConfig.configKey })
            .from(siteConfig)
            .where(inArray(siteConfig.configKey, keys))
            .all()

        const existingKeys = new Set(existing.map(r => r.configKey))
        const keysToUpdate = keys.filter(key => existingKeys.has(key))

        if (keysToUpdate.length === 0) {
            return { ok: true, updated: 0 }
        }

        // D1 doesn't support batch update in one query easily without raw SQL or multiple statements.
        // Drizzle batch API is for batching multiple statements.
        const batch = keysToUpdate.map(key => {
            return this.db.update(siteConfig)
                .set({
                    configValue: updates[key],
                    updatedAt: Date.now()
                })
                .where(eq(siteConfig.configKey, key))
        })

        if (batch.length > 0) {
            await this.db.batch(batch as any)
        }

        return { ok: true, updated: batch.length, keys: keysToUpdate }
    }

    // Internal use
    async getConfigValue(key: string): Promise<string | null> {
        const config = await this.db.query.siteConfig.findFirst({
            where: eq(siteConfig.configKey, key),
            columns: { configValue: true }
        })
        return config?.configValue || null
    }

    // Internal use
    async getAllConfigs(): Promise<Record<string, string>> {
        const configs = await this.db.select({
            configKey: siteConfig.configKey,
            configValue: siteConfig.configValue
        }).from(siteConfig).all()

        const result: Record<string, string> = {}
        for (const config of configs) {
            if (config.configValue) {
                result[config.configKey] = config.configValue
            }
        }
        return result
    }
}
