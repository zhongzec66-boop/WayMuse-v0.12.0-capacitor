import React from "react";
import ReactDOM from "react-dom/client";
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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <WayMuseReference />
    </ErrorBoundary>
  </React.StrictMode>,
);
