import type { Server } from 'socket.io';
import { Types } from 'mongoose';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { MessageModel } from '../models/Message';

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
      if (!token) return next(new Error('Unauthorized'));

      const decoded = jwt.verify(token, config.JWT_SECRET) as { userId: string };
      socket.data.userId = decoded.userId;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const userId = String(socket.data.userId);
    socket.join(userId); // room per userId
    console.log("Connected Socket");
    
    socket.on('message:send', async (dto: SendMessageDTO, ack?: (r: any) => void) => {
      console.log("message received");
      
      try {
        if (!dto?.toUserId || !dto?.payload?.nonce || !dto?.payload?.ciphertext) {
          return ack?.({ ok: false, error: 'Invalid payload' });
        }

        const doc = await MessageModel.create({
          fromUserId: userId,
          toUserId: dto.toUserId,
          payload: dto.payload,
          clientMessageId: dto.clientMessageId,
          createdAtClient: dto.createdAt,
        });

        const serverMessageId = String(doc._id);
        console.log('Saved message:', doc._id);
        const out = {
          fromUserId: userId,
          toUserId: dto.toUserId,
          payload: dto.payload,
          clientMessageId: dto.clientMessageId,
          createdAt: dto.createdAt,
          serverMessageId,
        };

        io.to(dto.toUserId).emit('message:new', out);

        return ack?.({ ok: true, serverMessageId });
      } catch (e: any) {
        // возможен duplicate key при retry (unique index)
        if (e?.code === 11000) {
          // можно найти существующее сообщение по индексу и вернуть его id
          return ack?.({ ok: true, serverMessageId: 'duplicate' });
        }
        return ack?.({ ok: false, error: e?.message || 'Server error' });
      }
    });
  });
}
