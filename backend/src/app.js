const express = require("express");
const { pingDatabase } = require("./config/db");
const authRoutes = require("./routes/auth");
const proyectosRoutes = require("./routes/proyectos");
const tareasRoutes = require("./routes/tareas");

function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json());

  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1/proyectos", proyectosRoutes);
  app.use("/api/v1/tareas", tareasRoutes);

  app.get("/api/v1/health", (_req, res) => {
    res.json({
      status: "ok",
      uptime: process.uptime(),
    });
  });

  app.get("/api/v1/health/db", async (_req, res) => {
    try {
      await pingDatabase();
      res.json({
        status: "ok",
        database: "connected",
      });
    } catch (err) {
      res.status(503).json({
        status: "error",
        database: "unavailable",
        message: err.message,
      });
    }
  });

  app.use((_req, res) => {
    res.status(404).json({ message: "Not found" });
  });

  return app;
}

module.exports = { createApp };
