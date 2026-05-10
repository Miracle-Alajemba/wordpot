import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { ReownProvider } from "./providers/reown-provider.jsx";
import "./styles.css";
import { SpeedInsights } from "@vercel/speed-insights/react"
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ReownProvider>
      <App />
    </ReownProvider>
  </React.StrictMode>,
);
