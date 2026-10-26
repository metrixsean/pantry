import { apiGroup, query, c, input, s, fl, inp, ref, auth, col, cmp, expr, guard, statements, withFilters } from "@xano/sdk";
import { item } from "../tables/item.js";
import { location } from "../tables/location.js";
import { user } from "../tables/user.js";
import { callerHousehold } from "./caller.js";

export const itemsApi = apiGroup({ name: "items", canonical: "items" });

export const listItems = query({
  name: "list_items",
  verb: "GET",
  apiGroup: itemsApi,
  auth: user,
  input: { location_id: input.int(), expiring_within: input.int() },
  stack: [
    ...callerHousehold(),
    s.set_var("cutoff", c.null()),
    s.conditional({
      when: expr(inp("expiring_within"), "!=", c.null()),
      then: [
        s.update_var(
          "cutoff",
          withFilters(
            c.now(),
            fl.epochms_add_secs(withFilters(inp("expiring_within"), fl.mul(86400))),
            fl.epochms_date("Y-m-d", "UTC"),
          ),
        ),
      ],
    }),
    s.db.query({
      table: item,
      bind: [{ table: location, as: "loc", where: expr(col("location_id"), "=", col("loc.id")) }],
      where: [
        expr(col("loc.household_id"), "=", ref("me.household_id")),
        cmp(col("location_id"), "=", inp("location_id"), { ignoreEmpty: true }),
        cmp(col("expires_on"), "<=", ref("cutoff"), { ignoreEmpty: true }),
      ],
      sort: [{ sortBy: "expires_on", dir: "asc" }],
      as: "rows",
    }),
  ],
  response: ref("rows"),
});

export const createItem = query({
  name: "create_item",
  verb: "POST",
  apiGroup: itemsApi,
  auth: user,
  input: {
    name: input.text({ required: true }),
    location_id: input.int({ required: true }),
    quantity: input.decimal({ required: true }),
    unit: input.text(),
    expires_on: input.date(),
  },
  stack: [
    ...callerHousehold(),
    s.db.get({ table: location, fieldValue: inp("location_id"), as: "loc" }),
    guard.found("loc", { message: "no such location" }),
    guard.require(expr(ref("loc.household_id"), "=", ref("me.household_id")), {
      errorType: "notfound",
      message: "no such location",
    }),
    s.db.add({
      table: item,
      row: {
        name: inp("name"),
        location_id: inp("location_id"),
        quantity: inp("quantity"),
        unit: inp("unit"),
        expires_on: inp("expires_on"),
        added_by: auth("id"),
      },
      as: "created",
    }),
  ],
  response: ref("created"),
});

export const listLocations = query({
  name: "list_locations",
  verb: "GET",
  apiGroup: itemsApi,
  auth: user,
  stack: [
    ...callerHousehold(),
    s.db.query({
      table: location,
      where: cmp(col("household_id"), "=", ref("me.household_id")),
      sort: [{ sortBy: "name", dir: "asc" }],
      as: "rows",
    }),
  ],
  response: ref("rows"),
});

const ownLocation = (id: Parameters<typeof s.db.get>[0]["fieldValue"], as: string) =>
  statements(
    s.db.get({ table: location, fieldValue: id, as }),
    guard.found(as, { message: "no such location" }),
    guard.require(expr(ref(`${as}.household_id`), "=", ref("me.household_id")), {
      errorType: "notfound",
      message: "no such location",
    }),
  );

const ownItem = () =>
  statements(
    s.db.get({ table: item, fieldValue: inp("id"), as: "row" }),
    guard.found("row", { message: "no such item" }),
    ...ownLocation(ref("row.location_id"), "row_loc"),
  );

export const updateItem = query({
  name: "items/{id}",
  verb: "PATCH",
  apiGroup: itemsApi,
  auth: user,
  input: {
    id: input.int({ required: true }),
    name: input.text({ nullable: true, methods: ["trim"] }),
    location_id: input.int({ nullable: true }),
    quantity: input.decimal({ nullable: true }),
    unit: input.text({ nullable: true }),
    expires_on: input.date({ nullable: true }),
  },
  stack: [
    ...callerHousehold(),
    ...ownItem(),
    ...ownLocation(withFilters(inp("location_id"), fl.first_notnull(ref("row.location_id"))), "loc"),
    s.db.edit({
      table: item,
      fieldValue: inp("id"),
      row: {
        name: withFilters(inp("name"), fl.first_notnull(ref("row.name"))),
        location_id: ref("loc.id"),
        quantity: withFilters(inp("quantity"), fl.first_notnull(ref("row.quantity"))),
        unit: withFilters(inp("unit"), fl.first_notnull(ref("row.unit"))),
        expires_on: withFilters(inp("expires_on"), fl.first_notnull(ref("row.expires_on"))),
      },
      as: "updated",
    }),
  ],
  response: ref("updated"),
});

export const deleteItem = query({
  name: "items/{id}",
  verb: "DELETE",
  apiGroup: itemsApi,
  auth: user,
  input: { id: input.int({ required: true }) },
  stack: [...callerHousehold(), ...ownItem(), s.db.del({ table: item, fieldValue: inp("id") })],
  response: ref("row"),
});
