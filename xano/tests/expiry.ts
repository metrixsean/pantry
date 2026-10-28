import { workflowTest, s, c, fl, ref, col, expr, withFilters } from "@xano/sdk";
import { household } from "../tables/household.js";
import { location } from "../tables/location.js";
import { item } from "../tables/item.js";
import { alertLog } from "../tables/alert_log.js";
import { shoppingEntry } from "../tables/shopping_entry.js";
import { checkExpiringItems } from "../functions/expiry.js";

const daysFromNow = (days: number) =>
  withFilters(c.now(), fl.epochms_add_secs(days * 86400), fl.epochms_date("Y-m-d", "UTC"));

export const expiryCheckFlagsOnce = workflowTest({
  name: "expiry check flags each item once",
  stack: [
    s.db.add({
      table: household,
      row: { name: "test house", invite_code: "wf-expiry", alert_email: "kitchen@example.com" },
      as: "house",
    }),
    s.db.add({ table: location, row: { name: "fridge", household_id: ref("house.id") }, as: "fridge" }),
    s.set_var("tomorrow", daysFromNow(1)),
    s.set_var("next_month", daysFromNow(30)),
    s.db.add({
      table: item,
      row: { name: "milk", location_id: ref("fridge.id"), quantity: 1, expires_on: ref("tomorrow") },
      as: "milk",
    }),
    s.db.add({
      table: item,
      row: { name: "empty jam jar", location_id: ref("fridge.id"), quantity: 0, expires_on: ref("tomorrow") },
      as: "jam",
    }),
    s.db.add({
      table: item,
      row: {
        name: "restocked cheese",
        location_id: ref("fridge.id"),
        quantity: 2,
        expires_on: ref("next_month"),
        expiring: true,
      },
      as: "cheese",
    }),

    s.function.call({ fn: checkExpiringItems, as: "first" }),
    s.expect.to_equal({ expr: ref("first.flagged"), value: c.int(1) }),
    s.expect.to_equal({ expr: ref("first.cleared"), value: c.int(1) }),
    s.expect.to_equal({ expr: ref("first.emailed"), value: c.int(1) }),

    s.db.query({
      table: alertLog,
      where: expr(col("household_id"), "=", ref("house.id")),
      as: "logged",
    }),
    s.expect.to_equal({ expr: withFilters(ref("logged"), fl.count()), value: c.int(1) }),
    s.expect.to_equal({ expr: ref("logged.0.item_count"), value: c.int(1) }),
    s.expect.to_equal({ expr: ref("logged.0.frequency"), value: c.text("daily") }),

    s.db.get({ table: item, fieldValue: ref("milk.id"), as: "milk_after" }),
    s.expect.to_be_true({ expr: ref("milk_after.expiring") }),
    s.db.get({ table: item, fieldValue: ref("jam.id"), as: "jam_after" }),
    s.expect.to_be_false({ expr: ref("jam_after.expiring") }),
    s.db.get({ table: item, fieldValue: ref("cheese.id"), as: "cheese_after" }),
    s.expect.to_be_false({ expr: ref("cheese_after.expiring") }),

    s.function.call({ fn: checkExpiringItems, as: "second" }),
    s.expect.to_equal({ expr: ref("second.flagged"), value: c.int(0) }),
  ],
});

const listedAs = (name: string, as: string) =>
  s.db.query({
    table: shoppingEntry,
    where: [
      expr(col("household_id"), "=", ref("house.id")),
      expr(col("name"), "=", c.text(name)),
      expr(col("done"), "=", c.bool(false)),
    ],
    as,
  });

export const emptyItemsListedOnce = workflowTest({
  name: "empty items land on the shopping list once",
  stack: [
    s.db.add({ table: household, row: { name: "empty house", invite_code: "wf-empty" }, as: "house" }),
    s.db.add({ table: location, row: { name: "pantry", household_id: ref("house.id") }, as: "pantry" }),
    s.db.add({ table: item, row: { name: "flour", location_id: ref("pantry.id"), quantity: 0 } }),
    s.db.add({ table: item, row: { name: "sugar", location_id: ref("pantry.id"), quantity: 0 } }),
    s.db.add({ table: item, row: { name: "eggs", location_id: ref("pantry.id"), quantity: 0 } }),
    s.db.add({ table: item, row: { name: "rice", location_id: ref("pantry.id"), quantity: 3 } }),
    s.db.add({ table: shoppingEntry, row: { name: "sugar", household_id: ref("house.id") } }),
    s.db.add({ table: shoppingEntry, row: { name: "eggs", household_id: ref("house.id"), done: true } }),

    s.function.call({ fn: checkExpiringItems, as: "first" }),
    s.function.call({ fn: checkExpiringItems, as: "second" }),

    listedAs("flour", "flour"),
    s.expect.to_equal({ expr: withFilters(ref("flour"), fl.count()), value: c.int(1) }),
    listedAs("sugar", "sugar"),
    s.expect.to_equal({ expr: withFilters(ref("sugar"), fl.count()), value: c.int(1) }),
    listedAs("eggs", "eggs"),
    s.expect.to_equal({ expr: withFilters(ref("eggs"), fl.count()), value: c.int(1) }),
    listedAs("rice", "rice"),
    s.expect.to_equal({ expr: withFilters(ref("rice"), fl.count()), value: c.int(0) }),
  ],
});
