import { workflowTest, s, c, fl, ref, col, expr, withFilters } from "@xano/sdk";
import { household } from "../tables/household.js";
import { location } from "../tables/location.js";
import { item } from "../tables/item.js";
import { shoppingEntry } from "../tables/shopping_entry.js";
import { consumeItem, editItem } from "../functions/items.js";

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
    s.expect.to_equal({ expr: ref("one_down.item.quantity"), value: c.decimal(2) }),
    s.expect.to_be_false({ expr: ref("one_down.listed") }),

    s.function.call({
      fn: consumeItem,
      input: { item_id: ref("biscuits.id"), amount: c.decimal(0.5) },
      as: "half_down",
    }),
    s.expect.to_equal({ expr: ref("half_down.item.quantity"), value: c.decimal(1.5) }),

    s.function.call({
      fn: consumeItem,
      input: { item_id: ref("biscuits.id"), amount: c.decimal(10) },
      as: "all_gone",
    }),
    s.expect.to_equal({ expr: ref("all_gone.item.quantity"), value: c.decimal(0) }),
    s.expect.to_equal({ expr: ref("all_gone.item.unit"), value: c.text("packs") }),

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

const openEntries = (name: string, as: string) =>
  s.db.query({
    table: shoppingEntry,
    where: [
      expr(col("household_id"), "=", ref("house.id")),
      expr(col("name"), "=", c.text(name)),
      expr(col("done"), "=", c.bool(false)),
    ],
    as,
  });

export const consumeListsEmptiesRightAway = workflowTest({
  name: "eating the last one puts it on the shopping list straight away",
  stack: [
    s.db.add({ table: household, row: { name: "hungry house", invite_code: "wf-hungry" }, as: "house" }),
    s.db.add({ table: location, row: { name: "fridge", household_id: ref("house.id") }, as: "fridge" }),
    s.db.add({ table: location, row: { name: "garage fridge", household_id: ref("house.id") }, as: "garage" }),
    s.db.add({ table: item, row: { name: "milk", location_id: ref("fridge.id"), quantity: 2 }, as: "milk" }),
    s.db.add({ table: item, row: { name: "milk", location_id: ref("garage.id"), quantity: 1 }, as: "spare" }),

    s.function.call({ fn: consumeItem, input: { item_id: ref("milk.id") }, as: "first" }),
    s.expect.to_be_false({ expr: ref("first.listed") }),
    openEntries("milk", "none_yet"),
    s.expect.to_equal({ expr: withFilters(ref("none_yet"), fl.count()), value: c.int(0) }),

    s.function.call({ fn: consumeItem, input: { item_id: ref("milk.id") }, as: "last" }),
    s.expect.to_equal({ expr: ref("last.item.quantity"), value: c.decimal(0) }),
    s.expect.to_be_true({ expr: ref("last.listed") }),
    openEntries("milk", "listed"),
    s.expect.to_equal({ expr: withFilters(ref("listed"), fl.count()), value: c.int(1) }),

    s.function.call({ fn: consumeItem, input: { item_id: ref("spare.id") }, as: "spare_gone" }),
    s.expect.to_be_false({ expr: ref("spare_gone.listed") }),
    openEntries("milk", "still_one"),
    s.expect.to_equal({ expr: withFilters(ref("still_one"), fl.count()), value: c.int(1) }),

    s.db.edit({ table: shoppingEntry, fieldValue: ref("listed.0.id"), row: { done: true } }),
    s.db.add({ table: item, row: { name: "milk", location_id: ref("fridge.id"), quantity: 1 }, as: "again" }),
    s.function.call({ fn: consumeItem, input: { item_id: ref("again.id") }, as: "again_gone" }),
    s.expect.to_be_true({ expr: ref("again_gone.listed") }),
    openEntries("milk", "relisted"),
    s.expect.to_equal({ expr: withFilters(ref("relisted"), fl.count()), value: c.int(1) }),
  ],
});

