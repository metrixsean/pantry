import { apiGroup, query, input, s, inp, ref, auth, col, cmp, expr, guard } from "@xano/sdk";
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
  input: { location_id: input.int() },
  stack: [
    ...callerHousehold(),
    s.db.query({
      table: item,
      bind: [{ table: location, as: "loc", where: expr(col("location_id"), "=", col("loc.id")) }],
      where: [
        expr(col("loc.household_id"), "=", ref("me.household_id")),
        cmp(col("location_id"), "=", inp("location_id"), { ignoreEmpty: true }),
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
