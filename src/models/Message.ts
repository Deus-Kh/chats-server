import { Schema, model, Types, type InferSchemaType } from 'mongoose';

const EncryptedPayloadSchema = new Schema(
  {
    nonce: { type: String, required: true },      // base64
    ciphertext: { type: String, required: true }, // base64
  },
  { _id: false }
);

const MessageSchema = new Schema(
  {
    fromUserId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    toUserId: { type: Types.ObjectId, ref: 'User', required: true, index: true },

    payload: { type: EncryptedPayloadSchema, required: true },

    clientMessageId: { type: String, required: true },
    createdAtClient: { type: Number, required: true },

    deliveredAt: { type: Date, default: null },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

MessageSchema.index({ fromUserId: 1, toUserId: 1, clientMessageId: 1 }, { unique: true });
MessageSchema.index({ fromUserId: 1, toUserId: 1, createdAtClient: -1 });

export type MessageDoc = InferSchemaType<typeof MessageSchema>;
export const MessageModel = model('Message', MessageSchema);
