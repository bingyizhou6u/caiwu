/**
 * 线上测试环境共享配置
 * 供各个模块测试文件使用
 */

import { loadLiveEnvConfig, validateConfig } from './config/live-env';
import { clearToken } from './utils/token-manager';
import { test } from '@playwright/test';

// 加载配置
export const config = loadLiveEnvConfig();

// 验证配置
const validation = validateConfig(config);
if (!validation.valid) {
    console.warn('线上测试环境配置不完整：', validation.errors);
}

// 设置测试超时
test.setTimeout(config.timeout);

/**
 * 设置模块测试的通用 hooks
 * 在模块测试文件的 beforeAll 中调用
 * 
 * 注意：现在使用正常的 UI 登录流程，不再预获取 token
 */
export async function setupModuleTests() {
    // 使用正常的 UI 登录流程，不需要预获取 token
    console.log('使用正常 UI 登录流程');
}

/**
 * 清理模块测试
 * 在模块测试文件的 afterAll 中调用
 */
export function teardownModuleTests(): void {
    clearToken();
}

