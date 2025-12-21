/**
 * 页面导航辅助函数
 * 用于线上测试中的页面导航和等待
 */

import { Page } from '@playwright/test';

/**
 * 导航到指定页面并等待加载完成
 * @param page - Playwright Page 对象
 * @param url - 目标 URL
 * @param options - 选项
 */
export async function navigateAndWait(
    page: Page,
    url: string,
    options: { timeout?: number; waitTime?: number } = {}
): Promise<void> {
    const { timeout = 30000, waitTime = 2000 } = options;
    
    // 使用 domcontentloaded 避免等待所有资源，减少超时风险
    await page.goto(url, {
        timeout,
        waitUntil: 'domcontentloaded',
    });
    
    // 等待页面稳定
    await page.waitForTimeout(waitTime);
}

