import type { ThemeConfig } from 'antd'
import { theme as antdTheme } from 'antd'

/**
 * Apple Style Theme Configuration
 * 基于 Apple Human Interface Guidelines 的主题配置
 */

// SF Pro 风格字体栈
const fontFamily = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", "Segoe UI", Roboto, Arial, sans-serif'
const fontFamilyCode = '"SF Mono", SFMono-Regular, ui-monospace, Menlo, Monaco, "Cascadia Mono", "Segoe UI Mono", monospace'

// 亮色主题
export const lightTheme: ThemeConfig = {
    token: {
        // Apple System Colors
        colorPrimary: '#007AFF',      // Apple Blue
        colorSuccess: '#34C759',      // Apple Green
        colorWarning: '#FF9500',      // Apple Orange
        colorError: '#FF3B30',        // Apple Red
        colorInfo: '#5AC8FA',         // Apple Teal

        // Typography
        fontFamily,
        fontSize: 14,

        // Border Radius - Apple 风格更大圆角
        borderRadius: 8,
        borderRadiusLG: 16,
        borderRadiusSM: 6,
        borderRadiusXS: 4,

        wireframe: false,

        // Shadows - Apple 风格柔和阴影
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
        boxShadowSecondary: '0 8px 24px rgba(0, 0, 0, 0.12)',

        // Colors
        colorBgContainer: '#FFFFFF',
        colorBgElevated: '#FFFFFF',
        colorBgLayout: '#F2F2F7',
        colorBorder: 'rgba(60, 60, 67, 0.12)',
        colorBorderSecondary: 'rgba(60, 60, 67, 0.08)',

        // Text Colors
        colorText: '#000000',
        colorTextSecondary: '#3C3C43',
        colorTextTertiary: '#8E8E93',
        colorTextQuaternary: '#C7C7CC',

        // Motion
        motionDurationFast: '0.15s',
        motionDurationMid: '0.25s',
        motionDurationSlow: '0.35s',
    },
    components: {
        Layout: {
            bodyBg: '#F2F2F7',
            headerBg: 'rgba(255, 255, 255, 0.72)',
            siderBg: '#F2F2F7',
        },
        Menu: {
            itemBg: 'transparent',
            subMenuItemBg: 'transparent',
            itemSelectedBg: 'rgba(120, 120, 128, 0.16)',
            itemSelectedColor: '#007AFF',
            itemHoverBg: 'rgba(118, 118, 128, 0.12)',
            itemHoverColor: '#000000',
            itemColor: '#3C3C43',
            darkItemBg: 'transparent',
            darkSubMenuItemBg: 'transparent',
            darkItemSelectedBg: 'rgba(120, 120, 128, 0.16)',
            darkItemSelectedColor: '#0A84FF',
            darkItemHoverBg: 'rgba(118, 118, 128, 0.24)',
            darkItemHoverColor: '#FFFFFF',
            darkItemColor: '#EBEBF5',
            itemBorderRadius: 8,
            itemMarginInline: 8,
            itemHeight: 36,
        },
        Table: {
            headerBg: '#F2F2F7',
            headerColor: '#8E8E93',
            rowHoverBg: 'rgba(118, 118, 128, 0.12)',
            headerBorderRadius: 0,
            borderColor: 'rgba(60, 60, 67, 0.12)',
            headerSplitColor: 'transparent',
            cellPaddingBlock: 12,
            cellPaddingInline: 16,
        },
        Card: {
            borderRadiusLG: 16,
            boxShadowTertiary: '0 4px 12px rgba(0, 0, 0, 0.08)',
            headerFontSize: 17,
            actionsBg: 'transparent',
            paddingLG: 20,
        },
        Button: {
            borderRadius: 8,
            controlHeight: 36,
            controlHeightLG: 44,
            controlHeightSM: 28,
            primaryShadow: 'none',
            defaultShadow: 'none',
            fontWeight: 500,
            paddingInline: 16,
        },
        Input: {
            controlHeight: 36,
            controlHeightLG: 44,
            controlHeightSM: 28,
            borderRadius: 8,
            activeShadow: '0 0 0 3px rgba(0, 122, 255, 0.12)',
            hoverBorderColor: '#007AFF',
            activeBorderColor: '#007AFF',
        },
        Select: {
            controlHeight: 36,
            controlHeightLG: 44,
            controlHeightSM: 28,
            borderRadius: 8,
            optionSelectedBg: 'rgba(120, 120, 128, 0.16)',
        },
        Typography: {
            fontFamilyCode,
        },
        Modal: {
            borderRadiusLG: 20,
            headerBg: 'transparent',
            paddingContentHorizontalLG: 24,
        },
        Tabs: {
            itemColor: '#8E8E93',
            itemSelectedColor: '#000000',
            itemHoverColor: '#3C3C43',
            inkBarColor: '#007AFF',
        },
        Switch: {
            colorPrimary: '#34C759',
            colorPrimaryHover: '#30D158',
        },
        Pagination: {
            itemActiveBg: '#007AFF',
            borderRadius: 8,
        },
        Tag: {
            borderRadiusSM: 8,
        },
        Dropdown: {
            borderRadiusLG: 12,
            paddingBlock: 4,
        },
        Tooltip: {
            borderRadius: 8,
        },
        Popover: {
            borderRadiusLG: 12,
        },
        Message: {
            borderRadiusLG: 12,
        },
        Notification: {
            borderRadiusLG: 16,
        },
    }
}

