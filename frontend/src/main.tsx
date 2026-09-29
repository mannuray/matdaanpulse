import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow-condensed/800.css';
import '@fontsource-variable/inter';
import '@fontsource/noto-sans-devanagari/400.css';
import '@fontsource/noto-sans-tamil/400.css';
import './theme/studio.css';
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./i18n";
import "./theme/index.css";

// Catch unhandled promise rejections (async errors not caught by ErrorBoundary)
window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled Rejection]', event.reason);
});

window.addEventListener('error', (event) => {
  console.error('[Uncaught Error]', event.error);
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
