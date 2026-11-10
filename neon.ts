import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  // Declare your Neon services here.
  // Lakebase Postgres ships with every project. Auth is self-managed Better Auth (phone-number sign-up)
  // running in the Next.js app and storing users/sessions in this Postgres, so Managed Auth is not enabled.
  aiGateway: true,
  // Branch policy: per-branch tuning
  branch: (branch) => {
    if (branch.isDefault) {
      // Default branch: no overrides, uses project defaults
      return {};
    }
    if (!branch.exists) {
      // New non-default branches: auto-expire
      // Run `neon checkout <name>` to create a new branch with these settings
      return { ttl: "7d" };
    }
    // Existing branch: no changes
    return {};
  },
});
