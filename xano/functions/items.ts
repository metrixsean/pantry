import { defineFunction, input, s, c, fl, inp, ref, expr, guard, withFilters } from "@xano/sdk";
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
