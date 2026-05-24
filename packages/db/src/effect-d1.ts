import {
  createTableRelationsHelpers,
  extractTablesRelationalConfig,
} from "drizzle-orm/_relations";
import type {
  ExtractTablesWithRelations,
  RelationalSchemaConfig,
  TablesRelationalConfig,
} from "drizzle-orm/_relations";
/* oxlint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion, @typescript-eslint/parameter-properties, class-methods-use-this, func-names, max-classes-per-file, no-shadow, prefer-destructuring, unicorn/no-array-reduce, unicorn/no-useless-undefined */
import type { BatchItem, BatchResponse } from "drizzle-orm/batch";
import { NoopCache } from "drizzle-orm/cache/core";
import type { Cache } from "drizzle-orm/cache/core";
import type { WithCacheConfig } from "drizzle-orm/cache/core/types";
import { entityKind } from "drizzle-orm/entity";
import { DefaultLogger, NoopLogger } from "drizzle-orm/logger";
import type { Logger } from "drizzle-orm/logger";
import type { AnyRelations, EmptyRelations } from "drizzle-orm/relations";
import { fillPlaceholders, sql as drizzleSql } from "drizzle-orm/sql";
import type { Query } from "drizzle-orm/sql";
import { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core/db";
import { SQLiteAsyncDialect } from "drizzle-orm/sqlite-core/dialect";
import type { SelectedFieldsOrdered } from "drizzle-orm/sqlite-core/query-builders/select.types";
import {
  SQLitePreparedQuery,
  SQLiteSession,
  SQLiteTransaction,
} from "drizzle-orm/sqlite-core/session";
import type {
  PreparedQueryConfig as PreparedQueryConfigBase,
  SQLiteExecuteMethod,
  SQLiteTransactionConfig,
} from "drizzle-orm/sqlite-core/session";
import type { DrizzleConfig } from "drizzle-orm/utils";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import type { SqlClient } from "effect/unstable/sql/SqlClient";
import type { SqlError } from "effect/unstable/sql/SqlError";

type PreparedQueryConfig = Omit<PreparedQueryConfigBase, "statement" | "run">;

type PromiseKeys = keyof Promise<unknown>;
type Decrement = [never, 0, 1, 2, 3, 4, 5];

export type Effectify<T, Depth extends number = 5> = Depth extends 0
  ? T
  : T extends PromiseLike<infer A>
    ? Effect.Effect<A, SqlError> & {
        readonly [K in keyof Omit<T, PromiseKeys>]: Effectify<
          T[K],
          Decrement[Depth]
        >;
      }
    : T extends (...args: infer Args) => infer Return
      ? (...args: Args) => Effectify<Return, Decrement[Depth]>
      : T extends object
        ? { readonly [K in keyof T]: Effectify<T[K], Decrement[Depth]> }
        : T;

export class EffectD1Database<
  TSchema extends Record<string, unknown> = Record<string, never>,
  TRelations extends AnyRelations = EmptyRelations,
> extends BaseSQLiteDatabase<
  "async",
  D1Result,
  TSchema,
  TRelations,
  ExtractTablesWithRelations<TSchema>
> {
  static override readonly [entityKind]: string = "EffectD1Database";

  batch<U extends BatchItem<"sqlite">, T extends Readonly<[U, ...U[]]>>(
    batch: T
  ): Effect.Effect<BatchResponse<T>, SqlError> {
    return (this as any).session.batch(batch) as Effect.Effect<
      BatchResponse<T>,
      SqlError
    >;
  }
}

export interface EffectSQLiteD1SessionOptions {
  readonly cache?: Cache;
  readonly logger?: Logger;
}

export class EffectSQLiteD1Session<
  TFullSchema extends Record<string, unknown>,
  TRelations extends AnyRelations,
  TSchema extends TablesRelationalConfig,
> extends SQLiteSession<"async", D1Result, TFullSchema, TRelations, TSchema> {
  static override readonly [entityKind]: string = "EffectSQLiteD1Session";

  private readonly cache: Cache;
  private readonly logger: Logger;

  constructor(
    private readonly client: SqlClient,
    dialect: SQLiteAsyncDialect,
    readonly relations: TRelations,
    readonly schema: RelationalSchemaConfig<TSchema> | undefined,
    options: EffectSQLiteD1SessionOptions = {}
  ) {
    super(dialect);
    this.cache = options.cache ?? new NoopCache();
    this.logger = options.logger ?? new NoopLogger();
  }

  override prepareQuery(
    query: Query,
    fields: SelectedFieldsOrdered | undefined,
    executeMethod: SQLiteExecuteMethod,
    customResultMapper?: (
      rows: unknown[][],
      mapColumnValue?: (value: unknown) => unknown
    ) => unknown,
    queryMetadata?: {
      type: "select" | "update" | "delete" | "insert";
      tables: string[];
    },
    cacheConfig?: WithCacheConfig
  ): any {
    return new EffectD1PreparedQuery(
      this.client,
      query,
      this.logger,
      this.cache,
      queryMetadata,
      cacheConfig,
      fields,
      executeMethod,
      customResultMapper
    );
  }

  override prepareRelationalQuery(
    query: Query,
    fields: SelectedFieldsOrdered | undefined,
    executeMethod: SQLiteExecuteMethod,
    customResultMapper: (
      rows: Record<string, unknown>[],
      mapColumnValue?: (value: unknown) => unknown
    ) => unknown,
    _config: unknown
  ): any {
    return new EffectD1PreparedQuery(
      this.client,
      query,
      this.logger,
      this.cache,
      undefined,
      undefined,
      fields,
      executeMethod,
      customResultMapper as unknown as (
        rows: unknown[][],
        mapColumnValue?: (value: unknown) => unknown
      ) => unknown
    );
  }

  batch<T extends BatchItem<"sqlite">[] | readonly BatchItem<"sqlite">[]>(
    queries: T
  ) {
    return Effect.all(
      queries.map((query) => {
        const preparedQuery = (query as any)._prepare();
        return (
          preparedQuery.execute() as Effect.Effect<unknown, SqlError>
        ).pipe(Effect.map((result) => preparedQuery.mapResult(result, true)));
      }),
      { concurrency: 1 }
    );
  }

  extractRawAllValueFromBatchResult(result: unknown): unknown {
    return result;
  }

  extractRawGetValueFromBatchResult(result: unknown): unknown {
    return (result as unknown[])[0];
  }

  extractRawValuesValueFromBatchResult(result: unknown): unknown {
    return result;
  }

  override transaction<T>(
    transaction: (
      tx: EffectD1Transaction<TFullSchema, TRelations, TSchema>
    ) => T,
    _config?: SQLiteTransactionConfig
  ): any {
    const self = this as any;
    return this.client.withTransaction(
      Effect.gen(function* () {
        const tx = new EffectD1Transaction(
          "async",
          self.dialect,
          self,
          self.relations,
          self.schema
        );

        return yield* transaction(
          tx as EffectD1Transaction<TFullSchema, TRelations, TSchema>
        ) as Effect.Effect<T, SqlError>;
      })
    );
  }
}

export class EffectD1Transaction<
  TFullSchema extends Record<string, unknown>,
  TRelations extends AnyRelations,
  TSchema extends TablesRelationalConfig,
> extends SQLiteTransaction<
  "async",
  D1Result,
  TFullSchema,
  TRelations,
  TSchema
> {
  static override readonly [entityKind]: string = "EffectD1Transaction";

  override transaction<T>(
    transaction: (
      tx: EffectD1Transaction<TFullSchema, TRelations, TSchema>
    ) => T
  ): any {
    const self = this as any;
    const savepointName = `sp${self.nestedIndex}`;
    const tx = new EffectD1Transaction(
      "async",
      self.dialect,
      self.session,
      self.relations,
      self.schema,
      self.nestedIndex + 1
    ) as EffectD1Transaction<TFullSchema, TRelations, TSchema>;

    return Effect.gen(function* () {
      yield* self.session.run(drizzleSql.raw(`savepoint ${savepointName}`));
      const exit = yield* Effect.exit(
        transaction(tx) as Effect.Effect<T, SqlError>
      );

      if (Exit.isSuccess(exit)) {
        yield* self.session.run(
          drizzleSql.raw(`release savepoint ${savepointName}`)
        );
        return exit.value;
      }

      yield* self.session.run(
        drizzleSql.raw(`rollback to savepoint ${savepointName}`)
      );
      return yield* exit;
    });
  }
}

export class EffectD1PreparedQuery<
  T extends PreparedQueryConfig = PreparedQueryConfig,
> extends SQLitePreparedQuery<{
  type: "async";
  run: D1Response;
  all: T["all"];
  get: T["get"];
  values: T["values"];
  execute: T["execute"];
}> {
  static override readonly [entityKind]: string = "EffectD1PreparedQuery";

  readonly fields?: SelectedFieldsOrdered;

  constructor(
    private readonly client: SqlClient,
    query: Query,
    private readonly logger: Logger,
    cache: Cache,
    queryMetadata:
      | {
          type: "select" | "update" | "delete" | "insert";
          tables: string[];
        }
      | undefined,
    cacheConfig: WithCacheConfig | undefined,
    fields: SelectedFieldsOrdered | undefined,
    executeMethod: SQLiteExecuteMethod,
    private readonly customResultMapper?: (
      rows: unknown[][],
      mapColumnValue?: (value: unknown) => unknown
    ) => unknown
  ) {
    super("async", executeMethod, query, cache, queryMetadata, cacheConfig);
    this.fields = fields;
  }

  override run(placeholderValues?: Record<string, unknown>): any {
    const params = fillPlaceholders(this.query.params, placeholderValues ?? {});

    return this.logQuery(params).pipe(
      Effect.flatMap(() => this.client.unsafe(this.query.sql, params).raw),
      Effect.map(
        (results) =>
          ({
            meta: {},
            results,
            success: true,
          }) as unknown as D1Response
      )
    );
  }

  override all(placeholderValues?: Record<string, unknown>): any {
    if (this.fields || this.customResultMapper) {
      return this.values(placeholderValues).pipe(
        Effect.map((rows) => this.mapAllResult(rows) as T["all"])
      );
    }

    const params = fillPlaceholders(this.query.params, placeholderValues ?? {});

    return this.logQuery(params).pipe(
      Effect.flatMap(
        () => this.client.unsafe(this.query.sql, params).withoutTransform
      ),
      Effect.map((rows) => this.mapAllResult(rows) as T["all"])
    );
  }

  override mapAllResult(rows: unknown, _isFromBatch?: boolean): unknown {
    if (!(this.fields || this.customResultMapper)) {
      return rows;
    }

    if (this.customResultMapper) {
      return this.customResultMapper(rows as unknown[][]);
    }

    return (rows as unknown[][]).map((row) =>
      mapResultRow(this.fields!, row, (this as any).joinsNotNullableMap)
    );
  }

  override get(placeholderValues?: Record<string, unknown>): any {
    if (this.fields || this.customResultMapper) {
      return this.values(placeholderValues).pipe(
        Effect.map((rows: unknown[][]) => {
          if (!rows[0]) {
            return undefined;
          }

          return this.mapGetResult(rows[0]) as T["get"];
        })
      );
    }

    const params = fillPlaceholders(this.query.params, placeholderValues ?? {});

    return this.logQuery(params).pipe(
      Effect.flatMap(
        () => this.client.unsafe(this.query.sql, params).withoutTransform
      ),
      Effect.map((rows) => this.mapGetResult(rows[0]) as T["get"])
    );
  }

  override mapGetResult(result: unknown, _isFromBatch?: boolean): unknown {
    if (!(this.fields || this.customResultMapper)) {
      return result;
    }

    if (!result) {
      return undefined;
    }

    if (this.customResultMapper) {
      return this.customResultMapper([result as unknown[]]);
    }

    return mapResultRow(
      this.fields!,
      result as unknown[],
      (this as any).joinsNotNullableMap
    );
  }

  override values<TValue extends unknown[] = unknown[]>(
    placeholderValues?: Record<string, unknown>
  ): any {
    const params = fillPlaceholders(this.query.params, placeholderValues ?? {});

    return this.logQuery(params).pipe(
      Effect.flatMap(() => this.client.unsafe(this.query.sql, params).values),
      Effect.map((rows) => rows as TValue[])
    );
  }

  private logQuery(params: unknown[]) {
    return Effect.sync(() => this.logger.logQuery(this.query.sql, params));
  }
}

export const make = <
  TSchema extends Record<string, unknown> = Record<string, never>,
  TRelations extends AnyRelations = EmptyRelations,
>(
  client: SqlClient,
  config: DrizzleConfig<TSchema, TRelations> = {}
) => {
  const dialect = new SQLiteAsyncDialect();
  let logger: Logger | undefined;
  if (config.logger === true) {
    logger = new DefaultLogger();
  } else if (config.logger !== false) {
    logger = config.logger;
  }

  let schema:
    | RelationalSchemaConfig<ExtractTablesWithRelations<TSchema>>
    | undefined;
  if (config.schema) {
    const tablesConfig = extractTablesRelationalConfig<
      ExtractTablesWithRelations<TSchema>
    >(config.schema, createTableRelationsHelpers);
    schema = {
      fullSchema: config.schema,
      schema: tablesConfig.tables,
      tableNamesMap: tablesConfig.tableNamesMap,
    };
  }

  const relations = config.relations ?? ({} as TRelations);
  const session = new EffectSQLiteD1Session(
    client,
    dialect,
    relations,
    schema,
    {
      cache: config.cache,
      logger,
    }
  );
  const db = new EffectD1Database("async", dialect, session, relations, schema);
  (db as any).$client = client;
  (db as any).$cache = config.cache;
  if ((db as any).$cache) {
    (db as any).$cache.invalidate = config.cache?.onMutate;
  }

  return db as unknown as Effectify<EffectD1Database<TSchema, TRelations>> & {
    readonly $client: SqlClient;
  };
};

const mapResultRow = (
  fields: SelectedFieldsOrdered,
  row: unknown[],
  joinsNotNullableMap?: Record<string, boolean>
) => {
  const nullifyMap: Record<string, false | string> = {};
  const result = fields.reduce<Record<string, any>>(
    (result, { path, field }, columnIndex) => {
      const typedField = field as any;
      const decoder =
        typedField.decoder ??
        typedField.sql?.decoder ??
        typedField._.sql.decoder;
      let node = result;

      for (const [pathChunkIndex, pathChunk] of path.entries()) {
        if (pathChunkIndex < path.length - 1) {
          node[pathChunk] ??= {};
          node = node[pathChunk];
        } else {
          const rawValue = row[columnIndex];
          const value =
            rawValue === null ? null : decoder.mapFromDriverValue(rawValue);
          node[pathChunk] = value;

          if (joinsNotNullableMap && typedField.table && path.length === 2) {
            const objectName = path[0]!;
            const tableName = typedField.table[
              Symbol.for("drizzle:Name")
            ] as string;
            if (!(objectName in nullifyMap)) {
              nullifyMap[objectName] = value === null ? tableName : false;
            } else if (
              typeof nullifyMap[objectName] === "string" &&
              nullifyMap[objectName] !== tableName
            ) {
              nullifyMap[objectName] = false;
            }
          }
        }
      }

      return result;
    },
    {}
  );

  if (joinsNotNullableMap && Object.keys(nullifyMap).length > 0) {
    for (const [objectName, tableName] of Object.entries(nullifyMap)) {
      if (typeof tableName === "string" && !joinsNotNullableMap[tableName]) {
        result[objectName] = null;
      }
    }
  }

  return result;
};
