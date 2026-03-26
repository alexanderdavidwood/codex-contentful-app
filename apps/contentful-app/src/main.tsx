import "./index.css";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown startup error";
}

function renderFatalScreen(title: string, detail: string) {
  const container = document.getElementById("root") ?? document.body;
  container.innerHTML = `
    <div style="min-height:100vh;padding:24px;font-family:ui-sans-serif,system-ui,sans-serif;background:#f6f8fb;color:#111827;">
      <div style="max-width:900px;margin:0 auto;">
        <h1 style="margin:0 0 16px;font-size:28px;">${title}</h1>
        <p style="margin:0 0 16px;line-height:1.5;">The app failed before React finished booting.</p>
        <pre style="white-space:pre-wrap;overflow:auto;padding:16px;border-radius:12px;background:#111827;color:#e5eefc;">${detail}</pre>
      </div>
    </div>
  `;
}

window.addEventListener("error", (event) => {
  renderFatalScreen("Window Error", event.message || "Unknown window error");
});

window.addEventListener("unhandledrejection", (event) => {
  renderFatalScreen("Unhandled Rejection", getErrorMessage(event.reason));
});

async function bootstrap() {
  const container = document.getElementById("root");
  if (!container) {
    renderFatalScreen("Missing Root Element", "The bundle loaded but could not find #root in index.html.");
    return;
  }

  try {
    const [{ createRoot }, { Root }] = await Promise.all([
      import("react-dom/client"),
      import("./Root.js"),
    ]);

    createRoot(container).render(<Root />);
  } catch (error) {
    renderFatalScreen("Startup Error", getErrorMessage(error));
  }
}

void bootstrap();
