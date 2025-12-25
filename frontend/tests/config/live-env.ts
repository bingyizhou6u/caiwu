/**
 * 线上测试环境配置
 * 用于连接线上测试环境进行 E2E 测试
 */

export interface LiveEnvConfig {
    /** 线上测试环境 URL */
    baseUrl: string;
    /** 测试账号邮箱 */
    email: string;
    /** 测试账号密码 */
    password: string;
    /** TOTP 密钥（从数据库获取） */
    totpSecret: string;
    /** 测试超时时间（毫秒） */
    timeout: number;
    /** 导航超时时间（毫秒） */
    navigationTimeout: number;
}

/**
 * 从环境变量加载配置
 * 如果环境变量未设置，使用默认值
 */
export function loadLiveEnvConfig(): LiveEnvConfig {
    return {
        baseUrl: process.env.LIVE_TEST_URL || '',
        email: process.env.LIVE_TEST_EMAIL || '',
        password: process.env.LIVE_TEST_PASSWORD || '',
        totpSecret: process.env.LIVE_TEST_TOTP_SECRET || '',
        timeout: parseInt(process.env.LIVE_TEST_TIMEOUT || '60000', 10),
        navigationTimeout: parseInt(process.env.LIVE_TEST_NAV_TIMEOUT || '30000', 10),
    };
}

/**
 * 验证配置是否完整
 */
export function validateConfig(config: LiveEnvConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.baseUrl) {
        errors.push('LIVE_TEST_URL 未配置');
    }
    if (!config.email) {
        errors.push('LIVE_TEST_EMAIL 未配置');
    }
    if (!config.password) {
        errors.push('LIVE_TEST_PASSWORD 未配置');
    }
    if (!config.totpSecret) {
        errors.push('LIVE_TEST_TOTP_SECRET 未配置（需从数据库获取）');
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * 默认配置（用于开发测试）
 * 注意：实际凭据必须通过环境变量配置
 */
export const defaultConfig: LiveEnvConfig = {
    baseUrl: '',
    email: '',
    password: '',
    totpSecret: '',
    timeout: 60000,
    navigationTimeout: 30000,
};

