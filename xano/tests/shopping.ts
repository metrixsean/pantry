import { workflowTest, s, c, ref } from "@xano/sdk";
import { household } from "../tables/household.js";
import { location } from "../tables/location.js";
import { user } from "../tables/user.js";
import { item } from "../tables/item.js";
import { shoppingEntry } from "../tables/shopping_entry.js";
import { restockEntry } from "../functions/shopping.js";

export const restockTopsUpOrAdds = workflowTest({
  name: "restock tops up an existing item or adds a new one",
  stack: [
    s.db.add({ table: household, row: { name: "restock house", invite_code: "wf-restock" }, as: "house" }),
    s.db.add({
      table: user,
      row: { name: "jo", email: "jo@example.com", password: "pickled-onions", household_id: ref("house.id") },
      as: "jo",
    }),
    s.db.add({ table: location, row: { name: "fridge", household_id: ref("house.id") }, as: "fridge" }),
    s.db.add({
      table: item,
      row: { name: "milk", location_id: ref("fridge.id"), quantity: 0, unit: "l", expiring: true },
      as: "milk",
    }),
    s.db.add({
      table: shoppingEntry,
      row: { name: "milk", quantity: 2, household_id: ref("house.id") },
      as: "buy_milk",
    }),
    s.db.add({ table: shoppingEntry, row: { name: "eggs", household_id: ref("house.id") }, as: "buy_eggs" }),

    s.function.call({
      fn: restockEntry,
      input: {
        entry_id: ref("buy_milk.id"),
        user_id: ref("jo.id"),
        location_id: ref("fridge.id"),
        expires_on: c.text("2026-11-01"),
      },
      as: "restocked",
    }),
    s.expect.to_equal({ expr: ref("restocked.id"), value: ref("milk.id") }),
    s.expect.to_equal({ expr: ref("restocked.quantity"), value: c.decimal(2) }),
    s.expect.to_equal({ expr: ref("restocked.unit"), value: c.text("l") }),
    s.expect.to_be_false({ expr: ref("restocked.expiring") }),
    s.db.get({ table: shoppingEntry, fieldValue: ref("buy_milk.id"), as: "milk_after" }),
    s.expect.to_be_true({ expr: ref("milk_after.done") }),
    s.expect.to_equal({ expr: ref("milk_after.done_by"), value: ref("jo.id") }),

    s.expect.to_throw({
      body: [
        s.db.add({ table: household, row: { name: "done house", invite_code: "wf-done" }, as: "h" }),
        s.db.add({ table: location, row: { name: "pantry", household_id: ref("h.id") }, as: "spot" }),
        s.db.add({ table: shoppingEntry, row: { name: "rice", household_id: ref("h.id"), done: true }, as: "entry" }),
        s.function.call({
          fn: restockEntry,
          input: { entry_id: ref("entry.id"), user_id: c.int(1), location_id: ref("spot.id") },
        }),
      ],
      exception: c.text("already restocked"),
    }),
    s.expect.to_throw({
      body: [
        s.db.add({ table: household, row: { name: "mine", invite_code: "wf-mine" }, as: "mine" }),
        s.db.add({ table: household, row: { name: "theirs", invite_code: "wf-theirs" }, as: "theirs" }),
        s.db.add({ table: location, row: { name: "their fridge", household_id: ref("theirs.id") }, as: "spot" }),
        s.db.add({ table: shoppingEntry, row: { name: "eggs", household_id: ref("mine.id") }, as: "entry" }),
        s.function.call({
          fn: restockEntry,
          input: { entry_id: ref("entry.id"), user_id: c.int(1), location_id: ref("spot.id") },
        }),
      ],
      exception: c.text("no such location"),
    }),

    s.function.call({
      fn: restockEntry,
      input: {
        entry_id: ref("buy_eggs.id"),
        user_id: ref("jo.id"),
        location_id: ref("fridge.id"),
        quantity: c.decimal(6),
        expires_on: c.text("2026-10-30"),
      },
      as: "eggs",
    }),
    s.expect.to_equal({ expr: ref("eggs.name"), value: c.text("eggs") }),
    s.expect.to_equal({ expr: ref("eggs.quantity"), value: c.decimal(6) }),
    s.expect.to_equal({ expr: ref("eggs.location_id"), value: ref("fridge.id") }),
  ],
});
