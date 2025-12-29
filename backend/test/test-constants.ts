/**
 * 测试常量
 * 用于测试环境的环境变量和配置
 */

// 测试用的 JWT Secret
export const TEST_JWT_SECRET = 'test-secret-key-min-32-chars-for-security-reasons'

/**
 * 创建测试环境变量对象
 */
export function createTestEnv(overrides: Record<string, any> = {}) {
  return {
    AUTH_JWT_SECRET: TEST_JWT_SECRET,
    ...overrides,
  }
}
