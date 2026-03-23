// server/src/socket/setupSocket.ts
import type { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { ConversationModel } from "../models/Conversation";
import { MessageModel } from "../models/Message";
import { makeConversationId } from "../utils/conversation";

type V2Header = {
  n: number;
  pn: number;
  dhPub: string; // base64 X25519 public key
};

type V2Payload = {
  header: V2Header;
  nonce: string;
  ciphertext: string;
};

type SendMessageDTO = {
  toUserId: string;
  clientMessageId: string;
  createdAt: number;
  protoVersion?: 2;
  v2?: V2Payload | null; // v2
  initPacket?: {
    peerUserId: string;
    ephPublicKey: string;
    signedPreKeyId: number;
    oneTimePreKeyId: number | null;
    initiatorIdentityDhPublicKey: string;
  } | null;
};

function isNonEmptyString(v: unknown, minLen = 1): v is string {
  return typeof v === "string" && v.length >= minLen;
}

function isValidObjectIdString(v: unknown): v is string {
  return typeof v === "string" && /^[a-fA-F0-9]{24}$/.test(v);
}

export function setupSocket(io: Server) {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Unauthorized"));

      const decoded = jwt.verify(token, config.JWT_SECRET) as { userId: string };
      socket.data.userId = decoded.userId;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const userId = String(socket.data.userId);
    socket.join(userId); // room per userId
    console.log('[socket] join room', userId, 'socket', socket.id);

    socket.on("message:send", async (dto: SendMessageDTO, ack?: (r: any) => void) => {
      try {
        if (!dto?.toUserId || !isValidObjectIdString(dto.toUserId)) {
          console.warn("[socket] reject message: invalid toUserId", { dto });
          return ack?.({ ok: false, error: "Invalid toUserId" });
        }
        if (!isNonEmptyString(dto.clientMessageId, 3)) {
          console.warn("[socket] reject message: invalid clientMessageId", { dto });
          return ack?.({ ok: false, error: "Invalid clientMessageId" });
        }
        if (typeof dto.createdAt !== "number") {
          console.warn("[socket] reject message: invalid createdAt", { dto });
          return ack?.({ ok: false, error: "Invalid createdAt" });
        }

        const protoVersion = dto?.protoVersion ?? 2;
        if (protoVersion !== 2) {
          console.warn("[socket] reject message: unsupported protoVersion", {
            protoVersion: dto?.protoVersion,
            dto,
          });
          return ack?.({
            ok: false,
            error: "Only protoVersion 2 is supported in the current development mode",
          });
        }

        const v2 = dto.v2;
        if (
          !v2 ||
          !v2.header ||
          typeof v2.header.n !== "number" ||
          typeof v2.header.pn !== "number" ||
          v2.header.n < 0 ||
          v2.header.pn < 0 ||
          !isNonEmptyString(v2.header.dhPub, 20) ||
          !isNonEmptyString(v2.nonce, 8) ||
          !isNonEmptyString(v2.ciphertext, 8)
        ) {
          console.warn("[socket] reject message: invalid v2 payload", {
            hasV2: !!dto.v2,
            header: dto.v2?.header,
            nonceLen: dto.v2?.nonce?.length,
            cipherLen: dto.v2?.ciphertext?.length,
          });
          return ack?.({ ok: false, error: "Invalid v2 payload" });
        }

        const doc = await MessageModel.create({
          conversationId: makeConversationId(userId, dto.toUserId),
          fromUserId: userId,
          toUserId: dto.toUserId,
          protoVersion,
          v2,
          initPacket: dto.initPacket ?? null,
          clientMessageId: dto.clientMessageId,
          createdAtClient: dto.createdAt,
        });

        await ConversationModel.findOneAndUpdate(
          { conversationId: (doc as any).conversationId },
          {
            $set: {
              members: [userId, dto.toUserId].sort(),
              lastMessageAt: dto.createdAt,
              lastProtoVersion: protoVersion,
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        const room = io.sockets.adapter.rooms.get(String(dto.toUserId));
        console.log('[socket] send', {
          from: userId,
          to: dto.toUserId,
          pv: protoVersion,
          roomSize: room ? room.size : 0,
          n: dto.v2?.header.n,
        });

        io.to(dto.toUserId).emit("message:new", {
          serverMessageId: String(doc._id),
          conversationId: (doc as any).conversationId,
          fromUserId: String(userId),
          toUserId: String(dto.toUserId),
          protoVersion,
          v2: doc.v2,
          initPacket: (doc as any).initPacket ?? null,
          clientMessageId: dto.clientMessageId,
          createdAt: dto.createdAt,
        });

        return ack?.({ ok: true, serverMessageId: String(doc._id) });
      } catch (e: any) {
        console.error("message:send failed:", e);
        return ack?.({ ok: false, error: e?.message || "Server error" });
      }
    });
  });
}
