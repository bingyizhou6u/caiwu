import { Page } from '@playwright/test';
import fs from 'fs';

export async function setupCommonMocks(page: Page) {
    // Catch-all for API to prevent 401s from remote backend
    await page.route('**/api/**', async route => {
        const url = route.request().url();
        if (url.includes('/src/') || url.includes('node_modules') || url.includes('@fs')) {
            return route.continue();
        }

        // console.log('UNMOCKED API HIT:', url); // Optional: Enable for debugging
        try {
            // fs.appendFileSync('debug_urls.log', url + '\n');
        } catch (e) { }

        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [] }) });
    });

    await page.route('**/api/health', async route => route.fulfill({ json: { checks: { db: true }, status: 'healthy' } }));

    // Login Mock
    await page.route('**/api/auth/login-password', async route => {
        await route.fulfill({
            json: {
                token: 'mock-token',
                user: {
                    id: '1', name: 'Admin', email: 'admin@example.com', role: 'admin',
                    permissions: [],
                    position: {
                        function_role: 'finance',
                        code: 'finance_manager',
                        permissions: {
                            finance: {
                                flow: ['view', 'create'],
                                transfer: ['view'],
                                borrowing: ['view'],
                                repayment: ['view'],
                                ar: ['view'],
                                ap: ['view']
                            },
                            hr: {
                                employee: ['view', 'create', 'update', 'delete'],
                                position: ['view', 'create', 'update', 'delete'],
                                department: ['view', 'create', 'update', 'delete']
                            }
                        }
                    }
                }
            }
        });
    });

    // Master Data Mocks
    await page.route('**/api/accounts*', async route => {
        await route.fulfill({ json: { results: [{ id: 'acc1', name: 'Bank Account', type: 'bank', currency: 'CNY', active: 1 }] } });
    });
    await page.route('**/api/categories*', async route => {
        await route.fulfill({ json: { results: [{ id: 'cat1', name: 'Sales Income', kind: 'income', active: 1 }, { id: 'cat2', name: 'Office Expense', kind: 'expense', active: 1 }] } });
    });
    await page.route('**/api/departments*', async route => {
        await route.fulfill({ json: { results: [{ id: 'dept1', name: 'Sales Dept', active: 1 }] } });
    });
    await page.route('**/api/sites*', async route => {
        await route.fulfill({ json: { results: [] } });
    });
    await page.route('**/api/employees*', async route => {
        await route.fulfill({ json: { results: [] } });
    });
    await page.route('**/api/fixed-assets*', async route => {
        await route.fulfill({ json: { results: [] } });
    });
    await page.route('**/api/vendors*', async route => {
        await route.fulfill({ json: { results: [] } });
    });

    // Upload Mock
    await page.route('**/api/upload/voucher', async route => {
        await page.waitForTimeout(500);
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                url: 'http://mock/file.png',
                status: 'done',
                uid: 'mock-uid-1',
                name: 'voucher.png'
            })
        });
    });
}
