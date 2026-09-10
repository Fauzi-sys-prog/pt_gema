import { Router, Response } from "express";
import { prisma } from "../prisma";
import { authenticate } from "../middlewares/auth";
import { AuthRequest } from "../types/auth";

export const notificationsRouter = Router();

notificationsRouter.use("/notifications", authenticate);

notificationsRouter.get("/notifications/state", async (req: AuthRequest, res: Response) => {
  const rows = await prisma.notificationPreference.findMany({
    where: { userId: req.user!.id },
    select: { notificationKey: true, state: true, readAt: true, dismissedAt: true },
  });
  res.json({ states: rows });
});

async function saveState(userId: string, notificationKey: string, state: "READ" | "DISMISSED") {
  const now = new Date();
  return prisma.notificationPreference.upsert({
    where: { userId_notificationKey: { userId, notificationKey } },
    create: {
      userId,
      notificationKey,
      state,
      readAt: state === "READ" ? now : null,
      dismissedAt: state === "DISMISSED" ? now : null,
    },
    update: {
      state,
      readAt: state === "READ" ? now : undefined,
      dismissedAt: state === "DISMISSED" ? now : undefined,
    },
  });
}

notificationsRouter.put("/notifications/read-all", async (req: AuthRequest, res: Response) => {
  const keys = Array.isArray(req.body?.keys) ? req.body.keys.filter((key: unknown): key is string => typeof key === "string") : [];
  await prisma.$transaction(keys.slice(0, 500).map((key: string) =>
    prisma.notificationPreference.upsert({
      where: { userId_notificationKey: { userId: req.user!.id, notificationKey: key } },
      create: { userId: req.user!.id, notificationKey: key, state: "READ", readAt: new Date() },
      update: { state: "READ", readAt: new Date() },
    })
  ));
  res.json({ updated: keys.length });
});

notificationsRouter.put("/notifications/dismiss-all", async (req: AuthRequest, res: Response) => {
  const keys = Array.isArray(req.body?.keys) ? req.body.keys.filter((key: unknown): key is string => typeof key === "string") : [];
  await prisma.$transaction(keys.slice(0, 500).map((key: string) =>
    prisma.notificationPreference.upsert({
      where: { userId_notificationKey: { userId: req.user!.id, notificationKey: key } },
      create: { userId: req.user!.id, notificationKey: key, state: "DISMISSED", dismissedAt: new Date() },
      update: { state: "DISMISSED", dismissedAt: new Date() },
    })
  ));
  res.json({ updated: keys.length });
});

notificationsRouter.put("/notifications/:key/read", async (req: AuthRequest, res: Response) => {
  await saveState(req.user!.id, req.params.key, "READ");
  res.json({ ok: true });
});

notificationsRouter.put("/notifications/:key/dismiss", async (req: AuthRequest, res: Response) => {
  await saveState(req.user!.id, req.params.key, "DISMISSED");
  res.json({ ok: true });
});
