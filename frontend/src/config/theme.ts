import type { ThemeConfig } from 'antd'

export const theme: ThemeConfig = {
    token: {
        colorPrimary: '#6366f1', // Indigo 500 - Modern & Professional
        colorSuccess: '#10b981', // Emerald 500
        colorWarning: '#f59e0b', // Amber 500
        colorError: '#ef4444',   // Red 500
        colorInfo: '#3b82f6',    // Blue 500

        fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
        fontSize: 14,

        borderRadius: 8,
        borderRadiusLG: 12,
        borderRadiusSM: 6,

        wireframe: false,

        // Add some depth
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    },
    components: {
        Layout: {
            bodyBg: '#f8fafc', // Slate 50
            headerBg: 'rgba(255, 255, 255, 0.8)',
            siderBg: '#0f172a', // Slate 900
        },
        Menu: {
            darkItemBg: 'transparent',
            darkSubMenuItemBg: 'transparent',
            darkItemSelectedBg: '#6366f1', // Indigo 500
            itemBorderRadius: 8,
            itemMarginInline: 8,
        },
        Table: {
            headerBg: '#f8fafc', // Slate 50
            headerColor: '#475569', // Slate 600
            rowHoverBg: '#f1f5f9', // Slate 100
            headerBorderRadius: 8,
        },
        Card: {
            boxShadowTertiary: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)', // Shadow MD
            headerFontSize: 16,
        },
        Button: {
            borderRadius: 8,
            controlHeight: 36,
            controlHeightLG: 44,
            controlHeightSM: 28,
            primaryShadow: '0 4px 6px -1px rgba(99, 102, 241, 0.4), 0 2px 4px -1px rgba(99, 102, 241, 0.2)', // Indigo shadow
            defaultShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
            fontWeight: 500,
        },
        Input: {
            controlHeight: 36,
            controlHeightLG: 44,
            controlHeightSM: 28,
            borderRadius: 8,
            activeShadow: '0 0 0 2px rgba(99, 102, 241, 0.2)',
        },
        Select: {
            controlHeight: 36,
            controlHeightLG: 44,
            controlHeightSM: 28,
            borderRadius: 8,
        },
        Typography: {
            fontFamilyCode: 'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        }
    }
}
