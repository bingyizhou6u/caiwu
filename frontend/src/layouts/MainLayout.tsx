import { Layout, Menu, Dropdown, Avatar, Spin, Button, theme } from 'antd'
import { UserOutlined, DownOutlined, LogoutOutlined, KeyOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons'
import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { buildMenuItems, KEY_TO_PATH } from '../config/menu'
import { MultiTabs } from '../components/MultiTabs'

const { Header, Sider, Content } = Layout

export function MainLayout() {
    const navigate = useNavigate()
    const location = useLocation()
    const {
        userInfo,
        collapsed,
        toggleCollapsed,
        logout
    } = useAppStore()

    const {
        token: { colorBgContainer, borderRadiusLG },
    } = theme.useToken()

    const [openKeys, setOpenKeys] = useState<string[]>([])
    const [selectedKey, setSelectedKey] = useState<string>('')



    useEffect(() => {
        const path = location.pathname.split('/').pop()
        if (path) setSelectedKey(path)
    }, [location])

    const handleLogout = () => {
        logout()
        navigate('/login')
    }

    const userMenu = [
        {
            key: 'profile',
            label: (
                <div style={{ padding: '4px 0' }}>
                    <div style={{ fontWeight: 'bold' }}>{userInfo?.name}</div>
                    <div style={{ fontSize: '12px', color: '#888' }}>{userInfo?.email}</div>
                </div>
            ),
        },
        { type: 'divider' },
        {
            key: 'change-password',
            icon: <KeyOutlined />,
            label: '修改密码',
            onClick: () => navigate('/change-password'),
        },
        { type: 'divider' },
        {
            key: 'logout',
            icon: <LogoutOutlined />,
            label: '退出登录',
            onClick: handleLogout,
        },
    ]

    // Handle Menu Click
    const onMenuClick = ({ key }: { key: string }) => {
        const path = KEY_TO_PATH[key] || `/${key}`
        navigate(path)
    }

    // Handle Menu Open Change (Accordion)
    const onOpenChange = (keys: string[]) => {
        const latestOpenKey = keys.find(key => openKeys.indexOf(key) === -1)
        if (!latestOpenKey) {
            setOpenKeys(keys)
            return
        }

        // Root keys (level 1 menu items)
        const rootKeys = ['my', 'finance', 'sites', 'fixed-assets-menu', 'employees', 'reports', 'system']

        if (rootKeys.indexOf(latestOpenKey) === -1) {
            setOpenKeys(keys)
        } else {
            setOpenKeys(latestOpenKey ? [latestOpenKey] : [])
        }
    }

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Sider
                trigger={null}
                collapsible
                collapsed={collapsed}
                width={220}
                theme="dark"
                style={{
                    overflow: 'auto',
                    height: '100vh',
                    position: 'fixed',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    zIndex: 1001
                }}
            >
                <div style={{
                    height: 64,
                    margin: 16,
                    background: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: collapsed ? 12 : 16,
                    transition: 'all 0.2s'
                }}>
                    {collapsed ? 'AR' : 'AR公司管理系统'}
                </div>
                <Menu
                    theme="dark"
                    mode="inline"
                    selectedKeys={[selectedKey]}
                    openKeys={openKeys}
                    onOpenChange={onOpenChange}
                    items={buildMenuItems(userInfo)}
                    onClick={onMenuClick}
                />
            </Sider>
            <Layout style={{ marginLeft: collapsed ? 80 : 220, transition: 'all 0.2s' }}>
                <Header style={{
                    padding: 0,
                    background: colorBgContainer,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    position: 'sticky',
                    top: 0,
                    zIndex: 1000,
                    boxShadow: '0 1px 4px rgba(0,21,41,0.08)'
                }}>
                    <Button
                        type="text"
                        icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                        onClick={toggleCollapsed}
                        style={{
                            fontSize: '16px',
                            width: 64,
                            height: 64,
                        }}
                    />
                    <div style={{ marginRight: 24 }}>
                        <Dropdown menu={{ items: userMenu as any }} placement="bottomRight">
                            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#1890ff', marginRight: 8 }} />
                                <span style={{ marginRight: 8 }}>{userInfo?.name}</span>
                                <DownOutlined style={{ fontSize: 12 }} />
                            </div>
                        </Dropdown>
                    </div>
                </Header>
                <Content style={{ margin: '24px 16px 0', overflow: 'initial' }}>
                    <MultiTabs />
                    <div style={{
                        padding: 24,
                        minHeight: 360,
                        background: colorBgContainer,
                        borderRadius: borderRadiusLG,
                        marginTop: 16
                    }}>
                        <Outlet />
                    </div>
                </Content>
            </Layout>
        </Layout>
    )
}
