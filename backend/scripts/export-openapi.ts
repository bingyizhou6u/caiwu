import app from '../src/index.js'
import { writeFileSync } from 'fs'
import { resolve } from 'path'

const doc = app.getOpenAPI31Document({
    openapi: '3.1.0',
    info: {
        version: '2.0.0',
        title: 'Caiwu API',
        description: 'AR公司财务管理系统 API - 所有时间基于迪拜时间 (UTC+4)',
    },
})

const outputPath = resolve(process.cwd(), 'openapi.json')
writeFileSync(outputPath, JSON.stringify(doc, null, 2))
console.log(`OpenAPI spec exported to ${outputPath}`)


