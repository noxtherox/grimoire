import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { initTheme } from "./lib/theme";
import { initNoteAlignment, initNoteWidth } from "./lib/note-preferences";
import "./globals.css";

initTheme();
initNoteWidth();
initNoteAlignment();

createRoot(document.getElementById("root")!).render(<App />);
