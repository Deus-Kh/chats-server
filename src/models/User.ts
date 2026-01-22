import { Schema, model, type InferSchemaType } from 'mongoose';

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 32, index: true },
    passwordHash: { type: String, required: true },

    // base64 public key (tweetnacl.box.keyPair().publicKey)
    publicKey: { type: String, default: null, index: true },
    publicKeyUpdatedAt: { type: Date, default: null },

    identitySignPublicKey: { type: String, default: null, index: true },
    identitySignUpdatedAt: { type: Date, default: null },

  },
  { timestamps: true }
);

export type UserDoc = InferSchemaType<typeof UserSchema>;
export const UserModel = model('User', UserSchema);
