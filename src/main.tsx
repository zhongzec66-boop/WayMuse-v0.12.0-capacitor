import React from "react";
import ReactDOM from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import ErrorBoundary from "./ErrorBoundary";
import WayMuseReference from "./WayMuseReference";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/today.css";
import "./styles/tasks.css";
import "./styles/memory.css";
import "./styles/chat.css";
import "./styles/onboarding.css";
import "./styles/settings.css";
import "./styles/intake.css";
import "./styles/persona.css";
import "./styles/misc.css";

// 平台标记：不同厂商的系统栏、输入法、返回手势差别很大，
// CSS / 逻辑里用 html[data-platform="android"] 做针对性适配，
// 比维护一套「安卓专用页面」便宜得多。
document.documentElement.dataset.platform = Capacitor.getPlatform();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <WayMuseReference />
    </ErrorBoundary>
  </React.StrictMode>,
);
