import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { ADMIN_SESSION_COOKIE, createAdminSession, getAdminSessionDuration, getConfiguredAdminEmail, verifyAdminCredentials } from "./adminAuth";
import { createLead, listLeads, updateLead } from "./db";
import { getAdminSessionCookieOptions, getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";

const leadStageSchema = z.enum(["new", "diagnostic", "proposal", "won", "lost"]);
const leadPrioritySchema = z.enum(["low", "medium", "high"]);

const leadInputSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(320),
  phone: z.string().min(8).max(48),
  company: z.string().max(160).optional(),
  objective: z.string().min(1).max(120),
  currentChannel: z.string().min(1).max(120),
  bottleneck: z.string().min(1).max(160),
  urgency: z.string().min(1).max(64),
  consent: z.literal(true),
});

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    adminStatus: publicProcedure.query(({ ctx }) => ({
      authenticated: Boolean(ctx.passwordAdmin),
      email: ctx.passwordAdmin ? getConfiguredAdminEmail() : null,
    })),
    adminLogin: publicProcedure
      .input(z.object({ email: z.string().email().max(320), password: z.string().min(1).max(256) }))
      .mutation(async ({ ctx, input }) => {
        if (!verifyAdminCredentials(input.email, input.password)) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha inválidos." });
        }

        const token = await createAdminSession();
        ctx.res.cookie(ADMIN_SESSION_COOKIE, token, {
          ...getAdminSessionCookieOptions(ctx.req),
          maxAge: getAdminSessionDuration(),
        });
        return { success: true, email: getConfiguredAdminEmail(), sessionToken: token } as const;
      }),
    adminLogout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(ADMIN_SESSION_COOKIE, getAdminSessionCookieOptions(ctx.req));
      return { success: true } as const;
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  leads: router({
    create: publicProcedure.input(leadInputSchema).mutation(async ({ input }) => {
      const diagnosticSummary = [
        `Objetivo: ${input.objective}`,
        `Canal atual: ${input.currentChannel}`,
        `Gargalo: ${input.bottleneck}`,
        `Urgência: ${input.urgency}`,
      ].join(" · ");

      const id = await createLead({
        ...input,
        company: input.company?.trim() || null,
        source: "landing-page",
        diagnosticSummary,
        consentAt: new Date(),
        whatsappRedirectedAt: new Date(),
      });

      return { id, diagnosticSummary };
    }),
    list: adminProcedure
      .input(z.object({ search: z.string().max(120).optional(), stage: leadStageSchema.optional() }).optional())
      .query(async ({ input }) => listLeads(input)),
    metrics: adminProcedure.query(async () => {
      const records = await listLeads();
      return {
        total: records.length,
        new: records.filter(record => record.stage === "new").length,
        diagnostic: records.filter(record => record.stage === "diagnostic").length,
        proposal: records.filter(record => record.stage === "proposal").length,
        won: records.filter(record => record.stage === "won").length,
      };
    }),
    update: adminProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          stage: leadStageSchema.optional(),
          priority: leadPrioritySchema.optional(),
          notes: z.string().max(10000).nullable().optional(),
          nextStep: z.string().max(1000).nullable().optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const { id, ...changes } = input;
        await updateLead(id, changes);
        return { success: true } as const;
      }),
  }),
});

export type AppRouter = typeof appRouter;
