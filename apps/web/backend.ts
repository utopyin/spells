import { BetterAuth } from "@spells/auth";
import { Random, Secret } from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";

export default class Backend extends Cloudflare.Worker<Backend>()(
  "Backend",
  {
    main: import.meta.filename,
  },
  Effect.gen(function* BackendWorker() {
    const random = yield* Random("BETTER_AUTH_SECRET");
    yield* Secret("BETTER_AUTH_SECRET", random.text);

    const betterAuth = yield* BetterAuth;

    return {
      fetch: betterAuth.fetch,
    };
  }).pipe(Effect.provide(BetterAuth.layer))
) {}
