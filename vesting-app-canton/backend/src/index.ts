import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { router } from "./routes.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true, ledger: config.ledgerUrl }));
app.use("/api", router);

app.listen(config.port, () => {
  console.log(`vesting backend listening on http://localhost:${config.port}`);
  console.log(`  -> mediating to JSON Ledger API at ${config.ledgerUrl}`);
  console.log(`  -> auth ${config.auth.enabled ? "ENABLED (OAuth2)" : "disabled"}`);
});
