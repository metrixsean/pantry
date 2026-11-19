import { workflowTest, s, c, ref } from "@xano/sdk";
import { household } from "../tables/household.js";
import { location } from "../tables/location.js";
import { item } from "../tables/item.js";
import { consumeItem } from "../functions/items.js";

export const consumeBottomsOutAtZero = workflowTest({
  name: "consuming an item counts down and stops at zero",
  stack: [
    s.db.add({ table: household, row: { name: "snack house", invite_code: "wf-snack" }, as: "house" }),
    s.db.add({ table: location, row: { name: "pantry", household_id: ref("house.id") }, as: "pantry" }),
    s.db.add({
      table: item,
      row: { name: "biscuits", location_id: ref("pantry.id"), quantity: 3, unit: "packs" },
      as: "biscuits",
    }),

    s.function.call({ fn: consumeItem, input: { item_id: ref("biscuits.id") }, as: "one_down" }),
    s.expect.to_equal({ expr: ref("one_down.quantity"), value: c.decimal(2) }),

    s.function.call({
      fn: consumeItem,
      input: { item_id: ref("biscuits.id"), amount: c.decimal(0.5) },
      as: "half_down",
    }),
    s.expect.to_equal({ expr: ref("half_down.quantity"), value: c.decimal(1.5) }),

    s.function.call({
      fn: consumeItem,
      input: { item_id: ref("biscuits.id"), amount: c.decimal(10) },
      as: "all_gone",
    }),
    s.expect.to_equal({ expr: ref("all_gone.quantity"), value: c.decimal(0) }),
    s.expect.to_equal({ expr: ref("all_gone.unit"), value: c.text("packs") }),

    s.expect.to_throw({
      body: [
        s.db.add({ table: household, row: { name: "empty house", invite_code: "wf-empty" }, as: "h" }),
        s.db.add({ table: location, row: { name: "pantry", household_id: ref("h.id") }, as: "spot" }),
        s.db.add({ table: item, row: { name: "crisps", location_id: ref("spot.id"), quantity: 0 }, as: "crisps" }),
        s.function.call({ fn: consumeItem, input: { item_id: ref("crisps.id") } }),
      ],
      exception: c.text("there's none left"),
    }),
    s.expect.to_throw({
      body: [
        s.db.add({ table: household, row: { name: "neg house", invite_code: "wf-neg" }, as: "h" }),
        s.db.add({ table: location, row: { name: "fridge", household_id: ref("h.id") }, as: "spot" }),
        s.db.add({ table: item, row: { name: "milk", location_id: ref("spot.id"), quantity: 1 }, as: "milk" }),
        s.function.call({ fn: consumeItem, input: { item_id: ref("milk.id"), amount: c.decimal(-2) } }),
      ],
      exception: c.text("eat a positive amount"),
    }),
  ],
});
