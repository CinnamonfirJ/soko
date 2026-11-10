import "server-only";
import { betterAuth } from "better-auth";
import { phoneNumber } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { pool } from "./db";
import { deliverOtp } from "./otp-delivery";
import { authPluginOptions } from "./auth-options.mjs";

// Self-managed Better Auth (phone-number sign-up) running in this Next.js app, with users and sessions in
// Neon Postgres. Managed Neon Auth only lets existing users link a phone; SokoBot signs people up by phone.
export const auth = betterAuth({
  appName: "SokoBot",
  database: pool(),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  basePath: "/api/identity",
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  rateLimit: { enabled: true, window: 60, max: 30 },
  plugins: [
    phoneNumber({
      ...authPluginOptions,
      sendOTP: async ({ phoneNumber, code }) => { await deliverOtp(phoneNumber, code); },
    }),
    nextCookies(),
  ],
});
