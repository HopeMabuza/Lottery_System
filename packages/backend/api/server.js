// server.js — REST API entry point
// Mounts all routes and starts the Express server
// Run with: node api/server.js

const express = require("express");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");
require("dotenv").config({ path: `${__dirname}/../.env` });

const roundsRouter  = require("./routes/rounds");
const playersRouter = require("./routes/players");
const statsRouter   = require("./routes/stats");

const app  = express();
const PORT = process.env.API_PORT || 3001;

app.use(express.json());

// ── Swagger ───────────────────────────────────────────────────────────────────
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "ABC Lottery API",
      version: "1.0.0",
      description: "REST API for querying lottery rounds, tickets, and player rewards indexed from Sepolia.",
    },
    servers: [{ url: `http://localhost:${PORT}` }],
  },
  apis: ["./api/routes/*.js"],
});

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/rounds",  roundsRouter);
app.use("/players", playersRouter);
app.use("/stats",   statsRouter);

// Health check
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Lottery API");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Listening on http://localhost:${PORT}`);
  console.log(`  Swagger docs: http://localhost:${PORT}/docs`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
});
