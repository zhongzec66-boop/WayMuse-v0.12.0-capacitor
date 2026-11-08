import { Component, type ErrorInfo, type ReactNode } from "react";
import { storage } from "./storage";

type Props = { children: ReactNode };
type State = { hasError: boolean };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("WayMuse render error", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="wr-page">
        <div className="wr-phone">
          <div className="wr-error" role="alert">
            <div className="wr-error-mark">!</div>
            <h1>页面遇到问题</h1>
            <p>
              本地演示数据可能已损坏。可以先重新加载；如果仍然失败，清除本机演示数据后再试。
            </p>
            <div className="wr-error-actions">
              <button type="button" onClick={() => window.location.reload()}>
                重新加载
              </button>
              <button
                type="button"
                className="danger"
                onClick={() => {
                  storage.clearAll();
                  window.location.reload();
                }}
              >
                清除数据并重载
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
