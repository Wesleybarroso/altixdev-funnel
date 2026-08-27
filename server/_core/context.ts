import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { hasAdminSession } from "../adminAuth";
import { sdk } from "./sdk";
import { ENV } from "./env";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  passwordAdmin?: boolean;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  if (ENV.oAuthServerUrl) {
    try {
      user = await sdk.authenticateRequest(opts.req);
    } catch {
      // OAuth authentication is optional for public procedures.
      user = null;
    }
  }

  let passwordAdmin = false;
  try {
    passwordAdmin = await hasAdminSession(opts.req);
  } catch {
    // The public landing page and login screen must still render when
    // production session secrets have not been configured yet.
    passwordAdmin = false;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    passwordAdmin,
  };
}
