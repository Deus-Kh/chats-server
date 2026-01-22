import { Router } from 'express';
import { requireAuth, type AuthedRequest } from '../middleware/auth';
import { UserModel } from '../models/User';

export const keysRouter = Router();

/**
 * POST /keys/identity
 * Body: { identitySignPublicKey: string }
 * Stores user's identity signing public key (Ed25519 public key, base64).
 */
keysRouter.post('/identity', requireAuth, async (req: AuthedRequest, res) => {
  const { identitySignPublicKey } = req.body as { identitySignPublicKey?: string };

  if (!identitySignPublicKey) {
    return res.status(400).json({ error: 'identitySignPublicKey is required' });
  }

  if (typeof identitySignPublicKey !== 'string' || identitySignPublicKey.length < 20) {
    return res.status(400).json({ error: 'Invalid identitySignPublicKey format' });
  }

  await UserModel.updateOne(
    { _id: req.userId },
    { $set: { identitySignPublicKey, identitySignUpdatedAt: new Date() } }
  );

  return res.json({ ok: true });
});

/**
 * GET /keys/identity/:userId
 * Returns user's identity signing public key.
 */
keysRouter.get('/identity/:userId', requireAuth, async (req: AuthedRequest, res) => {
  const { userId } = req.params;

  const user = await UserModel.findById(userId).select('identitySignPublicKey');
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (!user.identitySignPublicKey) {
    return res.status(404).json({ error: 'Identity key not set' });
  }

  return res.json({
    userId: String(user._id),
    identitySignPublicKey: user.identitySignPublicKey,
  });
});
