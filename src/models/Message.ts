// import { Schema, model, Types, type InferSchemaType } from 'mongoose';

// const EncryptedPayloadSchema = new Schema(
//   {
//     nonce: { type: String, required: true },      // base64
//     ciphertext: { type: String, required: true }, // base64
//   },
//   { _id: false }
// );

// const MessageSchema = new Schema(
//   {
//     fromUserId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
//     toUserId: { type: Types.ObjectId, ref: 'User', required: true, index: true },

//     payload: { type: EncryptedPayloadSchema, required: true },

//     clientMessageId: { type: String, required: true },
//     createdAtClient: { type: Number, required: true },

//     deliveredAt: { type: Date, default: null },
//     readAt: { type: Date, default: null },
//   },
//   { timestamps: true }
// );

// MessageSchema.index({ fromUserId: 1, toUserId: 1, clientMessageId: 1 }, { unique: true });
// MessageSchema.index({ fromUserId: 1, toUserId: 1, createdAtClient: -1 });

// export type MessageDoc = InferSchemaType<typeof MessageSchema>;
// export const MessageModel = model('Message', MessageSchema);







// ##########################################
import { Schema, model, Types } from 'mongoose';

const V1PayloadSchema = new Schema(
  {
    nonce: { type: String, required: true },
    ciphertext: { type: String, required: true },
  },
  { _id: false }
);

const V2Schema = new Schema(
  {
    header: {
      n: { type: Number, required: true },
      pn: { type: Number, required: true },
      // позже (3.6) добавим dhPub
      dhPub: { type: String, required: true },
    },
    nonce: { type: String, required: true },
    ciphertext: { type: String, required: true },
  },
  { _id: false }
);

const MessageSchema = new Schema(
  {
    fromUserId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    toUserId: { type: Types.ObjectId, ref: 'User', required: true, index: true },

    // v1 vs v2 selector
    protoVersion: { type: Number, default: 1, index: true },

    // v1 payload
    payload: { type: V1PayloadSchema, default: null },

    // v2 payload
    v2: { type: V2Schema, default: null },

    clientMessageId: { type: String, required: true },
    createdAtClient: { type: Number, required: true, index: true },
  },
  { timestamps: true }
);

export const MessageModel = model('Message', MessageSchema);
