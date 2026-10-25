import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  /** Optional label shown in the fallback card (e.g. "Student Dossier") */
  label?: string;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * ErrorBoundary catches any uncaught render-time errors in its subtree and
 * shows a contained error card instead of blanking the entire page.
 *
 * Usage:
 *   <ErrorBoundary label="Student Dossier">
 *     <StudentDossierModal ... />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message =
      error instanceof Error ? error.message : String(error);
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught render error:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (this.state.hasError) {
      const label = this.props.label ?? 'Section';
      return (
        <div className="p-4 rounded-lg border border-rose-200 bg-rose-50 space-y-2">
          <div className="flex items-center gap-2 text-rose-800 font-semibold text-sm">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{label} failed to render</span>
          </div>
          <p className="text-xs text-rose-700 font-mono break-all">{this.state.message}</p>
          <button
            onClick={this.handleReset}
            className="px-3 py-1.5 text-xs font-semibold bg-white border border-rose-300 text-rose-700 rounded hover:bg-rose-100 transition-colors"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
