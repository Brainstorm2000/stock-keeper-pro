import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installOfflineInterceptor } from "@/lib/offline/interceptor";

installOfflineInterceptor();

if ('serviceWorker' in navigator) {
	window.addEventListener('load', () => {
		navigator.serviceWorker.register('/sw.js').catch(() => undefined);
	});
}

createRoot(document.getElementById("root")!).render(<App />);
