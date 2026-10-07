import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import App from "@/App.jsx";
import config from "@/config";
import { dir, locale, localized } from "@/i18n";
import "@/index.css";

document.documentElement.lang = locale;
document.documentElement.dir = dir;
document.title = localized(config.app.title);

ReactDOM.createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
