// Minimal in-memory stand in for the supabase-js query builder, enough for the
// trust webhook and admin action code paths. Not a general mock: only the
// methods those modules call are implemented, and unique constraints are
// declared per table so duplicate inserts fail with 23505 like Postgres.

type Row = Record<string, any>;
type Filter = (r: Row) => boolean;

export class FakeDb {
  tables: Record<string, Row[]> = {};
  unique: Record<string, string[]> = {
    tips: ["id", "stripe_session_id"],
    stripe_webhook_events: ["event_id"],
    creator_trust: ["creator_profile_id"],
  };
  private seq = 0;
  constructor(seed: Record<string, Row[]> = {}) {
    for (const [k, v] of Object.entries(seed)) this.tables[k] = v.map((r) => ({ ...r }));
  }
  rows(t: string) { return (this.tables[t] ??= []); }
  nextId() { this.seq += 1; return `00000000-0000-4000-8000-${String(this.seq).padStart(12, "0")}`; }
  from(t: string) { return new FakeQuery(this, t); }
}

class FakeQuery implements PromiseLike<any> {
  private op: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private filters: Filter[] = [];
  private payload: any;
  private conflict: string | null = null;
  private returning = false;
  private mode: "many" | "single" | "maybe" = "many";
  private head = false;
  private wantCount = false;
  private limitN: number | null = null;
  constructor(private db: FakeDb, private table: string) {}

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (this.op === "select") { this.head = !!opts?.head; this.wantCount = !!opts?.count; }
    else this.returning = true;
    return this;
  }
  insert(p: any) { this.op = "insert"; this.payload = p; return this; }
  update(p: any) { this.op = "update"; this.payload = p; return this; }
  upsert(p: any, o?: { onConflict?: string }) { this.op = "upsert"; this.payload = p; this.conflict = o?.onConflict ?? "id"; return this; }
  delete() { this.op = "delete"; return this; }
  eq(c: string, v: any) { this.filters.push((r) => r[c] === v); return this; }
  neq(c: string, v: any) { this.filters.push((r) => r[c] !== v); return this; }
  in(c: string, v: any[]) { this.filters.push((r) => v.includes(r[c])); return this; }
  is(c: string, v: any) { this.filters.push((r) => (v === null ? r[c] == null : r[c] === v)); return this; }
  not(c: string, _op: string, v: any) { this.filters.push((r) => (v === null ? r[c] != null : r[c] !== v)); return this; }
  gte(c: string, v: any) { this.filters.push((r) => r[c] != null && r[c] >= v); return this; }
  lte(c: string, v: any) { this.filters.push((r) => r[c] != null && r[c] <= v); return this; }
  or(_expr: string) { return this; }
  order() { return this; }
  limit(n: number) { this.limitN = n; return this; }
  maybeSingle() { this.mode = "maybe"; return this; }
  single() { this.mode = "single"; return this; }

  private match(r: Row) { return this.filters.every((f) => f(r)); }

  private uniqueViolation(row: Row, ignore?: Row) {
    for (const col of this.db.unique[this.table] ?? []) {
      if (row[col] == null) continue;
      if (this.db.rows(this.table).some((r) => r !== ignore && r[col] === row[col])) return true;
    }
    return false;
  }

  private shape(rows: Row[]) {
    if (this.mode === "many") return { data: rows, error: null };
    if (this.mode === "single" && rows.length !== 1) return { data: null, error: { code: "PGRST116", message: "not single" } };
    return { data: rows[0] ?? null, error: null };
  }

  private exec(): any {
    const t = this.db.rows(this.table);
    if (this.op === "select") {
      let rows = t.filter((r) => this.match(r));
      if (this.limitN !== null) rows = rows.slice(0, this.limitN);
      if (this.head) return { data: null, count: rows.length, error: null };
      return { ...this.shape(rows.map((r) => ({ ...r }))), count: this.wantCount ? rows.length : null };
    }
    if (this.op === "insert") {
      const list = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((r: Row) => ({ id: this.db.nextId(), created_at: new Date().toISOString(), ...r }));
      for (const r of list) if (this.uniqueViolation(r)) return { data: null, error: { code: "23505", message: "duplicate key" } };
      t.push(...list);
      return this.returning ? this.shape(list.map((r: Row) => ({ ...r }))) : { data: null, error: null };
    }
    if (this.op === "update") {
      const hit = t.filter((r) => this.match(r));
      for (const r of hit) Object.assign(r, this.payload);
      return this.returning ? this.shape(hit.map((r) => ({ ...r }))) : { data: null, error: null };
    }
    if (this.op === "upsert") {
      const key = this.conflict!;
      const existing = t.find((r) => r[key] === this.payload[key]);
      if (existing) Object.assign(existing, this.payload);
      else t.push({ ...this.payload });
      return { data: null, error: null };
    }
    const keep = t.filter((r) => !this.match(r));
    this.db.tables[this.table] = keep;
    return { data: null, error: null };
  }

  then<A, B>(ok?: ((v: any) => A | PromiseLike<A>) | null, bad?: ((e: any) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    try { return Promise.resolve(this.exec()).then(ok, bad); } catch (e) { return Promise.reject(e).then(ok, bad); }
  }
}
