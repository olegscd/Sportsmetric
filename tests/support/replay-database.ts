import type { PGlite } from "@electric-sql/pglite";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Small transport adapter: the real scanner executes real PostgreSQL RPCs in
 * tests, while YouTube HTTP responses remain deterministic and offline. */
export function replayTestClient(pg: PGlite): SupabaseClient {
  const ident = (value: string) => {
    if (!/^[a-z_]+$/.test(value)) throw new Error("Unexpected test SQL identifier");
    return `"${value}"`;
  };
  class Query {
    filters: { column: string; op: string; value?: unknown }[] = [];
    orders: string[] = []; count = 100000; offset = 0; singular = false;
    operation = "select"; values: Record<string, unknown> = {};
    constructor(readonly table: string) {}
    select() { return this; }
    eq(column: string, value: unknown) { this.filters.push({ column, op: "=", value }); return this; }
    gt(column: string, value: unknown) { this.filters.push({ column, op: ">", value }); return this; }
    not(column: string) { this.filters.push({ column, op: "IS NOT NULL" }); return this; }
    order(column: string) { this.orders.push(ident(column)); return this; }
    range(from: number, to: number) { this.offset = from; this.count = to - from + 1; return this; }
    limit(count: number) { this.count = count; return this; }
    single() { this.singular = true; return this; }
    update(values: Record<string, unknown>) { this.operation = "update"; this.values = values; return this; }
    upsert(values: Record<string, unknown>) { this.operation = "upsert"; this.values = values; return this; }
    async execute() {
      try {
        const params: unknown[] = [];
        const param = (value: unknown) => { params.push(value); return `$${params.length}`; };
        const where = () => this.filters.length ? " WHERE " + this.filters.map(f => `${ident(f.column)} ${f.op}${f.op === "IS NOT NULL" ? "" : " " + param(f.value)}`).join(" AND ") : "";
        let sql: string;
        if (this.operation === "update") {
          sql = `UPDATE ${ident(this.table)} SET ${Object.entries(this.values).map(([k, v]) => `${ident(k)}=${param(v)}`).join(",")}${where()} RETURNING *`;
        } else if (this.operation === "upsert") {
          const entries = Object.entries(this.values);
          const conflict = this.table === "replay_scan_cursors" ? "channel_id,scope" : "id";
          sql = `INSERT INTO ${ident(this.table)} (${entries.map(([k]) => ident(k)).join(",")}) VALUES (${entries.map(([, v]) => param(v)).join(",")}) ON CONFLICT (${conflict}) DO UPDATE SET ${entries.map(([k]) => `${ident(k)}=EXCLUDED.${ident(k)}`).join(",")} RETURNING *`;
        } else sql = `SELECT * FROM ${ident(this.table)}${where()}${this.orders.length ? " ORDER BY " + this.orders.join(",") : ""} LIMIT ${this.count} OFFSET ${this.offset}`;
        const result = await pg.query(sql, params);
        return { data: this.singular ? result.rows[0] : result.rows, error: null };
      } catch (error) { return { data: null, error: { message: error instanceof Error ? error.message : String(error) } }; }
    }
    then(resolve: (value: Awaited<ReturnType<Query["execute"]>>) => unknown, reject?: (reason: unknown) => unknown) { return this.execute().then(resolve, reject); }
  }
  return {
    from: (table: string) => new Query(table),
    async rpc(name: string, args: Record<string, unknown> = {}) {
      try {
        const params = Object.values(args);
        const named = Object.keys(args).map((k, i) => `${ident(k)} => $${i + 1}`).join(",");
        return { data: (await pg.query<{ value: unknown }>(`SELECT ${ident(name)}(${named}) AS value`, params)).rows[0].value, error: null };
      } catch (error) { return { data: null, error: { message: error instanceof Error ? error.message : String(error) } }; }
    },
  } as unknown as SupabaseClient;
}
