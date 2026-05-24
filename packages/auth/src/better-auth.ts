import { D1Database } from "@spells/db";
import type { RuntimeContext as RuntimeContextService } from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import type { HttpEffect } from "alchemy/Http";
import { betterAuth as makeBetterAuth } from "better-auth";
import type { Auth, BetterAuthOptions } from "better-auth";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { HttpServerRequest } from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";

export class BetterAuth extends Context.Service<
  BetterAuth,
  {
    readonly auth: Effect.Effect<
      Auth<BetterAuthOptions>,
      never,
      RuntimeContextService | Cloudflare.WorkerEnvironment
    >;
    readonly fetch: HttpEffect<
      RuntimeContextService | Cloudflare.WorkerEnvironment
    >;
  }
>()("@spells/auth/BetterAuth") {
  static readonly layer = Layer.effect(
    BetterAuth,
    Effect.gen(function* CloudflareD1() {
      const d1 = yield* D1Database;

      const connection = yield* Cloudflare.D1Connection.bind(d1);

      const baseUrl: URL = new URL("http://web.test");
      const crossSubDomainCookies = true;

      const betterAuth = yield* Effect.gen(function* makeAuth() {
        const env = yield* Cloudflare.WorkerEnvironment;
        const secret = env.BETTER_AUTH_SECRET;
        if (typeof secret !== "string" || secret.length === 0) {
          return yield* Effect.die(
            "BETTER_AUTH_SECRET Worker environment binding is missing"
          );
        }

        return makeBetterAuth({
          advanced: crossSubDomainCookies
            ? {
                crossSubDomainCookies: {
                  domain: `${baseUrl.hostname}`,
                  enabled: true,
                },
              }
            : {},
          baseURL: baseUrl.toString(),
          database: yield* connection.raw,
          emailAndPassword: { enabled: true },
          secret,
          trustedOrigins: (request) => {
            const origin = request?.headers.get("origin");
            return Promise.resolve(origin ? [origin] : []);
          },
        }) as Auth<BetterAuthOptions>;
      }).pipe(Effect.cached);

      return {
        auth: betterAuth,
        fetch: Effect.gen(function* fetch() {
          const request = yield* HttpServerRequest;
          const source = request.source as Request;
          if (source.method === "OPTIONS") {
            return HttpServerResponse.fromWeb(
              new Response(null, {
                headers: corsHeaders(source),
                status: 204,
              })
            );
          }

          const auth = yield* betterAuth;

          const response = yield* Effect.promise(() => auth.handler(source));
          return HttpServerResponse.fromWeb(addCorsHeaders(source, response));
        }),
      };
    })
  ).pipe(Layer.provide(Cloudflare.D1ConnectionLive));
}

const corsHeaders = (request: Request) => {
  const headers = new Headers();
  const origin = request.headers.get("origin");
  if (origin) {
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }
  headers.set(
    "Access-Control-Allow-Headers",
    request.headers.get("access-control-request-headers") ??
      "Content-Type, Authorization"
  );
  headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );
  return headers;
};

const addCorsHeaders = (request: Request, response: Response) => {
  const origin = request.headers.get("origin");
  if (!origin) {
    return response;
  }

  const headers = new Headers(response.headers);
  for (const [key, value] of corsHeaders(request)) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
};
