import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";

export const D1Database = Effect.gen(function* D1Database() {
  return yield* Cloudflare.D1Database("Database", {
    migrationsDir: "../../packages/db/drizzle",
  });
});
