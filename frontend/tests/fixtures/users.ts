/**
 * 前端E2E测试 - 用户数据Fixtures
 */

export const TEST_USERS = {
  admin: {
    email: 'admin@example.com',
    password: 'password123',
    name: '管理员',
    role: 'admin',
    position: {
      code: 'ceo',
      function_role: 'admin',
      permissions: {
        hr: { employee: ['view', 'create', 'update', 'delete'] },
        finance: { flow: ['view', 'create', 'update', 'delete'] },
      },
    },
  },
  finance: {
    email: 'finance@example.com',
    password: 'password123',
    name: '财务经理',
    role: 'finance',
    position: {
      code: 'finance_manager',
      function_role: 'finance',
      permissions: {
        finance: { flow: ['view', 'create', 'update'], account: ['view'] },
      },
    },
  },
  hr: {
    email: 'hr@example.com',
    password: 'password123',
    name: '人事经理',
    role: 'hr',
    position: {
      code: 'hr_manager',
      function_role: 'hr',
      permissions: {
        hr: { employee: ['view', 'create', 'update'] },
      },
    },
  },
}

export function getUserFixture(role: keyof typeof TEST_USERS) {
  return TEST_USERS[role]
}
