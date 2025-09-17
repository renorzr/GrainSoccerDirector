import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import './ErrorBoundary.css';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
    errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        this.setState({
            error,
            errorInfo
        });
    }

    private handleReload = () => {
        window.location.reload();
    };

    private handleReset = () => {
        this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="error-boundary">
                    <div className="error-boundary-content">
                        <div className="error-icon">
                            <AlertTriangle size={48} />
                        </div>
                        <h2>出现错误</h2>
                        <p>抱歉，应用程序遇到了一个错误。请尝试刷新页面或联系技术支持。</p>

                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <details className="error-details">
                                <summary>错误详情 (开发模式)</summary>
                                <div className="error-stack">
                                    <h4>错误信息:</h4>
                                    <pre>{this.state.error.message}</pre>

                                    <h4>错误堆栈:</h4>
                                    <pre>{this.state.error.stack}</pre>

                                    {this.state.errorInfo && (
                                        <>
                                            <h4>组件堆栈:</h4>
                                            <pre>{this.state.errorInfo.componentStack}</pre>
                                        </>
                                    )}
                                </div>
                            </details>
                        )}

                        <div className="error-actions">
                            <button className="btn btn-primary" onClick={this.handleReset}>
                                <RefreshCw size={16} style={{ marginRight: '0.5rem' }} />
                                重试
                            </button>
                            <button className="btn btn-secondary" onClick={this.handleReload}>
                                刷新页面
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
