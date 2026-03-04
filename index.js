import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import mealsRoutes from "./src/routes/meals_routes.js";
import authRoutes from "./src/routes/auth.routes.js";
import mfdsRoutes from "./src/routes/mfds.routes.js";
import diaryRoutes from "./src/routes/diary.routes.js";
import { pool } from "./src/config/db.js";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./src/config/swagger.js";


const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Swagger Documentation
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get("/", (req, res) => {
  res.send("This is the Main App for Deployment");
});

app.use("/api/meals", mealsRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/mfds", mfdsRoutes);
app.use("/api/diary", diaryRoutes);

app.get("/api/db/ping", async (req, res) => {
  try {
    const r = await pool.query("SELECT NOW() as now");
    res.json({ success: true, data: r.rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, error: String(e?.message || e) });
  }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));