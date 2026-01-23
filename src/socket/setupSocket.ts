import type { Server } from "socket.io";
import { Types } from "mongoose";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { MessageModel } from "../models/Message";

type SendMessageDTO = {
  toUserId: string;
  payload: { nonce: string; ciphertext: string };
  clientMessageId: string;
  createdAt: number;
};

export function setupSocket(io: Server) {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Unauthorized"));

      const decoded = jwt.verify(token, config.JWT_SECRET) as {
        userId: string;
      };
      socket.data.userId = decoded.userId;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const userId = String(socket.data.userId);
    socket.join(userId); // room per userId
    console.log("Connected Socket");

    // socket.on('message:send', async (dto: SendMessageDTO, ack?: (r: any) => void) => {
    //   console.log("message received");

    //   try {
    //     if (!dto?.toUserId || !dto?.payload?.nonce || !dto?.payload?.ciphertext) {
    //       return ack?.({ ok: false, error: 'Invalid payload' });
    //     }

    //     const doc = await MessageModel.create({
    //       fromUserId: userId,
    //       toUserId: dto.toUserId,
    //       payload: dto.payload,
    //       clientMessageId: dto.clientMessageId,
    //       createdAtClient: dto.createdAt,
    //     });

    //     const serverMessageId = String(doc._id);
    //     console.log('Saved message:', doc._id);
    //     const out = {
    //       fromUserId: userId,
    //       toUserId: dto.toUserId,
    //       payload: dto.payload,
    //       clientMessageId: dto.clientMessageId,
    //       createdAt: dto.createdAt,
    //       serverMessageId,
    //     };

    //     io.to(dto.toUserId).emit('message:new', out);

    //     return ack?.({ ok: true, serverMessageId });
    //   } catch (e: any) {
    //     // возможен duplicate key при retry (unique index)
    //     if (e?.code === 11000) {
    //       // можно найти существующее сообщение по индексу и вернуть его id
    //       return ack?.({ ok: true, serverMessageId: 'duplicate' });
    //     }
    //     return ack?.({ ok: false, error: e?.message || 'Server error' });
    //   }
    // });

    socket.on("message:send", async (dto, ack) => {
      console.log("New message 1");
      
      try {
        const protoVersion = dto?.protoVersion === 2 ? 2 : 1;

        if (protoVersion === 1) {
          if (!dto?.payload?.nonce || !dto?.payload?.ciphertext) {
            return ack?.({ ok: false, error: "Invalid v1 payload" });
          }
        } else {
          if (
            !dto?.v2?.header ||
            typeof dto?.v2?.header?.n !== "number" ||
            typeof dto?.v2?.header?.pn !== "number" ||
            !dto?.v2?.nonce ||
            !dto?.v2?.ciphertext
          ) {
            return ack?.({ ok: false, error: "Invalid v2 payload" });
          }
        }
        console.log("New Message", dto);
        
        const doc = await MessageModel.create({
          fromUserId: userId,
          toUserId: dto.toUserId,
          protoVersion,
          payload: protoVersion === 1 ? dto.payload : null,
          v2: protoVersion === 2 ? dto.v2 : null,
          clientMessageId: dto.clientMessageId,
          createdAtClient: dto.createdAt,
        });

        // пересылаем получателю так же versioned
        io.to(dto.toUserId).emit("message:new", {
          serverMessageId: String(doc._id),
          fromUserId: String(userId),
          toUserId: String(dto.toUserId),
          protoVersion,
          payload: doc.payload,
          v2: doc.v2,
          clientMessageId: dto.clientMessageId,
          createdAt: dto.createdAt,
        });

        ack?.({ ok: true, serverMessageId: String(doc._id) });
      } catch (e: any) {
        console.error(e);
        ack?.({ ok: false, error: e?.message || "Server error" });
      }
    });
  });
}
