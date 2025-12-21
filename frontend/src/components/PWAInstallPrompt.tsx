/**
 * PWA 安装提示组件
 * 在电脑端显示安装提示横幅
 */
import { useState, useEffect } from 'react'
import { Button, Space, Typography, message } from 'antd'
import {
  DownloadOutlined,
  CloseOutlined,
  DesktopOutlined,
  CheckCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons'
import { usePWA } from '../hooks/usePWA'
import './PWAInstallPrompt.css'

const { Text } = Typography

export function PWAInstallPrompt() {
  const {
    canInstall,
    isInstalled,
    hasUpdate,
    platform,
    install,
    applyUpdate,
    dismissInstall,
  } = usePWA()

  const [visible, setVisible] = useState(false)
  const [installing, setInstalling] = useState(false)

  // 延迟显示安装提示（用户进入页面3秒后）
  useEffect(() => {
    if (canInstall && !isInstalled) {
      const timer = setTimeout(() => setVisible(true), 3000)
      return () => clearTimeout(timer)
    }
    setVisible(false)
  }, [canInstall, isInstalled])

  // 处理安装
  const handleInstall = async () => {
    setInstalling(true)
    try {
      const success = await install()
      if (success) {
        message.success('🎉 应用安装成功！')
      }
    } finally {
      setInstalling(false)
    }
  }

  // 处理关闭
  const handleDismiss = () => {
    setVisible(false)
    dismissInstall()
  }

  // 处理更新
  const handleUpdate = () => {
    message.loading('正在更新...')
    applyUpdate()
  }

  // 获取平台特定文案
  const getPlatformText = () => {
    switch (platform) {
      case 'windows':
        return '安装到 Windows 桌面'
      case 'macos':
        return '安装到 macOS 程序坞'
      case 'linux':
        return '安装到桌面'
      default:
        return '安装到桌面'
    }
  }

  // 显示更新提示
  if (hasUpdate) {
    return (
      <div className="pwa-update-banner">
        <div className="pwa-update-content">
          <SyncOutlined spin className="pwa-update-icon" />
          <Text className="pwa-update-text">发现新版本，点击更新获取最新功能</Text>
          <Button
            type="primary"
            size="small"
            icon={<SyncOutlined />}
            onClick={handleUpdate}
          >
            立即更新
          </Button>
        </div>
      </div>
    )
  }

  // 已安装状态（可选显示）
  if (isInstalled && !visible) {
    return null
  }

  // 安装提示
  if (!visible) {
    return null
  }

  return (
    <div className="pwa-install-banner">
      <div className="pwa-install-content">
        <div className="pwa-install-info">
          <DesktopOutlined className="pwa-install-icon" />
          <div className="pwa-install-text">
            <Text strong className="pwa-install-title">
              {getPlatformText()}
            </Text>
            <Text type="secondary" className="pwa-install-desc">
              获得更流畅的使用体验，支持离线访问和桌面快捷方式
            </Text>
          </div>
        </div>
        <Space className="pwa-install-actions">
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            loading={installing}
            onClick={handleInstall}
          >
            安装应用
          </Button>
          <Button
            type="text"
            icon={<CloseOutlined />}
            onClick={handleDismiss}
            className="pwa-dismiss-btn"
          />
        </Space>
      </div>
    </div>
  )
}

/**
 * PWA 状态指示器（可选，用于显示在线/离线状态）
 */
export function PWAStatusIndicator() {
  const { isOnline, isInstalled } = usePWA()

  if (!isInstalled) return null

  return (
    <div className={`pwa-status ${isOnline ? 'online' : 'offline'}`}>
      {isOnline ? (
        <CheckCircleOutlined />
      ) : (
        <span className="offline-dot" />
      )}
      <span className="status-text">
        {isOnline ? '在线' : '离线模式'}
      </span>
    </div>
  )
}

export default PWAInstallPrompt

