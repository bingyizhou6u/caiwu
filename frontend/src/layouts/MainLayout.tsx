import { Layout, Menu, Dropdown, Avatar, Button, theme, MenuProps } from 'antd'
import { UserOutlined, DownOutlined, LogoutOutlined, KeyOutlined, MenuFoldOutlined, MenuUnfoldOutlined, ThunderboltFilled, SunOutlined, MoonOutlined } from '@ant-design/icons'
import { useState, useEffect, useMemo, useRef } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import NProgress from 'nprogress'
import { useAppStore } from '../store/useAppStore'
import { buildMenuItems, KEY_TO_PATH, PATH_TO_KEY } from '../config/menu'
import { MultiTabs } from '../components/MultiTabs'
import { preloadRoute } from '../router'
import './MainLayout.css'

const { Header, Sider, Content } = Layout

export function MainLayout() {
    const navigate = useNavigate()
    const location = useLocation()
    const {
        userInfo,
        collapsed,
        toggleCollapsed,
        setCollapsed,
        logout,
        themeMode,
        toggleTheme
    } = useAppStore()
    
    const [hoverExpanded, setHoverExpanded] = useState(false)
    const siderRef = useRef<HTMLDivElement>(null)
    const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    const {
        token: { colorBgContainer, borderRadiusLG },
    } = theme.useToken()

    const [openKeys, setOpenKeys] = useState<string[]>([])
    const [selectedKey, setSelectedKey] = useState<string>('')

    // NProgress & Route Highlighting
    useEffect(() => {
        NProgress.done()
        // 使用完整路径匹配菜单 key
        const menuKey = PATH_TO_KEY[location.pathname]
        if (menuKey) {
            setSelectedKey(menuKey)
        }
    }, [location])
    
    // Hover expand handlers
    const handleSiderMouseEnter = () => {
        if (collapsed && !hoverExpanded) {
            if (hoverTimeoutRef.current) {
                clearTimeout(hoverTimeoutRef.current)
            }
            setHoverExpanded(true)
            setCollapsed(false)
        }
    }
    
    const handleSiderMouseLeave = () => {
        if (hoverExpanded) {
            hoverTimeoutRef.current = setTimeout(() => {
                setHoverExpanded(false)
                setCollapsed(true)
            }, 200) // 200ms 延迟，避免快速移动时闪烁
        }
    }
    
    useEffect(() => {
        return () => {
            if (hoverTimeoutRef.current) {
                clearTimeout(hoverTimeoutRef.current)
            }
        }
    }, [])

    const handleLogout = async () => {
        // 调用后端 API 使 session 失效
        const { token } = useAppStore.getState()
        if (token) {
            try {
                await fetch('/api/v2/auth/logout', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                })
            } catch {
                // 即使后端调用失败，也继续清除本地状态
            }
        }
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
        if (location.pathname !== path) {
            NProgress.start()
            navigate(path)
        }
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

    // 递归包装菜单项以添加 Suspense 预加载
    const wrapMenuItemsWithPreload = (items: MenuProps['items']): MenuProps['items'] => {
        return items?.map((item: any) => {
            if (item && item.children) {
                return {
                    ...item,
                    children: wrapMenuItemsWithPreload(item.children)
                }
            }
            if (item && item.key) {
                return {
                    ...item,
                    label: (
                        <div
                            onMouseEnter={() => {
                                // 尝试通过 key 预加载，如果 key 本身就是路径片段（如 'finance/ar'）
                                // 或者需要查 KEY_TO_PATH
                                // 目前 router 配置使用的是路径作为 key，而 menu 配置也是尽量对应
                                // 简单尝试直接使用 key，或者查找 mapping
                                let routeKey = item.key;
                                // 处理一些已知的 key 映射
                                if (KEY_TO_PATH[item.key]) {
                                    // KEY_TO_PATH 值是完整路径 '/finance/ar'，去掉开头的 '/'
                                    routeKey = KEY_TO_PATH[item.key].substring(1);
                                }
                                preloadRoute(routeKey);
                            }}
                            style={{ width: '100%', height: '100%', display: 'inline-block' }}
                        >
                            {item.label}
                        </div>
                    )
                }
            }
            return item
        })
    }

    const menuItems = useMemo(() => {
        const items = buildMenuItems(userInfo)
        return wrapMenuItemsWithPreload(items)
    }, [userInfo])

    return (
        <Layout className="main-layout">
            <Sider
                ref={siderRef}
                trigger={null}
                collapsible
                collapsed={collapsed && !hoverExpanded}
                width={240}
                collapsedWidth={80}
                theme="dark"
                className="main-sider"
                onMouseEnter={handleSiderMouseEnter}
                onMouseLeave={handleSiderMouseLeave}
            >
                <div className={`logo-container ${collapsed && !hoverExpanded ? 'collapsed' : ''}`}>
                    <ThunderboltFilled className="logo-icon" />
                    {(!collapsed || hoverExpanded) && <span className="logo-text">AR管理系统</span>}
                </div>
                <Menu
                    theme="dark"
                    mode="inline"
                    selectedKeys={[selectedKey]}
                    openKeys={openKeys}
                    onOpenChange={onOpenChange}
                    items={menuItems}
                    onClick={onMenuClick}
                    inlineCollapsed={collapsed && !hoverExpanded}
                    getPopupContainer={(node) => node.parentElement || document.body}
                />
            </Sider>
            <Layout className="main-content-layout" style={{ marginLeft: (collapsed && !hoverExpanded) ? 80 : 240 }}>
                <Header className="main-header">
                    <div
                        className="trigger-btn"
                        onClick={toggleCollapsed}
                    >
                        {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                    </div>
                    <div className="header-right">
                        <div
                            className="theme-toggle-btn"
                            onClick={toggleTheme}
                            title={themeMode === 'light' ? '切换到暗色模式' : '切换到亮色模式'}
                        >
                            {themeMode === 'light' ? <MoonOutlined /> : <SunOutlined />}
                        </div>
                        <Dropdown menu={{ items: userMenu }} placement="bottomRight">
                            <div className="user-dropdown">
                                <Avatar icon={<UserOutlined />} className="user-avatar" />
                                <span className="user-name">{userInfo?.name}</span>
                                <DownOutlined style={{ fontSize: 12 }} />
                            </div>
                        </Dropdown>
                    </div>
                </Header>
                <MultiTabs />
                <Content className="main-content">
                    <div className="content-wrapper">
                        <Outlet />
                    </div>
                </Content>
            </Layout>
        </Layout>
    )
}
