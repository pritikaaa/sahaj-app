// Local stand-in for the Supabase REST API (PostgREST), for offline
// development and end-to-end tests ONLY. Production uses real Supabase.
//
// It implements the subset of PostgREST that supabase-js uses in this app:
//   GET / POST / PATCH / DELETE  /rest/v1/<table>
//   filters: eq, neq, gt, gte, lt, lte, in, is   ·   order, limit, select=*
//   Prefer: return=representation · Accept: application/vnd.pgrst.object+json
// Every request runs as the Postgres "anon" role (SET LOCAL ROLE anon), so the
// grants, RLS policies, CHECK constraints and triggers in supabase/schema.sql
// are exercised exactly as on Supabase.
//
// Usage: DATABASE_URL=postgres://... ANON_KEY=... PORT=54321 node server.mjs
import http from "node:http";
import pg from "pg";

const { DATABASE_URL, ANON_KEY, PORT = "54321" } = process.env;
if (!DATABASE_URL || !ANON_KEY) {
  console.error("DATABASE_URL and ANON_KEY are required");
  process.exit(1);
}

// Return dates/times as strings in the same ISO shape PostgREST (to_json) uses:
// date "2026-11-24", time "09:00:00", timestamptz "2026-11-24T10:00:00.123+00:00".
for (const oid of [1082, 1083]) pg.types.setTypeParser(oid, (v) => v);
pg.types.setTypeParser(1114, (v) => v.replace(" ", "T"));
pg.types.setTypeParser(1184, (v) => v.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00"));

const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 10 });
const IDENT = /^[a-z_][a-z0-9_]*$/;
const OPS = { eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=" };
const RESERVED = new Set(["select", "order", "limit", "offset", "columns", "on_conflict"]);

let columnTypes = null; // table -> { column -> data_type }
async function loadColumns() {
  const { rows } = await pool.query(
    `select table_name, column_name, data_type from information_schema.columns
     where table_schema = 'public'`
  );
  columnTypes = {};
  for (const r of rows) (columnTypes[r.table_name] ??= {})[r.column_name] = r.data_type;
}

function ident(name) {
  if (!IDENT.test(name)) throw httpError(400, "PGRST100", `bad identifier: ${name}`);
  return `"${name}"`;
}
function httpError(status, code, message, details = null) {
  return Object.assign(new Error(message), { status, body: { code, message, details, hint: null } });
}

function buildWhere(params, values) {
  const clauses = [];
  for (const [key, raw] of params) {
    if (RESERVED.has(key)) continue;
    const col = ident(key);
    const dot = raw.indexOf(".");
    let op = raw.slice(0, dot);
    let val = raw.slice(dot + 1);
    let negate = false;
    if (op === "not") {
      negate = true;
      const d2 = val.indexOf(".");
      op = val.slice(0, d2);
      val = val.slice(d2 + 1);
    }
    let sql;
    if (op in OPS) {
      values.push(val);
      sql = `${col}::text ${OPS[op]} $${values.length}::text`;
      if (op !== "eq" && op !== "neq") sql = `${col} ${OPS[op]} $${values.length}`;
    } else if (op === "in") {
      const items = val.replace(/^\(|\)$/g, "").split(",").filter(Boolean)
        .map((s) => s.replace(/^"|"$/g, ""));
      values.push(items);
      sql = `${col}::text = any($${values.length}::text[])`;
    } else if (op === "is") {
      const v = { null: "null", true: "true", false: "false" }[val];
      if (!v) throw httpError(400, "PGRST100", `bad is value: ${val}`);
      sql = `${col} is ${v}`;
    } else {
      throw httpError(400, "PGRST100", `unsupported operator: ${op}`);
    }
    clauses.push(negate ? `not (${sql})` : sql);
  }
  return clauses.length ? ` where ${clauses.join(" and ")}` : "";
}

function buildOrder(params) {
  const order = params.get("order");
  if (!order) return "";
  const parts = order.split(",").map((p) => {
    const [c, dir = "asc", nulls] = p.split(".");
    const d = dir === "desc" ? "desc" : "asc";
    const n = nulls === "nullsfirst" ? " nulls first" : nulls === "nullslast" ? " nulls last" : "";
    return `${ident(c)} ${d}${n}`;
  });
  return ` order by ${parts.join(", ")}`;
}

function encodeValue(table, col, value) {
  const type = columnTypes[table]?.[col];
  if ((type === "jsonb" || type === "json") && value !== null) return JSON.stringify(value);
  return value;
}

async function handle(req, res, body) {
  const url = new URL(req.url, "http://local");
  const auth = req.headers["apikey"] ?? (req.headers["authorization"] || "").replace(/^Bearer /, "");
  if (auth !== ANON_KEY) throw httpError(401, "PGRST301", "Invalid API key");

  const m = url.pathname.match(/^\/rest\/v1\/([a-z_]+)$/);
  if (!m) throw httpError(404, "PGRST125", `not found: ${url.pathname}`);
  const table = m[1];
  if (!columnTypes[table]) throw httpError(404, "42P01", `relation "public.${table}" does not exist`);

  const params = url.searchParams;
  const sel = params.get("select") ?? "*";
  if (sel !== "*" && !sel.split(",").every((c) => IDENT.test(c))) {
    throw httpError(400, "PGRST100", "only select=* or plain column lists are supported");
  }
  const columns = sel === "*" ? "*" : sel.split(",").map(ident).join(", ");
  const values = [];
  const t = `public.${ident(table)}`;
  const returning = (req.headers["prefer"] || "").includes("return=representation");
  let sql;

  if (req.method === "GET" || req.method === "HEAD") {
    sql = `select ${columns} from ${t}${buildWhere(params, values)}${buildOrder(params)}`;
    if (params.get("limit")) sql += ` limit ${parseInt(params.get("limit"), 10)}`;
    if (params.get("offset")) sql += ` offset ${parseInt(params.get("offset"), 10)}`;
  } else if (req.method === "POST") {
    const rows = Array.isArray(body) ? body : [body];
    const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    const tuples = rows.map((r) =>
      `(${cols.map((c) => {
        if (!(c in r)) return "default";
        values.push(encodeValue(table, c, r[c]));
        return `$${values.length}`;
      }).join(", ")})`
    );
    sql = cols.length
      ? `insert into ${t} (${cols.map(ident).join(", ")}) values ${tuples.join(", ")}`
      : `insert into ${t} default values`;
    sql += ` returning ${returning ? columns : "1"}`;
  } else if (req.method === "PATCH") {
    const sets = Object.entries(body).map(([c, v]) => {
      values.push(encodeValue(table, c, v));
      return `${ident(c)} = $${values.length}`;
    });
    if (!sets.length) throw httpError(400, "PGRST100", "empty patch");
    sql = `update ${t} set ${sets.join(", ")}${buildWhere(params, values)} returning ${returning ? columns : "1"}`;
  } else if (req.method === "DELETE") {
    sql = `delete from ${t}${buildWhere(params, values)} returning ${returning ? columns : "1"}`;
  } else {
    throw httpError(405, "PGRST117", "method not allowed");
  }

  const client = await pool.connect();
  let rows;
  try {
    await client.query("begin");
    await client.query("set local role anon");
    rows = (await client.query(sql, values)).rows;
    await client.query("commit");
  } catch (e) {
    await client.query("rollback").catch(() => {});
    if (e.status) throw e;
    throw httpError(e.code === "42501" ? 401 : 400, e.code ?? "XX000", e.message, e.detail ?? null);
  } finally {
    client.release();
  }

  const wantsObject = (req.headers["accept"] || "").includes("vnd.pgrst.object");
  const isWrite = req.method !== "GET" && req.method !== "HEAD";
  if (isWrite && !returning) {
    res.writeHead(204).end();
    return;
  }
  if (wantsObject) {
    if (rows.length !== 1) {
      throw httpError(406, "PGRST116", "JSON object requested, multiple (or no) rows returned",
        `The result contains ${rows.length} rows`);
    }
    send(res, isWrite ? 201 : 200, rows[0]);
    return;
  }
  send(res, req.method === "POST" ? 201 : 200, rows);
}

function send(res, status, data) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

await loadColumns();
http
  .createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", async () => {
      try {
        if (req.method === "POST" && req.url === "/__reload") {
          await loadColumns();
          return send(res, 200, { ok: true });
        }
        await handle(req, res, raw ? JSON.parse(raw) : {});
      } catch (e) {
        const status = e.status ?? 500;
        send(res, status, e.body ?? { code: "XX000", message: String(e.message ?? e), details: null, hint: null });
      }
    });
  })
  .listen(Number(PORT), () => console.log(`local supabase REST on http://localhost:${PORT}/rest/v1`));
