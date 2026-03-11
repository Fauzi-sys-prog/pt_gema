import rateLimit from "express-rate-limit";

const isLocalRequest = (ip?: string | null) => {
  const value = String(ip || "").toLowerCase();
  return (
    value === "::1" ||
    value === "127.0.0.1" ||
    value.startsWith("::ffff:127.0.0.1")
  );
};

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV !== "production" && isLocalRequest(req.ip),
  message: {
    error: "Too many requests. Please retry shortly.",
  },
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many login attempts. Try again in 15 minutes.",
  },
});

export const authWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many auth requests. Please retry in a few minutes.",
  },
});

export const writeLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many write requests. Please slow down.",
  },
});

// Quotation editor can emit many PATCH autosync requests while user types.
// Keep protection enabled, but allow a higher burst for this specific flow.
export const quotationPatchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many quotation update requests. Please slow down.",
  },
});

export const approvalActionLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many approval actions. Please retry in a few minutes.",
  },
});
