import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installOfflineInterceptor } from "@/lib/offline/interceptor";

installOfflineInterceptor();

createRoot(document.getElementById("root")!).render(<App />);
