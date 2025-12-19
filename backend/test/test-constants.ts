/**
 * 测试常量
 * 用于测试环境的环境变量和配置
 */

// 测试用的密码哈希（对应密码: "test-password-123"）
// 生成方式: bcrypt.hashSync('test-password-123', 10)
export const TEST_PASSWORD_HASH = '$2b$10$8YHB2Aa4Kg6rUdl2GZcrNe67/Ux7Y3X84/RkWQoK94tIahkzgHJve'

// 测试用的 JWT Secret
export const TEST_JWT_SECRET = 'test-secret-key-min-32-chars-for-security-reasons'

// 测试用的初始化管理员密码哈希（必需环境变量）
// 生成方式: bcrypt.hashSync('admin-init-password-123', 10)
export const TEST_INIT_ADMIN_PASSWORD_HASH = '$2b$10$8YHB2Aa4Kg6rUdl2GZcrNe67/Ux7Y3X84/RkWQoK94tIahkzgHJve'

/**
 * 创建测试环境变量对象
 */
export function createTestEnv(overrides: Record<string, any> = {}) {
  return {
    AUTH_JWT_SECRET: TEST_JWT_SECRET,
    INIT_ADMIN_PASSWORD_HASH: TEST_INIT_ADMIN_PASSWORD_HASH,
    ...overrides,
  }
}
