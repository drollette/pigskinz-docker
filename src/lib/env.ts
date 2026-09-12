import { db, type Database } from "../db";

// In the Cloudflare version this app was ported from, these values came from
// per-request Worker bindings. Running as a single long-lived Node process,
// there's no per-request binding to read -- they're just process.env, read
// once. AppEnv stays as its own type (rather than callers reading
// process.env directly) so every place that needs a secret goes through one
// typed surface.
export interface AppEnv {
  SENDGRID_API_KEY: string;
  ENVIRONMENT_NAME: "staging" | "production";
  INVITATION_CODE: string;
}

export function getEnv(): AppEnv {
  return {
    SENDGRID_API_KEY: process.env.SENDGRID_API_KEY ?? "",
    ENVIRONMENT_NAME: (process.env.ENVIRONMENT_NAME as AppEnv["ENVIRONMENT_NAME"]) ?? "production",
    INVITATION_CODE: process.env.INVITATION_CODE ?? "",
  };
}

export function getDb(): Database {
  return db;
}
