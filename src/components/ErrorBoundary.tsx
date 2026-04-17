import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-md w-full text-center">
            <h1 className="text-xl font-bold text-foreground mb-3">
              페이지를 표시하는 중 문제가 발생했습니다
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              일시적인 오류일 수 있습니다. 새로고침 후에도 같은 문제가 반복되면
              페이지를 이동해 주세요.
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={this.handleReload}
                className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:opacity-90"
              >
                새로고침
              </button>
              <button
                onClick={this.handleHome}
                className="px-4 py-2 rounded-lg bg-secondary text-foreground text-sm font-semibold hover:opacity-90"
              >
                홈으로
              </button>
            </div>
            <details className="mt-6 text-left">
              <summary className="text-xs text-muted-foreground cursor-pointer">
                기술 세부정보
              </summary>
              <pre className="mt-2 p-3 bg-muted rounded text-[11px] text-muted-foreground overflow-auto max-h-40">
                {this.state.error.message}
                {"\n"}
                {this.state.error.stack}
              </pre>
            </details>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
