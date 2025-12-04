import { Layout, Menu, Dropdown, Avatar, Button, theme } from 'antd'
import { UserOutlined, DownOutlined, LogoutOutlined, KeyOutlined, MenuFoldOutlined, MenuUnfoldOutlined, ThunderboltFilled } from '@ant-design/icons'
import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { buildMenuItems, KEY_TO_PATH } from '../config/menu'
import { MultiTabs } from '../components/MultiTabs'
import { GlobalSearch } from '../components/GlobalSearch'
import './MainLayout.css'

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
                <div className="user-menu-profile">
                    <div className="user-menu-name">{userInfo?.name}</div>
                    <div className="user-menu-email">{userInfo?.email}</div>
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
        <Layout className="main-layout">
            <Sider
                trigger={null}
                collapsible
                collapsed={collapsed}
                width={240}
                collapsedWidth={80}
                theme="dark"
                className="main-sider"
            >
                <div className={`logo-container ${collapsed ? 'collapsed' : ''}`}>
                    <ThunderboltFilled className="logo-icon" />
                    {!collapsed && <span className="logo-text">AR系统</span>}
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
            <Layout className="main-content-layout" style={{ marginLeft: collapsed ? 80 : 240 }}>
                <Header className="main-header">
                    <div
                        className="trigger-btn"
                        onClick={toggleCollapsed}
                    >
                        {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                    </div>
                    <div className="header-right">
                        <GlobalSearch />
                        <Dropdown menu={{ items: userMenu as any }} placement="bottomRight">
                            <div className="user-dropdown">
                                <Avatar icon={<UserOutlined />} className="user-avatar" />
                                <span className="user-name">{userInfo?.name}</span>
                                <DownOutlined style={{ fontSize: 12 }} />
                            </div>
                        </Dropdown>
                    </div>
                </Header>
                <Content className="main-content">
                    <MultiTabs />
                    <div className="content-wrapper">
                        <Outlet />
                    </div>
                </Content>
            </Layout>
        </Layout>
    )
}
