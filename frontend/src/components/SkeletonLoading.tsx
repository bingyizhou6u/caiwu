import { Layout, Skeleton, Space } from 'antd'
import React from 'react'

const { Header, Sider, Content } = Layout

export const SkeletonLoading: React.FC = () => {
    return (
        <Layout style={{ minHeight: '100vh' }}>
            {/* Sidebar Skeleton */}
            <Sider width={240} style={{ background: '#001529' }}>
                <div style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Skeleton.Avatar active size="large" shape="square" style={{ opacity: 0.3 }} />
                </div>
                <div style={{ padding: '20px' }}>
                    <Skeleton active paragraph={{ rows: 8, width: '100%' }} title={false} />
                </div>
            </Sider>

            <Layout>
                {/* Header Skeleton */}
                <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Skeleton.Button active size="small" shape="square" />
                    <Space>
                        <Skeleton.Input active size="small" style={{ width: 200 }} />
                        <Skeleton.Avatar active size="default" />
                    </Space>
                </Header>

                {/* Content Skeleton */}
                <Content style={{ margin: '24px 16px', padding: 24, background: '#fff', minHeight: 280 }}>
                    <div style={{ marginBottom: 24 }}>
                        <Skeleton.Input active size="large" style={{ width: 300, marginBottom: 16 }} />
                    </div>

                    <Space style={{ marginBottom: 24 }}>
                        <Skeleton.Button active size="default" />
                        <Skeleton.Button active size="default" />
                        <Skeleton.Button active size="default" />
                    </Space>

                    <Skeleton active paragraph={{ rows: 10 }} />
                </Content>
            </Layout>
        </Layout>
    )
}
