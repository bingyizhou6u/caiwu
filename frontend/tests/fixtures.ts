
import { test as base, expect, Fixtures, Page } from '@playwright/test';
import { addCoverageReport } from 'monocart-reporter';

// Define fixture type
type CoverageFixture = {
    autoTestFixture: string;
};

export const test = base.extend<CoverageFixture>({
    autoTestFixture: [async ({ page }: { page: Page }, use: (r: string) => Promise<void>) => {
        // console.log('autoTestFixture setup...');
        // install coverage report
        const isCoverage = process.env.VITE_COVERAGE === 'true';
        if (isCoverage) {
            await Promise.all([
                page.coverage.startJSCoverage({
                    resetOnNavigation: false
                }),
                page.coverage.startCSSCoverage({
                    resetOnNavigation: false
                })
            ]);
        }

        await use('autoTestFixture');

        // console.log('autoTestFixture teardown...');
        if (isCoverage) {
            // v8 coverage
            const [jsCoverage, cssCoverage] = await Promise.all([
                page.coverage.stopJSCoverage(),
                page.coverage.stopCSSCoverage()
            ]);

            // istanbul coverage
            const coverageData = await page.evaluate(() => window.__coverage__);

            await addCoverageReport(coverageData, test.info());
        }

    }, { scope: 'test', auto: true }]
});

export { expect };
