import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { createContext } from "../../server/_core/context";
import { appRouter } from "../../server/routers";

export default createExpressMiddleware({
  router: appRouter,
  createContext,
});
