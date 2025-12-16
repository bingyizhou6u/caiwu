import type { ThemeConfig } from 'antd'
import { theme as antdTheme } from 'antd'

// 亮色主题
export const lightTheme: ThemeConfig = {
    token: {
        colorPrimary: '#6366f1', // Indigo 500 - Modern & Professional
        colorSuccess: '#10b981', // Emerald 500
        colorWarning: '#f59e0b', // Amber 500
        colorError: '#ef4444',   // Red 500
        colorInfo: '#3b82f6',    // Blue 500

        fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
        fontSize: 14,

        borderRadius: 8,
        borderRadiusLG: 16, // Increased for modern card look
        borderRadiusSM: 6,

        wireframe: false,

        // Add some depth
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
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
            itemBorderRadius: 12, // Match sidebar item styling
            itemMarginInline: 8,
        },
        Table: {
            headerBg: 'transparent', // Cleaner look
            headerColor: '#64748b', // Slate 500
            rowHoverBg: '#f8fafc', // Slate 50
            headerBorderRadius: 8,
            borderColor: '#f1f5f9', // Lighter border
            headerSplitColor: 'transparent', // Remove vertical separators
        },
        Card: {
            boxShadowTertiary: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)', // Premium Shadow
            headerFontSize: 16,
            actionsBg: 'transparent',
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
            hoverBorderColor: '#6366f1',
        },
        Select: {
            controlHeight: 36,
            controlHeightLG: 44,
            controlHeightSM: 28,
            borderRadius: 8,
            hoverBorderColor: '#6366f1',
        },
        Typography: {
            fontFamilyCode: 'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        },
        Modal: {
            borderRadiusLG: 16,
            headerBg: 'transparent',
        }
    }
}

// 暗色主题
export const darkTheme: ThemeConfig = {
    algorithm: antdTheme.darkAlgorithm,
    token: {
        colorPrimary: '#818cf8', // Indigo 400 - 暗色下更亮一点
        colorSuccess: '#34d399', // Emerald 400
        colorWarning: '#fbbf24', // Amber 400
        colorError: '#f87171',   // Red 400
        colorInfo: '#60a5fa',    // Blue 400

        fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
        fontSize: 14,

        borderRadius: 8,
        borderRadiusLG: 16,
        borderRadiusSM: 6,

        wireframe: false,

        colorBgContainer: '#1e293b', // Slate 800
        colorBgElevated: '#334155',  // Slate 700
        colorBgLayout: '#0f172a',    // Slate 900
        colorBorder: '#475569',      // Slate 600
        colorBorderSecondary: '#334155', // Slate 700
    },
    components: {
        Layout: {
            bodyBg: '#0f172a',    // Slate 900
            headerBg: 'rgba(30, 41, 59, 0.9)', // Slate 800 with opacity
            siderBg: '#0f172a',  // Slate 900
        },
        Menu: {
            darkItemBg: 'transparent',
            darkSubMenuItemBg: 'transparent',
            darkItemSelectedBg: '#6366f1',
            itemBorderRadius: 12,
            itemMarginInline: 8,
        },
        Table: {
            headerBg: '#1e293b',
            headerColor: '#94a3b8',
            rowHoverBg: '#334155',
            headerBorderRadius: 8,
            borderColor: '#334155',
            headerSplitColor: 'transparent',
        },
        Card: {
            colorBgContainer: '#1e293b',
            boxShadowTertiary: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
            headerFontSize: 16,
            actionsBg: 'transparent',
        },
        Button: {
            borderRadius: 8,
            controlHeight: 36,
            controlHeightLG: 44,
            controlHeightSM: 28,
            primaryShadow: '0 4px 6px -1px rgba(129, 140, 248, 0.4)',
            defaultShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.2)',
            fontWeight: 500,
        },
        Input: {
            controlHeight: 36,
            controlHeightLG: 44,
            controlHeightSM: 28,
            borderRadius: 8,
            activeShadow: '0 0 0 2px rgba(129, 140, 248, 0.3)',
            hoverBorderColor: '#818cf8',
            colorBgContainer: '#1e293b',
        },
        Select: {
            controlHeight: 36,
            controlHeightLG: 44,
            controlHeightSM: 28,
            borderRadius: 8,
            hoverBorderColor: '#818cf8',
            colorBgContainer: '#1e293b',
        },
        Typography: {
            fontFamilyCode: 'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        },
        Modal: {
            borderRadiusLG: 16,
            headerBg: 'transparent',
            contentBg: '#1e293b',
        }
    }
}

// 获取主题配置
export const getTheme = (mode: 'light' | 'dark'): ThemeConfig => {
    return mode === 'dark' ? darkTheme : lightTheme
}

// 保持向后兼容
export const theme = lightTheme
