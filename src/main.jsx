import { render } from "preact";
import { App } from "./ui/App.jsx";
import "./ui/ocs-theme.css";
import "./ui/theme-override.css";
import "./ui/app.css";

render(<App />, document.getElementById("app"));
