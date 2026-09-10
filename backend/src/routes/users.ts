import { Router, Response } from "express";
import bcrypt from "bcrypt";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { prisma } from "../prisma";
import { authenticate, authorize } from "../middlewares/auth";
import { AuthRequest } from "../types/auth";
import { createUserSchema, updateUserSchema } from "../schemas/user";
import { hasRoleAccess } from "../utils/roles";

export const usersRouter = Router();

async function writeUserManagementAuditLog(
  req: AuthRequest,
  operation: "create" | "update" | "delete",
  targetUserId: string,
  metadata?: Record<string, unknown>,
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<void> {
  const actorId = req.user?.id ?? null;
  const actor = actorId
    ? await db.user.findUnique({
        where: { id: actorId },
        select: { username: true, name: true },
      })
    : null;

  await db.auditLogEntry.create({
    data: {
      id: randomUUID(),
      timestamp: new Date(),
      action: `USER_${operation.toUpperCase()}`,
      module: "Settings/UserManagement",
      details: `User ${operation} for id=${targetUserId}`,
      status: "Success",
      userId: actorId || "System",
      userName: actor?.name || actor?.username || "System",
      domain: "settings",
      resource: "users",
      entityId: targetUserId,
      operation,
      actorUserId: actorId,
      actorRole: req.user?.role ?? null,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

usersRouter.post("/users", authenticate, authorize(["OWNER", "ADMIN"]), async (req: AuthRequest, res: Response) => {
  const parsed = createUserSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: parsed.error.flatten(),
    });
  }

  const { email, username, name, phone, password, role } = parsed.data;

  if (req.user?.role === "ADMIN" && role === "OWNER") {
    return res.status(403).json({
      error: "Admin cannot create OWNER",
    });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({ data: {
        email,
        username,
        name,
        phone: typeof phone === "string" && phone.trim().length > 0 ? phone.trim() : null,
        password: hashedPassword,
        role,
      }, select: {
        id: true,
        email: true,
        username: true,
        name: true,
        phone: true,
        role: true,
        createdAt: true,
        lastLoginAt: true,
      } });
      await writeUserManagementAuditLog(req, "create", created.id, {
        username: created.username,
        role: created.role,
      }, tx);
      return created;
    });

    return res.status(201).json({
      ...user,
      lastLogin: user.lastLoginAt,
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

usersRouter.get("/users", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (hasRoleAccess(req.user?.role, ["OWNER", "ADMIN", "SPV"])) {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          username: true,
          name: true,
          phone: true,
          role: true,
          isActive: true,
          createdAt: true,
          lastLoginAt: true,
        },
      });

      return res.json(
        users.map((user) => ({
          ...user,
          lastLogin: user.lastLoginAt,
        }))
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
      },
    });

    return res.json(user ? { ...user, lastLogin: user.lastLoginAt } : null);
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

usersRouter.patch(
  "/users/:id",
  authenticate,
  authorize(["OWNER", "ADMIN", "SPV"]),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const parsed = updateUserSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.flatten(),
      });
    }

    const { email, username, role, name, phone, password, isActive } = parsed.data;

    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return res.status(404).json({ error: "User not found" });
    }

    if (req.user?.role === "SPV") {
      const nonPasswordUpdates = [email, username, role, name, phone, isActive].some(
        (value) => typeof value !== "undefined"
      );

      if (nonPasswordUpdates || !password) {
        return res.status(403).json({
          error: "SPV hanya boleh mereset password user",
        });
      }
    }

    if (req.user?.role === "ADMIN") {
      if (existingUser.role === "OWNER") {
        return res.status(403).json({
          error: "Admin cannot update OWNER",
        });
      }
      if (role === "OWNER") {
        return res.status(403).json({
          error: "Admin cannot assign OWNER role",
        });
      }
    }

    if (req.user?.id === id && isActive === false) {
      return res.status(400).json({
        error: "Cannot deactivate your own account",
      });
    }

    if (existingUser.role === "OWNER" && role && role !== "OWNER") {
      return res.status(403).json({
        error: "OWNER role cannot be changed",
      });
    }

    try {
      const hashedPassword =
        typeof password === "string" && password.trim().length > 0
          ? await bcrypt.hash(password, 10)
          : undefined;

      const updatedUser = await prisma.$transaction(async (tx) => {
        const current = await tx.user.findUnique({ where: { id } });
        if (!current) throw new Error("USER_NOT_FOUND");
        const updated = await tx.user.update({ where: { id }, data: {
          email,
          username,
          role,
          name,
          phone:
            typeof phone === "undefined"
              ? undefined
              : phone.trim().length > 0
                ? phone.trim()
                : null,
          password: hashedPassword,
          isActive,
        }, select: {
          id: true,
          email: true,
          username: true,
          name: true,
          phone: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
        } });
        await writeUserManagementAuditLog(req, "update", updated.id, {
          username: updated.username,
          role: updated.role,
          isActive: updated.isActive,
          passwordReset: typeof hashedPassword === "string",
        }, tx);
        return updated;
      });

      return res.json({
        ...updatedUser,
        lastLogin: updatedUser.lastLoginAt,
      });
      
    } catch {
      return res.status(500).json({ error: "Update failed" });
    }
  }
);

usersRouter.delete("/users/:id", authenticate, authorize(["OWNER"]), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  if (req.user?.id === id) {
    return res.status(400).json({ error: "Cannot delete your own account" });
  }

  const userToDelete = await prisma.user.findUnique({
    where: { id },
  });

  if (!userToDelete) {
    return res.status(404).json({ error: "User not found" });
  }

  if (userToDelete.role === "OWNER") {
    return res.status(403).json({
      error: "OWNER cannot be deleted",
    });
  }

  await prisma.$transaction(async (tx) => {
    await writeUserManagementAuditLog(req, "delete", id, {
      hardDelete: true,
      deletedUsername: userToDelete.username,
      deletedRole: userToDelete.role,
    }, tx);
    await tx.user.delete({ where: { id } });
  });

  return res.json({ message: "User deleted permanently" });
});
