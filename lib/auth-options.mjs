// Shared phone-number plugin options. Plain .mjs so the migration script (scripts/migrate-auth.mjs) and the
// app build the exact same schema.

/** E.164: "+" then 8–15 digits. Country-specific checks happen in the sign-in form. */
const E164 = /^\+[1-9]\d{7,14}$/;

export const authPluginOptions = {
  otpLength: 6,
  expiresIn: 300,
  allowedAttempts: 5,
  phoneNumberValidator: (p) => E164.test(p),
  signUpOnVerification: {
    // Better Auth needs an email column; phone-only users get a non-routable placeholder.
    getTempEmail: (p) => `${p.replace(/\D/g, "")}@phone.sokobot.invalid`,
    getTempName: (p) => p,
  },
};
