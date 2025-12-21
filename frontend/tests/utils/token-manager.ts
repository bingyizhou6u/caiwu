/**
 * Token 管理器
 * 用于在测试之间复用登录 token，避免频繁登录
 */

import { LiveEnvConfig } from '../config/live-env';
import { generateTotp } from './totp';

// 全局 token 和用户信息存储
let cachedToken: string | null = null;
let tokenExpiry: number | null = null;
let cachedUserInfo: any | null = null;

/**
 * 通过 API 直接获取登录 token
 * @param config - 线上环境配置
 * @returns JWT token
 */
export async function getAuthToken(config: LiveEnvConfig): Promise<string> {
    // 如果 token 仍然有效，直接返回缓存的 token
    if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
        console.log('使用缓存的 token');
        return cachedToken;
    }

    console.log('通过 API 获取新的 token');

    // 构建登录请求
    const loginUrl = `${config.baseUrl}/api/v2/auth/login`;
    
    // 第一步：邮箱+密码登录
    const loginResponse = await fetch(loginUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            email: config.email,
            password: config.password,
        }),
    });

    if (!loginResponse.ok) {
        const errorText = await loginResponse.text();
        throw new Error(`登录失败: ${loginResponse.status} - ${errorText}`);
    }

    const loginResponseData = await loginResponse.json();
    // 处理统一响应格式
    const loginData = loginResponseData.success ? loginResponseData.data : loginResponseData;
    
    // 检查是否需要 TOTP
    if (loginData.needTotp) {
        // 生成 TOTP 验证码
        const totpCode = generateTotp(config.totpSecret);
        console.log('输入 TOTP:', totpCode);

        // 第二步：TOTP 验证
        const totpResponse = await fetch(loginUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: config.email,
                password: config.password,
                totp: totpCode,
            }),
        });

        if (!totpResponse.ok) {
            const errorText = await totpResponse.text();
            throw new Error(`TOTP 验证失败: ${totpResponse.status} - ${errorText}`);
        }

        const totpResponseData = await totpResponse.json();
        // 处理统一响应格式
        const totpData = totpResponseData.success ? totpResponseData.data : totpResponseData;
        
        if (!totpData.token) {
            throw new Error('TOTP 验证后未返回 token');
        }

        cachedToken = totpData.token;
        cachedUserInfo = totpData.user;
        // 设置 token 过期时间（默认 24 小时）
        tokenExpiry = Date.now() + (totpData.expiresIn || 86400) * 1000;
        
        return cachedToken;
    } else {
        // 直接登录成功
        if (!loginData.token) {
            throw new Error('登录后未返回 token');
        }

        cachedToken = loginData.token;
        cachedUserInfo = loginData.user;
        // 设置 token 过期时间（默认 24 小时）
        tokenExpiry = Date.now() + (loginData.expiresIn || 86400) * 1000;
        
        return cachedToken;
    }
}

/**
 * 获取缓存的用户信息
 */
export function getCachedUserInfo(): any | null {
    return cachedUserInfo;
}

/**
 * 清除缓存的 token 和用户信息
 */
export function clearToken(): void {
    cachedToken = null;
    tokenExpiry = null;
    cachedUserInfo = null;
}

/**
 * 获取当前缓存的 token
 */
export function getCachedToken(): string | null {
    return cachedToken;
}

