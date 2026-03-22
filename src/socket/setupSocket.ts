// import type { Server } from "socket.io";
// import { Types } from "mongoose";
// import jwt from "jsonwebtoken";
// import { config } from "../config";
// import { MessageModel } from "../models/Message";

// type SendMessageDTO = {
//   toUserId: string;
//   payload: { nonce: string; ciphertext: string };
//   clientMessageId: string;
//   createdAt: number;
// };

// export function setupSocket(io: Server) {
//   io.use((socket, next) => {
//     try {
//       const token = socket.handshake.auth?.token;
//       if (!token) return next(new Error("Unauthorized"));

//       const decoded = jwt.verify(token, config.JWT_SECRET) as {
//         userId: string;
//       };
//       socket.data.userId = decoded.userId;
//       next();
//     } catch {
//       next(new Error("Unauthorized"));
//     }
//   });

//   io.on("connection", (socket) => {
//     const userId = String(socket.data.userId);
//     socket.join(userId); // room per userId
//     console.log("Connected Socket");


//     socket.on("message:send", async (dto, ack) => {
//       // console.log("New message 1");
      
//       try {
//         const protoVersion = dto?.protoVersion === 2 ? 2 : 1;

//         if (protoVersion === 1) {
//           if (!dto?.payload?.nonce || !dto?.payload?.ciphertext) {
//             return ack?.({ ok: false, error: "Invalid v1 payload" });
//           }
//         } else {
//           if (
//             !dto?.v2?.header ||
//             typeof dto?.v2?.header?.n !== "number" ||
//             typeof dto?.v2?.header?.pn !== "number" ||
//             !dto?.v2?.nonce ||
//             !dto?.v2?.ciphertext||
//             (typeof dto?.v2?.header?.dhPub === 'string' && dto.v2.header.dhPub.length > 20)

//           ) {
//             return ack?.({ ok: false, error: "Invalid v2 payload" });
//           }
//         }
//         // console.log("New Message", dto);
        
//         const doc = await MessageModel.create({
//           fromUserId: userId,
//           toUserId: dto.toUserId,
//           protoVersion,
//           payload: protoVersion === 1 ? dto.payload : null,
//           v2: protoVersion === 2 ? dto.v2 : null,
//           clientMessageId: dto.clientMessageId,
//           createdAtClient: dto.createdAt,
//         });

//         // пересылаем получателю так же versioned
//         io.to(dto.toUserId).emit("message:new", {
//           serverMessageId: String(doc._id),
//           fromUserId: String(userId),
//           toUserId: String(dto.toUserId),
//           protoVersion,
//           payload: doc.payload,
//           v2: doc.v2,
//           clientMessageId: dto.clientMessageId,
//           createdAt: dto.createdAt,
//         });

//         ack?.({ ok: true, serverMessageId: String(doc._id) });
//       } catch (e: any) {
//         console.error(e);
//         ack?.({ ok: false, error: e?.message || "Server error" });
//       }
//     });
//   });
// }

