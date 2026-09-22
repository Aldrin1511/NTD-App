import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@/index.css";
import App from "@/App";

// Suppress benign "ResizeObserver loop" noise (Radix dialogs + Recharts) so the
// CRA dev error overlay does not block interaction in the preview build.
const roMsg = "ResizeObserver loop";
window.addEventListener("error", (e) => {
  if (e.message && e.message.includes(roMsg)) {
    e.stopImmediatePropagation();
    e.preventDefault();
  }
}, true);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
