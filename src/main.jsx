import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { startAnalytics } from "./lib/analytics.js";

// Cookieless Vercel Web Analytics; production only. See src/lib/analytics.js.
startAnalytics();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// PWA service worker: production only, so local dev never fights a cache.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
