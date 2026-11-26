import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { FamilyInviteGate } from "./FamilyInviteGate";
import "./style.css";
import "./invite.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <FamilyInviteGate><App /></FamilyInviteGate>
  </React.StrictMode>,
);
