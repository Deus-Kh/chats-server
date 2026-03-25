import { Router } from "express";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { UserModel } from "../models/User";

export const usersRouter = Router();

// POST /users/public-key  (JWT)
usersRouter.post(
  "/public-key",
  requireAuth,
  async (req: AuthedRequest, res) => {
    const { publicKey } = req.body as { publicKey?: string };
    if (!publicKey)
      return res.status(400).json({ error: "publicKey is required" });

    // минимальная sanity-check (не крипто-верификация, но от мусора защищает)
    if (typeof publicKey !== "string" || publicKey.length < 20) {
      return res.status(400).json({ error: "Invalid publicKey format" });
    }

    await UserModel.updateOne(
      { _id: req.userId },
      { $set: { publicKey, publicKeyUpdatedAt: new Date() } },
    );

    return res.json({ ok: true });
  },
);

// GET /users/public-key/:userId  (JWT)
usersRouter.get(
  "/public-key/:userId",
  requireAuth,
  async (req: AuthedRequest, res) => {
    const { userId } = req.params;

    const user = await UserModel.findById(userId).select("publicKey");
    if (!user) return res.status(404).json({ error: "User not found" });
    if (!user.publicKey)
      return res.status(404).json({ error: "Public key not set" });

    return res.json({ userId: String(user._id), publicKey: user.publicKey });
  },
);

// (опционально) GET /users/me  (JWT)
usersRouter.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const user = await UserModel.findById(req.userId).select(
    "email username publicKey",
  );
  if (!user) return res.status(404).json({ error: "User not found" });
  return res.json({
    userId: String(user._id),
    email: user.email,
    username: user.username,
    publicKey: user.publicKey,
  });
});

// GET /users  (JWT) — список пользователей (без пароля)
usersRouter.get('/', requireAuth, async (req: AuthedRequest, res) => {
  const q = String(req.query.q || '').trim(); // search by username/email
  const limit = Math.min(Number(req.query.limit || 50), 100);

  const filter: any = { _id: { $ne: req.userId } };

  if (q) {
    filter.$or = [
      { username: { $regex: q, $options: 'i' } },
      { email: { $regex: q, $options: 'i' } },
    ];
  }

  const users = await UserModel.find(filter)
    .select('_id username email identitySignUpdatedAt identityDhUpdatedAt') // Check for E2EE key setup
    .limit(limit)
    .sort({ username: 1 });

  return res.json({
    items: users.map((u) => ({
      userId: String(u._id),
      username: u.username,
      email: u.email,
      hasPublicKey: !!(u.identitySignUpdatedAt && u.identityDhUpdatedAt),
    })),
  });
});
