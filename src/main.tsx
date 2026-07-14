import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { initTheme } from "./lib/theme";
import "./globals.css";

initTheme();

createRoot(document.getElementById("root")!).render(<App />);
