#!/usr/bin/env tsx
/**
 * 生成密码哈希工具
 * 用于生成 INIT_ADMIN_PASSWORD_HASH 环境变量所需的 bcrypt 哈希值
 * 
 * 使用方法:
 *   npm run gen:password-hash <password>
 *   或
 *   tsx scripts/gen-password-hash.ts <password>
 */

import bcrypt from 'bcryptjs'

const password = process.argv[2]

if (!password) {
  console.error('错误: 请提供密码作为参数')
  console.error('使用方法: npm run gen:password-hash <password>')
  console.error('示例: npm run gen:password-hash "MySecurePassword123!"')
  process.exit(1)
}

if (password.length < 6) {
  console.error('错误: 密码长度至少为 6 个字符')
  process.exit(1)
}

try {
  const hash = bcrypt.hashSync(password, 10)
  console.log('\n✅ 密码哈希生成成功:\n')
  console.log(hash)
  console.log('\n📋 使用方法:\n')
  console.log('1. 开发环境 (wrangler.toml):')
  console.log(`   INIT_ADMIN_PASSWORD_HASH = "${hash}"`)
  console.log('\n2. 生产环境 (Cloudflare Secret):')
  console.log(`   wrangler secret put INIT_ADMIN_PASSWORD_HASH`)
  console.log('   然后粘贴上面的哈希值')
  console.log('\n⚠️  注意: 请妥善保管此哈希值，不要提交到版本控制系统\n')
} catch (error) {
  console.error('错误: 生成密码哈希失败', error)
  process.exit(1)
}
