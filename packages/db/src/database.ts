import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import * as EffectD1 from "./effect-d1.ts";
import { tables } from "./schema.ts";
import type { Schema } from "./schema.ts";

export type DrizzleDatabase = ReturnType<typeof EffectD1.make<Schema>>;

export class Database extends Context.Service<Database, DrizzleDatabase>()(
  "@spells/db/Database"
) {
  static readonly layer = Layer.effect(
    Database,
    Effect.gen(function* makeDatabase() {
      const sql = yield* SqlClient.SqlClient;

      return EffectD1.make(sql, { schema: tables });
    })
  );
}
