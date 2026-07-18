import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { initInterfaceZoom } from "./lib/interface-preferences";
import { initTheme } from "./lib/theme";
import { initNoteAlignment, initNoteWidth } from "./lib/note-preferences";
import "./globals.css";

initTheme();
initInterfaceZoom();
initNoteWidth();
initNoteAlignment();

createRoot(document.getElementById("root")!).render(<App />);
