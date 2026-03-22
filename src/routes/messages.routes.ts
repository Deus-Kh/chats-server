import { Router } from "express";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { MessageModel } from "../models/Message";

export const messagesRouter = Router();

/**
 * GET /messages/with/:userId
 * Returns encrypted history between current user and peer (ciphertext only).
 * Query:
 *   - limit (default 50, max 200)
 *   - before (optional) : timestamp (createdAtClient) for pagination
 */
messagesRouter.get(
  "/with/:userId",
  requireAuth,
  async (req: AuthedRequest, res) => {
    const me = req.userId!;
    const peer = req.params.userId;

    const limit = Math.min(Number(req.query.limit || 50), 200);
    const before = req.query.before ? Number(req.query.before) : null;

    const baseFilter: any = {
      $or: [
        { fromUserId: me, toUserId: peer },
        { fromUserId: peer, toUserId: me },
      ],
    };

    if (before && Number.isFinite(before)) {
      baseFilter.createdAtClient = { $lt: before };
    }

    const docs = await MessageModel.find(baseFilter)
      // .select('_id fromUserId toUserId payload clientMessageId createdAtClient')
      .select(
        "_id fromUserId toUserId protoVersion payload v2 initPacket clientMessageId createdAtClient")
      .sort({ createdAtClient: -1 })
      .limit(limit);

    // Вернём в порядке "старые -> новые"
    const items = docs
      .map((d) => ({
        // serverMessageId: String(d._id),
        // fromUserId: String(d.fromUserId),
        // toUserId: String(d.toUserId),
        // payload: d.payload, // {nonce, ciphertext}
        // clientMessageId: d.clientMessageId,
        // createdAt: d.createdAtClient,
        serverMessageId: String(d._id),
        fromUserId: String(d.fromUserId),
        toUserId: String(d.toUserId),
        protoVersion: d.protoVersion ?? 1,
        payload: d.payload ?? null,
        v2: d.v2 ?? null,
        initPacket: (d as any).initPacket ?? null,
        clientMessageId: d.clientMessageId,
        createdAt: d.createdAtClient,
      }))
      .reverse();

    return res.json({ items });
  },
);
