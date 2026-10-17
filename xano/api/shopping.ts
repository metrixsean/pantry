import {
  apiGroup,
  query,
  input,
  s,
  c,
  fl,
  inp,
  ref,
  auth,
  col,
  cmp,
  expr,
  guard,
  statements,
  withFilters,
} from "@xano/sdk";
import { shoppingEntry } from "../tables/shopping_entry.js";
import { user } from "../tables/user.js";
import { restockEntry } from "../functions/shopping.js";
import { callerHousehold } from "./caller.js";

export const shoppingApi = apiGroup({ name: "shopping", canonical: "shopping" });

const ownEntry = () =>
  statements(
    s.db.get({ table: shoppingEntry, fieldValue: inp("id"), as: "entry" }),
    guard.found("entry", { message: "no such shopping entry" }),
    guard.require(expr(ref("entry.household_id"), "=", ref("me.household_id")), {
      errorType: "notfound",
      message: "no such shopping entry",
    }),
  );

export const listShopping = query({
  name: "shopping",
  verb: "GET",
  apiGroup: shoppingApi,
  auth: user,
  stack: [
    ...callerHousehold(),
    s.db.query({
      table: shoppingEntry,
      where: cmp(col("household_id"), "=", ref("me.household_id")),
      sort: [
        { sortBy: "done", dir: "asc" },
        { sortBy: "created_at", dir: "desc" },
      ],
      paging: { per_page: 200, metadata: false },
      as: "rows",
    }),
  ],
  response: ref("rows"),
});

export const addShopping = query({
  name: "shopping",
  verb: "POST",
  apiGroup: shoppingApi,
  auth: user,
  input: {
    name: input.text({ required: true, methods: ["trim", "min:1"] }),
    quantity: input.decimal({ nullable: true }),
  },
  stack: [
    ...callerHousehold(),
    s.db.add({
      table: shoppingEntry,
      row: { name: inp("name"), quantity: inp("quantity"), household_id: ref("me.household_id") },
      as: "created",
    }),
  ],
  response: ref("created"),
});

export const updateShopping = query({
  name: "shopping/{id}",
  verb: "PATCH",
  apiGroup: shoppingApi,
  auth: user,
  input: {
    id: input.int({ required: true }),
    name: input.text({ nullable: true, methods: ["trim"] }),
    quantity: input.decimal({ nullable: true }),
    done: input.bool({ nullable: true }),
  },
  stack: [
    ...callerHousehold(),
    ...ownEntry(),
    s.set_var("done", withFilters(inp("done"), fl.first_notnull(ref("entry.done")))),
    s.set_var("done_by", c.null()),
    s.conditional({
      when: expr(ref("done"), "=", c.bool(true)),
      then: [s.update_var("done_by", withFilters(ref("entry.done_by"), fl.first_notnull(auth("id"))))],
    }),
    s.db.edit({
      table: shoppingEntry,
      fieldValue: inp("id"),
      row: {
        name: withFilters(inp("name"), fl.first_notnull(ref("entry.name"))),
        quantity: withFilters(inp("quantity"), fl.first_notnull(ref("entry.quantity"))),
        done: ref("done"),
        done_by: ref("done_by"),
      },
      as: "updated",
    }),
  ],
  response: ref("updated"),
});

export const restockShopping = query({
  name: "shopping/{id}/restock",
  verb: "POST",
  apiGroup: shoppingApi,
  auth: user,
  input: {
    id: input.int({ required: true }),
    location_id: input.int({ required: true }),
    expires_on: input.date({ nullable: true }),
    quantity: input.decimal({ nullable: true }),
    unit: input.text({ nullable: true }),
  },
  stack: [
    ...callerHousehold(),
    ...ownEntry(),
    s.function.run({
      fn: restockEntry,
      input: {
        entry_id: inp("id"),
        user_id: auth("id"),
        location_id: inp("location_id"),
        expires_on: inp("expires_on"),
        quantity: inp("quantity"),
        unit: inp("unit"),
      },
      as: "item",
    }),
  ],
  response: ref("item"),
});