// server/src/socket/setupSocket.ts
import type { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { MessageModel } from "../models/Message";

type V1Payload = { nonce: string; ciphertext: string };

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
  protoVersion?: 1 | 2;
  payload?: V1Payload | null; // v1
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


    // socket.on("message:send", async (dto: SendMessageDTO, ack?: (r: any) => void) => {

    //   console.log("DTO : ",dto);
      
    //   try {
    //     // Basic sanity checks
    //     if (!dto?.toUserId || !isValidObjectIdString(dto.toUserId)) {
    //       return ack?.({ ok: false, error: "Invalid toUserId" });
    //     }
    //     if (!isNonEmptyString(dto.clientMessageId, 3)) {
    //       return ack?.({ ok: false, error: "Invalid clientMessageId" });
    //     }
    //     if (typeof dto.createdAt !== "number") {
    //       return ack?.({ ok: false, error: "Invalid createdAt" });
    //     }

    //     const protoVersion: 1 | 2 = dto?.protoVersion === 2 ? 2 : 1;

    //     if (protoVersion === 1) {
    //       // v1 payload validation
    //       if (!dto.payload || !isNonEmptyString(dto.payload.nonce, 8) || !isNonEmptyString(dto.payload.ciphertext, 8)) {
    //         return ack?.({ ok: false, error: "Invalid v1 payload" });
    //       }
    //     } else {
    //       // v2 payload validation
    //       const v2 = dto.v2;
    //       if (
    //         !v2 ||
    //         !v2.header ||
    //         typeof v2.header.n !== "number" ||
    //         typeof v2.header.pn !== "number" ||
    //         !isNonEmptyString(v2.header.dhPub, 20) ||
    //         !isNonEmptyString(v2.nonce, 8) ||
    //         !isNonEmptyString(v2.ciphertext, 8)
    //       ) {
    //         return ack?.({ ok: false, error: "Invalid v2 payload" });
    //       }
    //     }

    //     const doc = await MessageModel.create({
    //       fromUserId: userId,
    //       toUserId: dto.toUserId,

    //       protoVersion,
    //       payload: protoVersion === 1 ? dto.payload : null,
    //       v2: protoVersion === 2 ? dto.v2 : null,

    //       clientMessageId: dto.clientMessageId,
    //       createdAtClient: dto.createdAt,
    //     });

    //     // forward to receiver (versioned)
    //     io.to(dto.toUserId).emit("message:new", {
    //       serverMessageId: String(doc._id),
    //       fromUserId: String(userId),
    //       toUserId: String(dto.toUserId),
    //       // fromUserId: String(dto.toUserId),
    //       // toUserId: String(userId),


    //       protoVersion,
    //       payload: doc.payload,
    //       v2: doc.v2,

    //       clientMessageId: dto.clientMessageId,
    //       createdAt: dto.createdAt,
    //     });
    //     console.log('[socket] send -> room', dto.toUserId, 'from', userId, 'pv', protoVersion);


    //     return ack?.({ ok: true, serverMessageId: String(doc._id) });
    //   } catch (e: any) {
    //     console.error("message:send failed:", e);
    //     return ack?.({ ok: false, error: e?.message || "Server error" });
    //   }
    // });



  socket.on("message:send", async (dto: SendMessageDTO, ack?: (r: any) => void) => {
  try {
    if (!dto?.toUserId || !isValidObjectIdString(dto.toUserId)) {
      return ack?.({ ok: false, error: "Invalid toUserId" });
    }
    if (!isNonEmptyString(dto.clientMessageId, 3)) {
      return ack?.({ ok: false, error: "Invalid clientMessageId" });
    }
    if (typeof dto.createdAt !== "number") {
      return ack?.({ ok: false, error: "Invalid createdAt" });
    }

    const protoVersion: 1 | 2 = dto?.protoVersion === 2 ? 2 : 1;

    if (protoVersion === 1) {
      if (!dto.payload || !isNonEmptyString(dto.payload.nonce, 8) || !isNonEmptyString(dto.payload.ciphertext, 8)) {
        return ack?.({ ok: false, error: "Invalid v1 payload" });
      }
    } else {
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
        return ack?.({ ok: false, error: "Invalid v2 payload" });
      }
    }

    const doc = await MessageModel.create({
      fromUserId: userId,
      toUserId: dto.toUserId,
      protoVersion,
      payload: protoVersion === 1 ? dto.payload : null,
      v2: protoVersion === 2 ? dto.v2 : null,
      initPacket: protoVersion === 2 ? dto.initPacket ?? null : null,
      clientMessageId: dto.clientMessageId,
      createdAtClient: dto.createdAt,
    });

    const room = io.sockets.adapter.rooms.get(String(dto.toUserId));
    console.log('[socket] send', {
      from: userId,
      to: dto.toUserId,
      pv: protoVersion,
      roomSize: room ? room.size : 0,
      // if v2:
      n: protoVersion === 2 ? dto.v2?.header.n : undefined,
    });

    io.to(dto.toUserId).emit("message:new", {
      serverMessageId: String(doc._id),
      fromUserId: String(userId),
      toUserId: String(dto.toUserId),
      protoVersion,
      payload: doc.payload,
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
