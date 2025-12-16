import { Skeleton, Space } from 'antd'
import React from 'react'

/**
 * 内容区域骨架屏
 * 注意：此组件用于 MainLayout 内部的 Suspense fallback
 * 不应包含 Sider/Header，因为它们由 MainLayout 渲染
 */
export const SkeletonLoading: React.FC = () => {
    return (
        <div style={{ padding: '24px', width: '100%' }}>
            {/* 页面标题骨架 */}
            <Skeleton.Input active size="large" style={{ width: 200, marginBottom: 24 }} />

            {/* 操作按钮区骨架 */}
            <Space style={{ marginBottom: 24 }}>
                <Skeleton.Button active size="default" />
                <Skeleton.Button active size="default" />
                <Skeleton.Button active size="default" />
            </Space>

            {/* 表格/内容区骨架 */}
            <Skeleton active paragraph={{ rows: 12 }} />
        </div>
    )
}
