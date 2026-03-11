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
  metadata?: Record<string, unknown>
): Promise<void> {
  const actorId = req.user?.id ?? null;
  const actor = actorId
    ? await prisma.user.findUnique({
        where: { id: actorId },
        select: { username: true, name: true },
      })
    : null;

  await prisma.auditLogEntry.create({
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

    const user = await prisma.user.create({
      data: {
        email,
        username,
        name,
        phone: typeof phone === "string" && phone.trim().length > 0 ? phone.trim() : null,
        password: hashedPassword,
        role,
      },
      select: {
        id: true,
        email: true,
        username: true,
        phone: true,
        role: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    await writeUserManagementAuditLog(req, "create", user.id, {
      username: user.username,
      role: user.role,
    }).catch(() => undefined);

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
    if (hasRoleAccess(req.user?.role, ["OWNER", "ADMIN"])) {
      const users = await prisma.user.findMany({
        where: {
          isActive: true,
        },
        select: {
          id: true,
          email: true,
          username: true,
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
  authorize(["OWNER", "ADMIN"]),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const parsed = updateUserSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.flatten(),
      });
    }

    const { email, username, role, name, phone, isActive } = parsed.data;

    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return res.status(404).json({ error: "User not found" });
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
      const updatedUser = await prisma.user.update({
        where: { id },
        data: {
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
          isActive,
        },
        select: {
          id: true,
          email: true,
          username: true,
          phone: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
        },
      });

      await writeUserManagementAuditLog(req, "update", updatedUser.id, {
        username: updatedUser.username,
        role: updatedUser.role,
        isActive: updatedUser.isActive,
      }).catch(() => undefined);

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

  await prisma.user.update({
    where: { id },
    data: { isActive: false },
  });

  await writeUserManagementAuditLog(req, "delete", id, {
    softDelete: true,
  }).catch(() => undefined);

  return res.json({ message: "User deleted successfully" });
});
