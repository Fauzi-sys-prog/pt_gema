import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import { env } from "./config/env";
import { healthRouter } from "./routes/health";
import { authRouter } from "./routes/auth";
import { usersRouter } from "./routes/users";
import { dataRouter } from "./routes/data";
import { projectsRouter } from "./routes/projects";
import { dataCollectionsRouter } from "./routes/dataCollections";
import { quotationsRouter } from "./routes/quotations";
import { exportsRouter } from "./routes/exports";
import { procurementRouter } from "./routes/procurement";
import { financeOpsRouter } from "./routes/financeOps";
import { inventoryRouter } from "./routes/inventory";
import { operationsRouter } from "./routes/operations";
import { hrRouter } from "./routes/hr";
import { dashboardRouter } from "./routes/dashboard";
import { resourceAliasesRouter } from "./routes/resourceAliases";
import { financeMiscRouter } from "./routes/financeMisc";
import { mediaRouter } from "./routes/media";
import { errorHandler } from "./middlewares/errorHandler";
import { protectAgainstCsrf } from "./middlewares/csrf";
import { apiLimiter, quotationPatchLimiter, writeLimiter } from "./middlewares/rateLimit";

export const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (env.corsOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("CORS origin denied"));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: env.apiBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: env.apiBodyLimit }));
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));
app.use(
  "/uploads",
  express.static(path.resolve(env.uploadDir), {
    maxAge: "7d",
    etag: true,
  })
);
// Keep container healthchecks alive even when API limiter is saturated.
app.use(healthRouter);
app.use(apiLimiter);
app.use(protectAgainstCsrf);
app.use((req, res, next) => {
  const method = req.method.toUpperCase();
  const isQuotationPatch =
    method === "PATCH" && /^\/quotations\/[^/]+$/.test(req.path);

  if (isQuotationPatch) {
    return quotationPatchLimiter(req, res, next);
  }

  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return writeLimiter(req, res, next);
  }
  return next();
});

app.use(authRouter);
app.use(usersRouter);
app.use(projectsRouter);
app.use(dataCollectionsRouter);
app.use(quotationsRouter);
app.use(exportsRouter);
app.use(procurementRouter);
app.use(financeOpsRouter);
app.use(inventoryRouter);
app.use(operationsRouter);
app.use(hrRouter);
app.use(financeMiscRouter);
app.use(mediaRouter);
app.use(dashboardRouter);
app.use(resourceAliasesRouter);
app.use(dataRouter);

app.use(errorHandler);
