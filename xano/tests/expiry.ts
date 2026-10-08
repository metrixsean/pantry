import { workflowTest, s, c, fl, ref, withFilters } from "@xano/sdk";
import { household } from "../tables/household.js";
import { location } from "../tables/location.js";
import { item } from "../tables/item.js";
import { checkExpiringItems } from "../functions/expiry.js";

const daysFromNow = (days: number) =>
  withFilters(c.now(), fl.epochms_add_secs(days * 86400), fl.epochms_date("Y-m-d", "UTC"));

export const expiryCheckFlagsOnce = workflowTest({
  name: "expiry check flags each item once",
  stack: [
    s.db.add({ table: household, row: { name: "test house", invite_code: "wf-expiry" }, as: "house" }),
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
    s.expect.to_equal({ expr: ref("first.emailed"), value: c.int(0) }),

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
