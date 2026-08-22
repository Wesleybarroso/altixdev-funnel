import { describe, expect, it } from "vitest";
import { ADMIN_SESSION_COOKIE, hasAdminSession } from "./adminAuth";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createLoginContext() {
  const cookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
  const ctx: TrpcContext = {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => cookies.push({ name, value, options }),
      clearCookie: () => undefined,
    } as TrpcContext["res"],
  };
  return { ctx, cookies };
}

describe("login administrativo por credenciais", () => {
  it("aceita as credenciais administrativas protegidas e emite um cookie de sessão", async () => {
    const { ctx, cookies } = createLoginContext();
    const caller = appRouter.createCaller(ctx);
    const email = process.env.ALTIXDEV_ADMIN_EMAIL ?? "";
    const password = process.env.ALTIXDEV_ADMIN_PASSWORD ?? "";

    await expect(caller.auth.adminLogin({ email, password })).resolves.toMatchObject({ success: true, email });
    expect(cookies).toHaveLength(1);
    expect(cookies[0]?.name).toBe(ADMIN_SESSION_COOKIE);
    expect(cookies[0]?.value).toContain(".");
    expect(cookies[0]?.options).toMatchObject({ httpOnly: true, path: "/" });
    await expect(
      hasAdminSession({ headers: { cookie: `${ADMIN_SESSION_COOKIE}=${cookies[0]?.value}` } } as never),
    ).resolves.toBe(true);
  });

  it("rejeita uma senha inválida sem criar sessão", async () => {
    const { ctx, cookies } = createLoginContext();
    const caller = appRouter.createCaller(ctx);
    const email = process.env.ALTIXDEV_ADMIN_EMAIL ?? "";

    await expect(caller.auth.adminLogin({ email, password: "senha-incorreta" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(cookies).toHaveLength(0);
  });

  it("retorna acesso liberado ao painel quando a sessão administrativa está presente", async () => {
    const { ctx } = createLoginContext();
    ctx.passwordAdmin = true;
    const caller = appRouter.createCaller(ctx);

    await expect(caller.auth.adminStatus()).resolves.toMatchObject({
      authenticated: true,
      email: process.env.ALTIXDEV_ADMIN_EMAIL,
    });
  });
});
