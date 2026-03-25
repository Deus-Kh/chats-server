import { Router } from 'express';
import { ConversationModel } from '../models/Conversation';
import { requireAuth, type AuthedRequest } from '../middleware/auth';

export const conversationsRouter = Router();

conversationsRouter.get('/', requireAuth, async (req: AuthedRequest, res) => {
  const me = String(req.userId);

  const docs = await ConversationModel.find({ members: me })
    .populate('members', '_id username email identitySignUpdatedAt identityDhUpdatedAt')
    .sort({ lastMessageAt: -1 })
    .limit(100);

  const items = docs
    .map((doc: any) => {
      const peer = Array.isArray(doc.members)
        ? doc.members.find((member: any) => String(member?._id) !== me)
        : null;

      if (!peer?._id) return null;

      return {
        conversationId: doc.conversationId,
        peerUserId: String(peer._id),
        peerUsername: peer.username,
        peerEmail: peer.email,
        peerHasPublicKey: !!(peer.identitySignUpdatedAt && peer.identityDhUpdatedAt),
        lastMessageAt: doc.lastMessageAt,
        lastProtoVersion: doc.lastProtoVersion,
      };
    })
    .filter(Boolean);

  return res.json({ items });
});
