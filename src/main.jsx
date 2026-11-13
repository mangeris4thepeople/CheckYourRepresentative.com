import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { startAnalytics } from "./lib/analytics.js";
import { startGA } from "./lib/ga.js";

// Cookieless Vercel Web Analytics; production only. See src/lib/analytics.js.
startAnalytics();
// Google Analytics loads only for visitors who clicked "Allow analytics". See src/lib/ga.js.
startGA();

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
