import { defineFunction, input, s, c, fl, inp, ref, expr, guard, statements, withFilters } from "@xano/sdk";
import { item } from "../tables/item.js";
import { location } from "../tables/location.js";
import { listIfMissing } from "./shopping.js";

export const consumeItem = defineFunction({
  name: "consume_item",
  description:
    "Uses some of an item up. Quantity bottoms out at zero, and the moment it gets there the item goes on the household's shopping list.",
  input: {
    item_id: input.int({ required: true }),
    amount: input.decimal({ nullable: true }),
  },
  stack: [
    s.set_var("amount", withFilters(inp("amount"), fl.first_notnull(c.decimal(1)))),
    guard.require(expr(ref("amount"), ">", c.decimal(0)), {
      errorType: "inputerror",
      message: "eat a positive amount",
    }),
    s.db.get({ table: item, fieldValue: inp("item_id"), as: "row" }),
    guard.found("row", { message: "no such item" }),
    guard.require(expr(ref("row.quantity"), ">", c.decimal(0)), {
      errorType: "badrequest",
      message: "there's none left",
    }),
    s.db.get({ table: location, fieldValue: ref("row.location_id"), as: "loc" }),
    s.set_var("listed", c.bool(false)),
    s.db.transaction({
      body: [
        s.db.edit({
          table: item,
          fieldValue: inp("item_id"),
          row: { quantity: withFilters(ref("row.quantity"), fl.sub(ref("amount")), fl.clamp_min(0)) },
          as: "updated",
        }),
        s.conditional({
          when: expr(ref("updated.quantity"), "<=", c.decimal(0)),
          then: [
            s.function.run({
              fn: listIfMissing,
              input: { household_id: ref("loc.household_id"), name: ref("row.name") },
              as: "added",
            }),
            s.update_var("listed", ref("added.listed")),
          ],
        }),
      ],
    }),
  ],
  response: { item: ref("updated"), listed: ref("listed") },
});

const ownLocation = (id: Parameters<typeof s.db.get>[0]["fieldValue"], as: string) =>
  statements(
    s.db.get({ table: location, fieldValue: id, as }),
    guard.found(as, { message: "no such location" }),
    guard.require(expr(ref(`${as}.household_id`), "=", inp("household_id")), {
      errorType: "notfound",
      message: "no such location",
    }),
  );

export const editItem = defineFunction({
  name: "edit_item",
  description:
    "Edits a household's item. A null input keeps the old value, clear_expiry wipes the expiry date, and dropping to zero puts it on the shopping list.",
  input: {
    item_id: input.int({ required: true }),
    household_id: input.int({ required: true }),
    name: input.text({ nullable: true, methods: ["trim"] }),
    location_id: input.int({ nullable: true }),
    quantity: input.decimal({ nullable: true }),
    unit: input.text({ nullable: true }),
    expires_on: input.date({ nullable: true }),
    clear_expiry: input.bool(),
  },
  stack: [
    guard.require(expr(inp("name"), "!=", c.text("")), { errorType: "inputerror", message: "name it something" }),
    s.db.get({ table: item, fieldValue: inp("item_id"), as: "row" }),
    guard.found("row", { message: "no such item" }),
    ...ownLocation(ref("row.location_id"), "row_loc"),
    ...ownLocation(withFilters(inp("location_id"), fl.first_notnull(ref("row.location_id"))), "loc"),
    s.set_var("expires_on", withFilters(inp("expires_on"), fl.first_notnull(ref("row.expires_on")))),
    s.set_var("expiring", ref("row.expiring")),
    s.conditional({
      when: expr(inp("clear_expiry"), "=", c.bool(true)),
      then: [s.update_var("expires_on", c.null()), s.update_var("expiring", c.bool(false))],
    }),
    s.db.transaction({
      body: [
        s.db.edit({
          table: item,
          fieldValue: inp("item_id"),
          row: {
            name: withFilters(inp("name"), fl.first_notnull(ref("row.name"))),
            location_id: ref("loc.id"),
            quantity: withFilters(inp("quantity"), fl.first_notnull(ref("row.quantity"))),
            unit: withFilters(inp("unit"), fl.first_notnull(ref("row.unit"))),
            expires_on: ref("expires_on"),
            expiring: ref("expiring"),
          },
          as: "updated",
        }),
        s.conditional({
          when: expr(ref("updated.quantity"), "<=", c.decimal(0)),
          then: [
            s.function.run({
              fn: listIfMissing,
              input: { household_id: inp("household_id"), name: ref("updated.name") },
            }),
          ],
        }),
      ],
    }),
  ],
  response: ref("updated"),
});
