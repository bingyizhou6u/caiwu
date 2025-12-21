/**
 * TOTP 生成工具
 * 用于线上环境测试时动态生成 Google Authenticator 验证码
 */

import { authenticator } from 'otplib';

/**
 * 使用 TOTP Secret 生成当前有效的验证码
 * @param secret - TOTP 密钥（从数据库获取）
 * @returns 6位数字验证码
 */
export function generateTotp(secret: string): string {
    return authenticator.generate(secret);
}

/**
 * 验证 TOTP 验证码是否正确
 * @param token - 用户输入的验证码
 * @param secret - TOTP 密钥
 * @returns 验证是否通过
 */
export function verifyTotp(token: string, secret: string): boolean {
    return authenticator.verify({ token, secret });
}

/**
 * 获取当前 TOTP 的剩余有效时间（秒）
 * @returns 剩余秒数
 */
export function getRemainingSeconds(): number {
    return authenticator.timeRemaining();
}

/**
 * 等待到下一个 TOTP 周期
 * 当剩余时间少于 5 秒时，等待到下一个周期以确保验证码有效
 */
export async function waitForNextTotpCycle(): Promise<void> {
    const remaining = getRemainingSeconds();
    if (remaining < 5) {
        // 等待到下一个周期
        await new Promise(resolve => setTimeout(resolve, (remaining + 1) * 1000));
    }
}

