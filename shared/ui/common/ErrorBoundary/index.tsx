'use client';

import type { ErrorInfo, ReactNode } from 'react';
import { Component } from 'react';

import { logger } from '@/shared/lib/logger';

import { ErrorFallback } from './ErrorFallback';

interface ErrorBoundaryProps {
    children: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundaryComponent extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        logger.error('ErrorBoundary caught an error', error, {
            componentStack: info.componentStack,
            errorBoundary: true
        });
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    handleReload = () => {
        window.location.reload();
    };

    render() {
        if (this.state.hasError && this.state.error) {
            return (
                <ErrorFallback
                    error={this.state.error}
                    onReset={this.handleReset}
                    onReload={this.handleReload}
                />
            );
        }

        return this.props.children;
    }
}

export const ErrorBoundary = ErrorBoundaryComponent;
