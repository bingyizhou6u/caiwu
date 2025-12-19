import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineWorkersConfig({
    test: {
        // Reduce concurrency to avoid port exhaustion
        maxConcurrency: 1,
        fileParallelism: false,
        sequence: {
            shuffle: false,
        },
        poolOptions: {
            workers: {
                wrangler: { configPath: './wrangler.toml' },
                singleWorker: true,
                miniflare: {
                    d1Databases: ['DB'],
                    kvNamespaces: ['SESSIONS_KV'],
                    compatibilityFlags: ['nodejs_compat'],
                    serviceBindings: {
                        EMAIL_SERVICE: async () => { return new Response('{"success": true}') }
                    }
                },
            },
        },
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: [
                'node_modules/',
                'test/',
                '**/*.test.ts',
                '**/*.config.ts',
                'scripts/',
                'coverage/',
                '*.d.ts'
            ],
            thresholds: {
                lines: 70,
                functions: 70,
                branches: 65,
                statements: 70
            }
        },
    },
    resolve: {
        alias: {
            'mimetext': path.resolve(__dirname, './test/mocks/mimetext.ts'),
        },
    },
})
