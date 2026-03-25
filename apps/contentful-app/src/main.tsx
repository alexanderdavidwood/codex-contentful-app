import "./index.css";

import ReactDOM from "react-dom/client";
import { SDKProvider } from "@contentful/react-apps-toolkit";

import { App } from "./App.js";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <SDKProvider>
    <App />
  </SDKProvider>,
);
