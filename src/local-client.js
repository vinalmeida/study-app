// Cliente do banco local. Expõe a mesma interface de consulta usada pelo app
// (from/select/eq/order/insert/update/delete) e a envia ao servidor em server/index.js.
const endpoint = "/api/query";

const splitColumns = (columns) =>
  String(columns || "").split(",").map((column) => column.trim()).filter(Boolean);

class LocalQuery {
  constructor(table) {
    this.query = { table, op: "select", columns: null, values: null, filters: [], orders: [], returning: false };
  }

  select(columns) {
    this.query.columns = columns ? splitColumns(columns) : null;
    if (this.query.op !== "select") this.query.returning = true;
    return this;
  }

  insert(values) {
    this.query.op = "insert";
    this.query.values = values;
    return this;
  }

  update(values) {
    this.query.op = "update";
    this.query.values = values;
    return this;
  }

  delete() {
    this.query.op = "delete";
    return this;
  }

  eq(col, val) {
    this.query.filters.push({ col, val });
    return this;
  }

  order(col, { ascending = true } = {}) {
    this.query.orders.push({ col, asc: ascending });
    return this;
  }

  async run() {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(this.query),
      });
      return await response.json();
    } catch (error) {
      return { data: null, error: { code: "NETWORK", message: error.message } };
    }
  }

  then(resolve, reject) {
    return this.run().then(resolve, reject);
  }
}

export function createLocalClient() {
  return { from: (table) => new LocalQuery(table) };
}
