import { randomUUID } from "crypto";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import { env } from "../config/env";

export function signAccessToken(user: { id: string; role: Role }) {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      jti: randomUUID(),
    },
    env.jwtSecret,
    {
      expiresIn: env.jwtExpiresIn as jwt.SignOptions["expiresIn"],
      algorithm: "HS256",
      issuer: env.jwtIssuer,
      audience: env.jwtAudience,
      subject: user.id,
    }
  );
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, env.jwtSecret, {
    algorithms: ["HS256"],
    issuer: env.jwtIssuer,
    audience: env.jwtAudience,
  });
}
