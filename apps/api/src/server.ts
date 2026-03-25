import { createApp } from "./app.js";
import { config } from "./config.js";

const app = await createApp();

app.listen(config.port, () => {
  console.log(`codex-builder-api listening on http://127.0.0.1:${config.port}`);
});
