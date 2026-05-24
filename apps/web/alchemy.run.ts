import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Drizzle from "alchemy/Drizzle/Providers";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import Backend from "./backend";

export default Alchemy.Stack(
  "Web",
  {
    customTld: "test",
    providers: Layer.mergeAll(Cloudflare.providers(), Drizzle.providers()),
    state: Cloudflare.state(),
  },
  Effect.gen(function* stack() {
    const backend = yield* Backend;
    const website = yield* Cloudflare.Vite("Website", {
      compatibility: {
        flags: ["nodejs_compat"],
      },
      env: {
        VITE_BETTER_AUTH_URL: backend.url.as<string>(),
      },
    });

    return {
      backend: backend.url,
      url: website.url,
    };
  })
);
