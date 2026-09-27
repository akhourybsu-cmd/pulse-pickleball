import "./index.css";
import { validateBackend } from "./lib/backendPolicy.mjs";

// Validate before importing any module that starts an auth/data client. A bad
// build shows a recovery screen instead of sending a session to another project.
function showStartupRecovery() {
  const root = document.getElementById("root")!;
  root.replaceChildren();
  const panel = document.createElement("main");
  panel.className =
    "min-h-screen flex flex-col items-center justify-center gap-5 px-6 text-center bg-background text-foreground";
  const logo = document.createElement("img");
  logo.src = "/pulse-icon-192.png";
  logo.alt = "PULSE";
  logo.width = 80;
  logo.height = 80;
  const heading = document.createElement("h1");
  heading.className = "text-2xl font-bold";
  heading.textContent = "PULSE needs to refresh";
  const message = document.createElement("p");
  message.className = "max-w-sm text-muted-foreground";
  message.textContent =
    "Reload to get the latest version. If you installed PULSE from an app store, check for an update there.";
  const reload = document.createElement("button");
  reload.className =
    "rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground";
  reload.textContent = "Reload PULSE";
  reload.onclick = () => window.location.reload();
  const support = document.createElement("a");
  support.href = "mailto:support@pulsepb.com";
  support.textContent = "Contact PULSE support";
  panel.append(logo, heading, message, reload, support);
  root.append(panel);
}

try {
  validateBackend(
    import.meta.env,
    import.meta.env.MODE,
    window.location.hostname
  );
  void import("./bootstrap").catch(showStartupRecovery);
} catch {
  showStartupRecovery();
}
