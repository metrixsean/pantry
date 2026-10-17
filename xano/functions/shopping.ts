import { defineFunction, input, s, c, fl, inp, ref, col, expr, guard, withFilters } from "@xano/sdk";
import { location } from "../tables/location.js";
import { item } from "../tables/item.js";
import { shoppingEntry } from "../tables/shopping_entry.js";

export const restockEntry = defineFunction({
  name: "restock_entry",
  description:
    "Ticks off a shopping entry and puts it back in stock: tops up the item with the same name in that location, or adds a new one.",
  input: {
    entry_id: input.int({ required: true }),
    user_id: input.int({ required: true }),
    location_id: input.int({ required: true }),
    expires_on: input.date({ nullable: true }),
    quantity: input.decimal({ nullable: true }),
    unit: input.text({ nullable: true }),
  },
  stack: [
    s.db.get({ table: shoppingEntry, fieldValue: inp("entry_id"), as: "entry" }),
    guard.found("entry", { message: "no such shopping entry" }),
    guard.require(expr(ref("entry.done"), "=", c.bool(false)), {
      errorType: "badrequest",
      message: "already restocked",
    }),
    s.db.get({ table: location, fieldValue: inp("location_id"), as: "loc" }),
    guard.found("loc", { message: "no such location" }),
    guard.require(expr(ref("loc.household_id"), "=", ref("entry.household_id")), {
      errorType: "notfound",
      message: "no such location",
    }),
    s.set_var(
      "qty",
      withFilters(inp("quantity"), fl.first_notnull(ref("entry.quantity")), fl.first_notnull(c.decimal(1))),
    ),
    s.db.query({
      table: item,
      where: [expr(col("location_id"), "=", inp("location_id")), expr(col("name"), "=", ref("entry.name"))],
      returnType: "single",
      as: "existing",
    }),
    s.db.transaction({
      body: [
        s.conditional({
          when: expr(ref("existing"), "!=", c.null()),
          then: [
            s.db.edit({
              table: item,
              fieldValue: ref("existing.id"),
              row: {
                quantity: withFilters(ref("existing.quantity"), fl.add(ref("qty"))),
                unit: withFilters(inp("unit"), fl.first_notnull(ref("existing.unit"))),
                expires_on: inp("expires_on"),
                expiring: false,
              },
              as: "stocked",
            }),
          ],
          else: [
            s.db.add({
              table: item,
              row: {
                name: ref("entry.name"),
                location_id: inp("location_id"),
                quantity: ref("qty"),
                unit: inp("unit"),
                expires_on: inp("expires_on"),
                added_by: inp("user_id"),
              },
              as: "stocked",
            }),
          ],
        }),
        s.db.edit({
          table: shoppingEntry,
          fieldValue: inp("entry_id"),
          row: { done: true, done_by: inp("user_id") },
        }),
      ],
    }),
  ],
  response: ref("stocked"),
});
