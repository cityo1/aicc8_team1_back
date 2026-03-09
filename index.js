import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import mealsRoutes from './src/routes/meals_routes.js';
import authRoutes from './src/routes/auth.routes.js';
import mfdsRoutes from './src/routes/mfds.routes.js';
import diaryRoutes from './src/routes/diary.routes.js';
import userRoutes from './src/routes/userRoutes.js';
import deficiencyRoutes from './src/routes/deficiency.routes.js';
import googleSheetsRoutes from './src/routes/google_sheets_routes.js';
import foodsRoutes from './src/routes/foods_routes.js';
import scanRoutes from './src/routes/scan.routes.js';
// import { pool } from "./src/config/db.js";
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './src/config/swagger.js';

import recommendRoutes from './src/routes/recommendRoutes.js';

const app = express();

// test

app.use(
  cors({
    origin: 'http://localhost:5173',
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get('/', (req, res) => {
  res.send('This is the Main App for Deployment');
});

app.use('/api/meals', mealsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/mfds', mfdsRoutes);
app.use('/api/diary', diaryRoutes);
app.use('/api/users', userRoutes);
app.use('/api/deficiency', deficiencyRoutes);
app.use('/api/google-sheets', googleSheetsRoutes);
app.use('/api/foods', foodsRoutes);
app.use('/api/scan', scanRoutes);

app.use('/api/recommend', recommendRoutes);

// app.get("/api/db/ping", async (req, res) => {
//   try {
//     const r = await pool.query("SELECT NOW() as now");
//     res.json({ success: true, data: r.rows[0] });
//   } catch (e) {
//     res.status(500).json({ success: false, error: String(e?.message || e) });
//   }
// });

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
