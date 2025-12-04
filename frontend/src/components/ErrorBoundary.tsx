import React from 'react'
import { Result, Button } from 'antd'

interface Props {
    children: React.ReactNode
    fallback?: React.ReactNode
}

interface State {
    hasError: boolean
    error: Error | null
}

export class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('[ErrorBoundary]', error, errorInfo)
        // In production, you would log this to an error reporting service like Sentry
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback
            }

            return (
                <Result
                    status="error"
                    title="出错了"
                    subTitle="抱歉，页面加载出现问题"
                    extra={
                        <Button type="primary" onClick={() => window.location.reload()}>
                            刷新页面
                        </Button>
                    }
                />
            )
        }

        return this.props.children
    }
}
