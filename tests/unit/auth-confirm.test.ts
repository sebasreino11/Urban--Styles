import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const verifyOtp = vi.fn();
const exchangeCodeForSession = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { verifyOtp, exchangeCodeForSession } }),
}));

// redirect() de Next lanza; lo convertimos en un error con el destino.
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

import { GET, POST } from "@/app/auth/confirm/route";

const call = (qs: string) => GET(new NextRequest(`http://localhost:3000/auth/confirm?${qs}`));

describe("GET /auth/confirm", () => {
  beforeEach(() => {
    verifyOtp.mockReset().mockResolvedValue({ error: null });
    exchangeCodeForSession.mockReset().mockResolvedValue({ error: null });
  });

  it("GET con token_hash va a /auth/continue sin consumir el token", async () => {
    await expect(call("token_hash=abc&type=recovery&next=/auth/update-password")).rejects.toThrow(
      "REDIRECT:/auth/continue?token_hash=abc&type=recovery&next=%2Fauth%2Fupdate-password",
    );
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("intercambia el code (PKCE) y redirige a next", async () => {
    await expect(call("code=xyz&next=/auth/update-password")).rejects.toThrow("REDIRECT:/auth/update-password");
    expect(exchangeCodeForSession).toHaveBeenCalledWith("xyz");
  });

  it("sin parámetros va a error con motivo missing_token", async () => {
    await expect(call("next=/auth/update-password")).rejects.toThrow("REDIRECT:/auth/error?reason=missing_token");
  });

  it("si Supabase rechaza el code va a error con motivo invalid", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { message: "bad" } });
    await expect(call("code=xyz")).rejects.toThrow("REDIRECT:/auth/error?reason=invalid");
  });

});

const post = (fields: Record<string, string>) =>
  POST(
    new NextRequest("http://localhost:3000/auth/confirm", {
      method: "POST",
      body: new URLSearchParams(fields),
    }),
  );

describe("POST /auth/confirm", () => {
  beforeEach(() => verifyOtp.mockReset().mockResolvedValue({ error: null }));

  it("verifica el token y redirige (303) a next", async () => {
    const res = await post({ token_hash: "abc", type: "recovery", next: "/auth/update-password" });
    expect(verifyOtp).toHaveBeenCalledWith({ type: "recovery", token_hash: "abc" });
    expect(res.status).toBe(303);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/auth/update-password");
  });

  it("ignora un next externo", async () => {
    const res = await post({ token_hash: "abc", type: "recovery", next: "//evil.com" });
    expect(new URL(res.headers.get("location")!).pathname).toBe("/agenda");
  });

  it("token rechazado va a error invalid", async () => {
    verifyOtp.mockResolvedValue({ error: { message: "expired" } });
    const res = await post({ token_hash: "abc", type: "recovery" });
    expect(res.headers.get("location")).toContain("/auth/error?reason=invalid");
  });

  it("sin token va a missing_token", async () => {
    const res = await post({ type: "recovery" });
    expect(res.headers.get("location")).toContain("reason=missing_token");
    expect(verifyOtp).not.toHaveBeenCalled();
  });
});
