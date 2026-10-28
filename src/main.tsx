import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Root from "./Root";
import ErrorBoundary from "./ErrorBoundary";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* the last line of defense: whatever goes wrong, the page is never blank */}
    <ErrorBoundary page>
      <Root />
    </ErrorBoundary>
  </StrictMode>,
);
