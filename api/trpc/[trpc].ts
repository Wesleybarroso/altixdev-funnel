import { nodeHTTPRequestHandler } from "@trpc/server/adapters/node-http";
import { createContext } from "../../server/_core/context";
import { getConfiguredAdminEmail, hasAdminSession } from "../../server/adminAuth";
import { appRouter } from "../../server/routers";

type NodeRequest = Parameters<typeof nodeHTTPRequestHandler>[0]["req"];
type NodeResponse = Parameters<typeof nodeHTTPRequestHandler>[0]["res"];

export default async function handler(req: NodeRequest, res: NodeResponse) {
  if (req.url?.split("?")[0].endsWith("/auth.adminStatus")) {
    const authenticated = await hasAdminSession(req).catch(() => false);
    res.statusCode = 200;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify([{ result: { data: { json: { authenticated, email: authenticated ? getConfiguredAdminEmail() : null } } } }]));
    return;
  }

  await nodeHTTPRequestHandler({
    req,
    res,
    router: appRouter,
    createContext,
  });
}
