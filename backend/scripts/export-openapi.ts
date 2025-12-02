import app from '../src/index.js'
import { writeFileSync } from 'fs'
import { resolve } from 'path'

const doc = app.getOpenAPI31Document({
    openapi: '3.1.0',
    info: {
        version: '1.0.0',
        title: 'Caiwu API',
    },
})

const outputPath = resolve(process.cwd(), 'openapi.json')
writeFileSync(outputPath, JSON.stringify(doc, null, 2))
console.log(`OpenAPI spec exported to ${outputPath}`)
