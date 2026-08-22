const baseUrl = process.env.ALTIXDEV_TEST_BASE_URL ?? "http://localhost:3000";
const email = process.env.ALTIXDEV_ADMIN_EMAIL;
const password = process.env.ALTIXDEV_ADMIN_PASSWORD;

if (!email || !password) {
  throw new Error("Credenciais administrativas não configuradas.");
}

const loginResponse = await fetch(`${baseUrl}/api/trpc/auth.adminLogin?batch=1`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ 0: { json: { email, password } } }),
});

if (!loginResponse.ok) {
  throw new Error(`Login administrativo falhou com status ${loginResponse.status}.`);
}

const setCookies = typeof loginResponse.headers.getSetCookie === "function"
  ? loginResponse.headers.getSetCookie()
  : [loginResponse.headers.get("set-cookie") ?? ""];
const sessionCookie = setCookies.find(cookie => cookie.startsWith("altixdev_admin_session="));

if (!sessionCookie) {
  throw new Error("Login aceito, mas o cookie de sessão não foi emitido.");
}

const cookiePair = sessionCookie.split(";")[0];
const input = encodeURIComponent(JSON.stringify({ 0: { json: null } }));
const statusResponse = await fetch(`${baseUrl}/api/trpc/auth.adminStatus?batch=1&input=${input}`, {
  headers: {
    "x-altixdev-admin-session": cookiePair.slice("altixdev_admin_session=".length),
  },
});

if (!statusResponse.ok) {
  throw new Error(`Status administrativo falhou com status ${statusResponse.status}.`);
}

const statusBody = await statusResponse.json();
const authenticated = statusBody?.[0]?.result?.data?.json?.authenticated;

if (authenticated !== true) {
  throw new Error("Cookie de sessão não liberou o status administrativo.");
}

console.log("Login administrativo de ponta a ponta validado: sessão emitida e painel liberado.");
