import dotenv from 'dotenv';
dotenv.config();

export const config = {
  PORT: Number(process.env.PORT || 9999),
  MONGO_URI: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/secure-messenger',
  JWT_SECRET: process.env.JWT_SECRET || 'supersecretkey123',
  JWT_ALGORITHM:"HS256",
  JWT_MAX_AGE:"10800s",
  BCRYPT_ROUNDS: Number(process.env.BCRYPT_ROUNDS || 10),
};
