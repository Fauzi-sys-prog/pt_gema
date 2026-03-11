import { NextFunction, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import { Role } from "@prisma/client";
import { prisma } from "../prisma";
import { AuthRequest } from "../types/auth";
import { verifyAccessToken } from "../utils/token";
import { sendError } from "../utils/http";
import { hasRoleAccess } from "../utils/roles";

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return sendError(res, 401, {
      code: "AUTH_REQUIRED",
      message: "Unauthorized",
      legacyError: "Unauthorized",
    });
  }

  if (!authHeader.startsWith("Bearer ")) {
    return sendError(res, 401, {
      code: "AUTH_FORMAT_INVALID",
      message: "Invalid auth format",
      legacyError: "Invalid auth format",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = verifyAccessToken(token) as JwtPayload & {
      id?: string;
      role?: Role;
      jti?: string;
    };

    if (!decoded?.id || !decoded?.role || !decoded?.jti) {
      return sendError(res, 401, {
        code: "TOKEN_PAYLOAD_INVALID",
        message: "Invalid token payload",
        legacyError: "Invalid token payload",
      });
    }

    const revoked = await prisma.revokedToken.findUnique({
      where: { jti: decoded.jti },
      select: { id: true },
    });

    if (revoked) {
      return sendError(res, 401, {
        code: "TOKEN_REVOKED",
        message: "Token revoked",
        legacyError: "Token revoked",
      });
    }

    const logoutAllMarker = await prisma.revokedToken.findUnique({
      where: { jti: `logout-all:${decoded.id}` },
      select: { createdAt: true },
    });
    if (logoutAllMarker) {
      const tokenIssuedAtMs = typeof decoded.iat === "number" ? decoded.iat * 1000 : 0;
      if (tokenIssuedAtMs > 0 && tokenIssuedAtMs < logoutAllMarker.createdAt.getTime()) {
        return sendError(res, 401, {
          code: "TOKEN_LOGOUT_ALL_EXPIRED",
          message: "Token expired by logout-all action",
          legacyError: "Token expired by logout-all action",
        });
      }
    }

    const activeUser = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { isActive: true },
    });
    if (!activeUser?.isActive) {
      return sendError(res, 401, {
        code: "ACCOUNT_INACTIVE",
        message: "Account inactive",
        legacyError: "Account inactive",
      });
    }

    req.user = {
      id: decoded.id,
      role: decoded.role,
      jti: decoded.jti,
    };

    next();
  } catch {
    return sendError(res, 401, {
      code: "TOKEN_INVALID",
      message: "Invalid token",
      legacyError: "Invalid token",
    });
  }
}

export function authorize(roles: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !hasRoleAccess(req.user.role, roles)) {
      return sendError(res, 403, {
        code: "FORBIDDEN",
        message: "Forbidden",
        legacyError: "Forbidden",
      });
    }

    next();
  };
}