// 暗色主题
export const darkTheme: ThemeConfig = {
    algorithm: antdTheme.darkAlgorithm,
    token: {
        // Apple System Colors (Dark) - 略微调亮
        colorPrimary: '#0A84FF',      // Apple Blue (Dark)
        colorSuccess: '#30D158',      // Apple Green (Dark)
        colorWarning: '#FF9F0A',      // Apple Orange (Dark)
        colorError: '#FF453A',        // Apple Red (Dark)
        colorInfo: '#64D2FF',         // Apple Teal (Dark)

        // Typography
        fontFamily,
        fontSize: 14,

        // Border Radius
        borderRadius: 8,
        borderRadiusLG: 16,
        borderRadiusSM: 6,
        borderRadiusXS: 4,

        wireframe: false,

        // Shadows
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
        boxShadowSecondary: '0 8px 24px rgba(0, 0, 0, 0.3)',

        // Colors
        colorBgContainer: '#1C1C1E',
        colorBgElevated: '#2C2C2E',
        colorBgLayout: '#000000',
        colorBorder: 'rgba(84, 84, 88, 0.65)',
        colorBorderSecondary: 'rgba(84, 84, 88, 0.4)',

        // Text Colors
        colorText: '#FFFFFF',
        colorTextSecondary: '#EBEBF5',
        colorTextTertiary: '#8E8E93',
        colorTextQuaternary: '#636366',

        // Motion
        motionDurationFast: '0.15s',
        motionDurationMid: '0.25s',
        motionDurationSlow: '0.35s',
    },
    components: {
        Layout: {
            bodyBg: '#000000',
            headerBg: 'rgba(28, 28, 30, 0.72)',
            siderBg: '#1C1C1E',
        },
        Menu: {
            itemBg: 'transparent',
            subMenuItemBg: 'transparent',
            itemSelectedBg: 'rgba(120, 120, 128, 0.32)',
            itemSelectedColor: '#0A84FF',
            itemHoverBg: 'rgba(118, 118, 128, 0.24)',
            itemHoverColor: '#FFFFFF',
            itemColor: '#EBEBF5',
            darkItemBg: 'transparent',
            darkSubMenuItemBg: 'transparent',
            darkItemSelectedBg: 'rgba(120, 120, 128, 0.32)',
            darkItemSelectedColor: '#0A84FF',
            darkItemHoverBg: 'rgba(118, 118, 128, 0.24)',
            darkItemHoverColor: '#FFFFFF',
            darkItemColor: '#EBEBF5',
            itemBorderRadius: 8,
            itemMarginInline: 8,
            itemHeight: 36,
        },
        Table: {
            headerBg: '#1C1C1E',
            headerColor: '#8E8E93',
            rowHoverBg: 'rgba(118, 118, 128, 0.24)',
            headerBorderRadius: 0,
            borderColor: 'rgba(84, 84, 88, 0.65)',
            headerSplitColor: 'transparent',
            cellPaddingBlock: 12,
            cellPaddingInline: 16,
        },
        Card: {
            colorBgContainer: '#1C1C1E',
            borderRadiusLG: 16,
            boxShadowTertiary: '0 4px 12px rgba(0, 0, 0, 0.3)',
            headerFontSize: 17,
            actionsBg: 'transparent',
            paddingLG: 20,
        },
        Button: {
            borderRadius: 8,
            controlHeight: 36,
            controlHeightLG: 44,
            controlHeightSM: 28,
            primaryShadow: 'none',
            defaultShadow: 'none',
            fontWeight: 500,
            paddingInline: 16,
        },
        Input: {
            controlHeight: 36,
            controlHeightLG: 44,
            controlHeightSM: 28,
            borderRadius: 8,
            activeShadow: '0 0 0 3px rgba(10, 132, 255, 0.2)',
            hoverBorderColor: '#0A84FF',
            activeBorderColor: '#0A84FF',
            colorBgContainer: '#2C2C2E',
        },
        Select: {
            controlHeight: 36,
            controlHeightLG: 44,
            controlHeightSM: 28,
            borderRadius: 8,
            colorBgContainer: '#2C2C2E',
            optionSelectedBg: 'rgba(120, 120, 128, 0.32)',
        },
        Typography: {
            fontFamilyCode,
        },
        Modal: {
            borderRadiusLG: 20,
            headerBg: 'transparent',
            contentBg: '#1C1C1E',
            paddingContentHorizontalLG: 24,
        },
        Tabs: {
            itemColor: '#8E8E93',
            itemSelectedColor: '#FFFFFF',
            itemHoverColor: '#EBEBF5',
            inkBarColor: '#0A84FF',
        },
        Switch: {
            colorPrimary: '#30D158',
            colorPrimaryHover: '#34C759',
        },
        Pagination: {
            itemActiveBg: '#0A84FF',
            borderRadius: 8,
        },
        Tag: {
            borderRadiusSM: 8,
        },
        Dropdown: {
            borderRadiusLG: 12,
            paddingBlock: 4,
            colorBgElevated: '#2C2C2E',
        },
        Tooltip: {
            borderRadius: 8,
            colorBgSpotlight: '#2C2C2E',
        },
        Popover: {
            borderRadiusLG: 12,
            colorBgElevated: '#2C2C2E',
        },
        Message: {
            borderRadiusLG: 12,
        },
        Notification: {
            borderRadiusLG: 16,
            colorBgElevated: '#2C2C2E',
        },
    }
}

// 获取主题配置
export const getTheme = (mode: 'light' | 'dark'): ThemeConfig => {
    return mode === 'dark' ? darkTheme : lightTheme
}
