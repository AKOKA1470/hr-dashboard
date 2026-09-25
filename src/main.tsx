import React from "react";
import { createRoot } from "react-dom/client";
import HRDashboard from "./hr_dashboard";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HRDashboard />
  </React.StrictMode>,
);
