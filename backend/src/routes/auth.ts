import { Router, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import bcrypt from "bcrypt";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { AuthRequest } from "../types/auth";
import { authenticate } from "../middlewares/auth";
import { authWriteLimiter, loginLimiter } from "../middlewares/rateLimit";
import { bootstrapOwnerSchema, changePasswordSchema } from "../schemas/user";
import { loginSchema } from "../schemas/auth";
import { signAccessToken, verifyAccessToken } from "../utils/token";
import {
  clearAccessTokenCookie,
  readAccessTokenCookie,
  setAccessTokenCookie,
} from "../utils/authCookie";

export const authRouter = Router();
const BCRYPT_ROUNDS = 12;
const logoutAllMarkerJti = (userId: string) => `logout-all:${userId}`;

function readRequestAccessToken(req: AuthRequest): string | null {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const bearerToken = authHeader.slice("Bearer ".length).trim();
    if (bearerToken) return bearerToken;
  }

  return readAccessTokenCookie(req);
}

authRouter.post("/auth/bootstrap-owner", authWriteLimiter, async (req, res) => {
  const parsed = bootstrapOwnerSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: parsed.error.flatten(),
    });
  }

  const ownerCount = await prisma.user.count({
    where: { role: "OWNER" },
  });

  if (ownerCount > 0) {
    return res.status(403).json({
      error: "Bootstrap disabled because OWNER already exists",
    });
  }

  const { email, username, name, password } = parsed.data;

  try {
    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        email,
        username,
        name,
        password: hashedPassword,
        role: "OWNER",
      },
    });

    const token = signAccessToken({
      id: user.id,
      role: user.role,
    });
    setAccessTokenCookie(res, token);

    return res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return res.status(400).json({
        error: "Email or username already exists",
      });
    }

    return res.status(500).json({ error: "Internal server error" });
  }
});

authRouter.post("/auth/login", loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: parsed.error.flatten(),
    });
  }

  const { username, password } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { username },
  });

  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  if (!user.isActive) {
    return res.status(401).json({ error: "Account inactive" });
  }

  const validPassword = await bcrypt.compare(password, user.password);

  if (!validPassword) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const userWithLastLogin = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      lastLoginAt: true,
    },
  });

  const token = signAccessToken({
    id: userWithLastLogin.id,
    role: userWithLastLogin.role,
  });
  setAccessTokenCookie(res, token);

  return res.json({
    token,
    user: {
      id: userWithLastLogin.id,
      email: userWithLastLogin.email,
      username: userWithLastLogin.username,
      role: userWithLastLogin.role,
      lastLogin: userWithLastLogin.lastLoginAt,
    },
  });
});

authRouter.get("/auth/me", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        name: true,
        phone: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({
      ...user,
      lastLogin: user.lastLoginAt,
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

authRouter.post("/auth/logout", authWriteLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const token = readRequestAccessToken(req);

    if (!token) {
      clearAccessTokenCookie(res);
      return res.json({ message: "Logged out successfully" });
    }

    const decoded = verifyAccessToken(token) as
      | (JwtPayload & {
          id?: string;
          jti?: string;
          exp?: number;
        })
      | null;

    if (!decoded?.id || !decoded?.jti || !decoded?.exp) {
      clearAccessTokenCookie(res);
      return res.json({ message: "Logged out successfully" });
    }

    await prisma.revokedToken.upsert({
      where: { jti: decoded.jti },
      update: {
        userId: decoded.id,
        expiresAt: new Date(decoded.exp * 1000),
      },
      create: {
        jti: decoded.jti,
        userId: decoded.id,
        expiresAt: new Date(decoded.exp * 1000),
      },
    });

    await prisma.revokedToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    clearAccessTokenCookie(res);
    return res.json({ message: "Logged out successfully" });
  } catch {
    clearAccessTokenCookie(res);
    return res.json({ message: "Logged out successfully" });
  }
});

authRouter.post("/auth/logout-all", authenticate, authWriteLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    await prisma.revokedToken.upsert({
      where: { jti: logoutAllMarkerJti(userId) },
      update: {
        userId,
        // Keep marker long-lived; middleware uses createdAt as token cutoff time.
        expiresAt: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000),
      },
      create: {
        jti: logoutAllMarkerJti(userId),
        userId,
        expiresAt: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000),
      },
    });

    await prisma.revokedToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    clearAccessTokenCookie(res);
    clearAccessTokenCookie(res);
    return res.json({ message: "All sessions have been logged out successfully" });
  } catch {
    clearAccessTokenCookie(res);
    return res.status(500).json({ error: "Failed to logout all sessions" });
  }
});

authRouter.patch("/auth/change-password", authenticate, authWriteLimiter, async (req: AuthRequest, res: Response) => {
  const parsed = changePasswordSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: parsed.error.flatten(),
    });
  }

  const { oldPassword, newPassword } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
  });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const valid = await bcrypt.compare(oldPassword, user.password);

  if (!valid) {
    return res.status(400).json({
      error: "Old password is incorrect",
    });
  }

  const hashed = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashed },
  });

  await prisma.revokedToken.upsert({
    where: { jti: logoutAllMarkerJti(user.id) },
    update: {
      userId: user.id,
      expiresAt: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000),
    },
    create: {
      jti: logoutAllMarkerJti(user.id),
      userId: user.id,
      expiresAt: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000),
    },
  });

  return res.json({ message: "Password updated successfully" });
});
