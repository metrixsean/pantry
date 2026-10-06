import { apiGroup, query, input, s, inp, ref, col, cmp } from "@xano/sdk";
import { item } from "../tables/item.js";
import { location } from "../tables/location.js";

export const itemsApi = apiGroup({ name: "items", canonical: "items" });

export const listItems = query({
  name: "list_items",
  verb: "GET",
  apiGroup: itemsApi,
  input: { location_id: input.int() },
  stack: [
    s.db.query({
      table: item,
      where: cmp(col("location_id"), "=", inp("location_id"), { ignoreEmpty: true }),
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
  input: {
    name: input.text({ required: true }),
    location_id: input.int({ required: true }),
    quantity: input.decimal({ required: true }),
    unit: input.text(),
    expires_on: input.date(),
  },
  stack: [
    s.db.add({
      table: item,
      row: {
        name: inp("name"),
        location_id: inp("location_id"),
        quantity: inp("quantity"),
        unit: inp("unit"),
        expires_on: inp("expires_on"),
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
  stack: [s.db.query({ table: location, sort: [{ sortBy: "name", dir: "asc" }], as: "rows" })],
  response: ref("rows"),
});
