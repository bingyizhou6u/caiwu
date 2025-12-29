/**
 * PWA 功能 Hook
 * 提供安装提示、更新检测、离线状态等功能
 */
import { useState, useEffect, useCallback } from 'react'
import { Logger } from '../utils/logger'

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
  prompt(): Promise<void>
}

interface PWAState {
  // 是否可以安装（显示安装提示）
  canInstall: boolean
  // 是否已安装为 PWA
  isInstalled: boolean
  // 是否处于 standalone 模式
  isStandalone: boolean
  // 是否在线
  isOnline: boolean
  // 是否有新版本可用
  hasUpdate: boolean
  // 安装来源平台
  platform: 'windows' | 'macos' | 'linux' | 'ios' | 'android' | 'unknown'
}

/**
 * 检测当前平台
 */
function detectPlatform(): PWAState['platform'] {
  const ua = navigator.userAgent.toLowerCase()
  if (/iphone|ipad|ipod/.test(ua)) return 'ios'
  if (/android/.test(ua)) return 'android'
  if (/win/.test(ua)) return 'windows'
  if (/mac/.test(ua)) return 'macos'
  if (/linux/.test(ua)) return 'linux'
  return 'unknown'
}

/**
 * 检测是否已安装为 PWA
 */
function checkIsInstalled(): boolean {
  // 检测 standalone 模式
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  // iOS Safari 的特殊检测
  if ((navigator as any).standalone === true) return true
  // 检测是否从主屏幕启动
  if (document.referrer.includes('android-app://')) return true
  return false
}

export function usePWA() {
  const [state, setState] = useState<PWAState>({
    canInstall: false,
    isInstalled: checkIsInstalled(),
    isStandalone: window.matchMedia('(display-mode: standalone)').matches,
    isOnline: navigator.onLine,
    hasUpdate: false,
    platform: detectPlatform(),
  })

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  // 安装 PWA
  const install = useCallback(async () => {
    if (!deferredPrompt) {
      Logger.warn('安装提示不可用')
      return false
    }

    try {
      // 显示安装提示
      await deferredPrompt.prompt()

      // 等待用户响应
      const { outcome } = await deferredPrompt.userChoice

      if (outcome === 'accepted') {
        Logger.info('✅ 用户同意安装 PWA')
        setState(prev => ({ ...prev, canInstall: false, isInstalled: true }))
        setDeferredPrompt(null)
        return true
      } else {
        Logger.info('❌ 用户拒绝安装 PWA')
        return false
      }
    } catch (error) {
      Logger.error('安装 PWA 失败', { error })
      return false
    }
  }, [deferredPrompt])

  // 刷新应用以应用更新
  const applyUpdate = useCallback(() => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      // 通知 Service Worker 跳过等待
      navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' })
    }
    // 刷新页面
    window.location.reload()
  }, [])

  // 关闭安装提示（用户选择不安装）
  const dismissInstall = useCallback(() => {
    setState(prev => ({ ...prev, canInstall: false }))
    setDeferredPrompt(null)
    // 记录用户选择，24小时内不再提示
    localStorage.setItem('pwa-install-dismissed', Date.now().toString())
  }, [])

  // 检查是否应该显示安装提示
  const shouldShowInstallPrompt = useCallback(() => {
    const dismissed = localStorage.getItem('pwa-install-dismissed')
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10)
      const hoursSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60)
      if (hoursSinceDismissed < 24) {
        return false
      }
    }
    return true
  }, [])

  useEffect(() => {
    // 监听 beforeinstallprompt 事件
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      const event = e as BeforeInstallPromptEvent

      if (shouldShowInstallPrompt()) {
        setDeferredPrompt(event)
        setState(prev => ({ ...prev, canInstall: true }))
      }
    }

    // 监听应用安装成功
    const handleAppInstalled = () => {
      Logger.info('✅ PWA 安装成功')
      setState(prev => ({ ...prev, canInstall: false, isInstalled: true }))
      setDeferredPrompt(null)
    }

    // 监听在线状态变化
    const handleOnline = () => setState(prev => ({ ...prev, isOnline: true }))
    const handleOffline = () => setState(prev => ({ ...prev, isOnline: false }))

    // 监听 Service Worker 更新
    const handleSWUpdate = () => {
      setState(prev => ({ ...prev, hasUpdate: true }))
    }

    // 监听 display-mode 变化
    const displayModeQuery = window.matchMedia('(display-mode: standalone)')
    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      setState(prev => ({ ...prev, isStandalone: e.matches }))
    }

    // 添加事件监听
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('sw-update-available', handleSWUpdate)
    displayModeQuery.addEventListener('change', handleDisplayModeChange)

    // 清理
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('sw-update-available', handleSWUpdate)
      displayModeQuery.removeEventListener('change', handleDisplayModeChange)
    }
  }, [shouldShowInstallPrompt])

  return {
    ...state,
    install,
    applyUpdate,
    dismissInstall,
  }
}

export default usePWA

