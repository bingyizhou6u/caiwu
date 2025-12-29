import React from 'react'
import { Result, Button, Space } from 'antd'
import { Logger } from '../utils/logger'

interface Props {
    children: React.ReactNode
    fallback?: React.ReactNode
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void
    showDetails?: boolean
}

interface State {
    hasError: boolean
    error: Error | null
    errorInfo: React.ErrorInfo | null
}

export class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props)
        this.state = { hasError: false, error: null, errorInfo: null }
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        // 记录错误信息
        this.setState({ errorInfo })

        // 开发环境下输出详细错误信息
        if (process.env.NODE_ENV === 'development') {
            Logger.error('[ErrorBoundary] 错误详情', { error, errorInfo })
        }

        // 调用自定义错误处理
        if (this.props.onError) {
            this.props.onError(error, errorInfo)
        }

        // 生产环境可以发送到错误监控服务（如 Sentry）
        // if (process.env.NODE_ENV === 'production') {
        //   Sentry.captureException(error, { contexts: { react: errorInfo } })
        // }
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null })
    }

    handleReload = () => {
        window.location.reload()
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback
            }

            const { error, errorInfo } = this.state
            const errorMessage = error?.message || '未知错误'
            const errorStack = error?.stack || errorInfo?.componentStack || ''

            return (
                <Result
                    status="error"
                    title="页面出错了"
                    subTitle={
                        <div>
                            <p>抱歉，页面加载出现问题</p>
                            {this.props.showDetails && (
                                <details style={{ marginTop: 16, textAlign: 'left' }}>
                                    <summary style={{ cursor: 'pointer', marginBottom: 8 }}>
                                        错误详情
                                    </summary>
                                    <div style={{
                                        background: '#f5f5f5',
                                        padding: 12,
                                        borderRadius: 4,
                                        fontSize: 12,
                                        maxHeight: 200,
                                        overflow: 'auto'
                                    }}>
                                        <div><strong>错误信息:</strong> {errorMessage}</div>
                                        {errorStack && (
                                            <div style={{ marginTop: 8 }}>
                                                <strong>堆栈信息:</strong>
                                                <pre style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>
                                                    {errorStack}
                                                </pre>
                                            </div>
                                        )}
                                    </div>
                                </details>
                            )}
                        </div>
                    }
                    extra={
                        <Space>
                            <Button type="primary" onClick={this.handleReset}>
                                重试
                            </Button>
                            <Button onClick={this.handleReload}>
                                刷新页面
                            </Button>
                        </Space>
                    }
                />
            )
        }

        return this.props.children
    }
}