export const editItemClearsExpiry = workflowTest({
  name: "editing an item keeps what you leave out and clear_expiry means it never expires",
  stack: [
    s.db.add({ table: household, row: { name: "jam house", invite_code: "wf-jam" }, as: "house" }),
    s.db.add({ table: location, row: { name: "pantry", household_id: ref("house.id") }, as: "pantry" }),
    s.db.add({ table: location, row: { name: "fridge", household_id: ref("house.id") }, as: "fridge" }),
    s.db.add({
      table: item,
      row: {
        name: "jam",
        location_id: ref("pantry.id"),
        quantity: 2,
        unit: "jars",
        expires_on: "2026-12-01",
        expiring: true,
      },
      as: "jam",
    }),

    s.function.call({
      fn: editItem,
      input: { item_id: ref("jam.id"), household_id: ref("house.id"), location_id: ref("fridge.id") },
      as: "moved",
    }),
    s.expect.to_equal({ expr: ref("moved.location_id"), value: ref("fridge.id") }),
    s.expect.to_equal({ expr: ref("moved.name"), value: c.text("jam") }),
    s.expect.to_equal({ expr: ref("moved.quantity"), value: c.decimal(2) }),
    s.expect.to_equal({ expr: ref("moved.unit"), value: c.text("jars") }),
    s.expect.to_equal({ expr: ref("moved.expires_on"), value: c.text("2026-12-01") }),
    s.expect.to_be_true({ expr: ref("moved.expiring") }),

    s.function.call({
      fn: editItem,
      input: { item_id: ref("jam.id"), household_id: ref("house.id"), clear_expiry: c.bool(true) },
      as: "forever",
    }),
    s.expect.to_be_null({ expr: ref("forever.expires_on") }),
    s.expect.to_be_false({ expr: ref("forever.expiring") }),
    s.expect.to_equal({ expr: ref("forever.location_id"), value: ref("fridge.id") }),

    s.function.call({
      fn: editItem,
      input: {
        item_id: ref("jam.id"),
        household_id: ref("house.id"),
        expires_on: c.text("2027-01-15"),
        clear_expiry: c.bool(true),
      },
      as: "clear_wins",
    }),
    s.expect.to_be_null({ expr: ref("clear_wins.expires_on") }),

    s.function.call({
      fn: editItem,
      input: { item_id: ref("jam.id"), household_id: ref("house.id"), quantity: c.decimal(0) },
      as: "empty",
    }),
    s.expect.to_be_null({ expr: ref("empty.expires_on") }),
    openEntries("jam", "listed"),
    s.expect.to_equal({ expr: withFilters(ref("listed"), fl.count()), value: c.int(1) }),

    s.expect.to_throw({
      body: [
        s.db.add({ table: household, row: { name: "mine", invite_code: "wf-mine" }, as: "mine" }),
        s.db.add({ table: household, row: { name: "theirs", invite_code: "wf-theirs" }, as: "theirs" }),
        s.db.add({ table: location, row: { name: "pantry", household_id: ref("theirs.id") }, as: "spot" }),
        s.db.add({ table: item, row: { name: "honey", location_id: ref("spot.id"), quantity: 1 }, as: "honey" }),
        s.function.call({
          fn: editItem,
          input: { item_id: ref("honey.id"), household_id: ref("mine.id"), clear_expiry: c.bool(true) },
        }),
      ],
      exception: c.text("no such location"),
    }),
    s.expect.to_throw({
      body: [
        s.db.add({ table: household, row: { name: "mine", invite_code: "wf-mine2" }, as: "mine" }),
        s.db.add({ table: household, row: { name: "theirs", invite_code: "wf-theirs2" }, as: "theirs" }),
        s.db.add({ table: location, row: { name: "pantry", household_id: ref("mine.id") }, as: "home" }),
        s.db.add({ table: location, row: { name: "pantry", household_id: ref("theirs.id") }, as: "away" }),
        s.db.add({ table: item, row: { name: "honey", location_id: ref("home.id"), quantity: 1 }, as: "honey" }),
        s.function.call({
          fn: editItem,
          input: { item_id: ref("honey.id"), household_id: ref("mine.id"), location_id: ref("away.id") },
        }),
      ],
      exception: c.text("no such location"),
    }),
  ],
});
