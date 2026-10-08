import {
  defineFunction,
  input,
  s,
  c,
  fl,
  inp,
  ref,
  col,
  expr,
  and,
  or,
  cond,
  withFilters,
  expect,
  resp,
} from "@xano/sdk";
import { household } from "../tables/household.js";
import { location } from "../tables/location.js";
import { item } from "../tables/item.js";

export const EXPIRY_WINDOW_DAYS = 3;

export const expiryDigest = defineFunction({
  name: "expiry_digest",
  description: "Subject and body of the email listing what's about to go off.",
  input: {
    household: input.text({ required: true }),
    items: input.json({ required: true }),
  },
  stack: [
    s.set_var("count", withFilters(inp("items"), fl.count())),
    s.set_var("noun", c.text("things")),
    s.conditional({
      when: expr(ref("count"), "=", c.int(1)),
      then: [s.update_var("noun", c.text("thing"))],
    }),
    s.array.map({
      source: inp("items"),
      transform: withFilters(
        c.text("- "),
        fl.concat(ref("$this.name")),
        fl.concat(" ("),
        fl.concat(ref("$this.location")),
        fl.concat("), use by "),
        fl.concat(ref("$this.expires_on")),
      ),
      as: "lines",
    }),
    s.set_var(
      "subject",
      withFilters(
        ref("count"),
        fl.to_text(),
        fl.concat(" "),
        fl.concat(ref("noun")),
        fl.concat(" in "),
        fl.concat(inp("household")),
        fl.concat(" going off soon"),
      ),
    ),
    s.set_var(
      "message",
      withFilters(
        c.text(`Use these up in the next ${EXPIRY_WINDOW_DAYS} days:\n\n`),
        fl.concat(withFilters(ref("lines"), fl.join("\n"))),
        fl.concat("\n\n(pantry checks every night, you'll only hear about each item once)"),
      ),
    ),
  ],
  response: { subject: ref("subject"), message: ref("message") },
  tests: [
    {
      name: "one item",
      input: {
        household: c.text("home"),
        items: c.array([{ name: "milk", location: "fridge", expires_on: "2026-10-10" }]),
      },
      expect: [
        expect.to_equal(resp("subject"), c.text("1 thing in home going off soon")),
        expect.to_contain(resp("message"), c.text("- milk (fridge), use by 2026-10-10")),
      ],
    },
    {
      name: "a few items",
      input: {
        household: c.text("flat 4"),
        items: c.array([
          { name: "yoghurt", location: "fridge", expires_on: "2026-10-09" },
          { name: "peas", location: "freezer", expires_on: "2026-10-11" },
        ]),
      },
      expect: [
        expect.to_equal(resp("subject"), c.text("2 things in flat 4 going off soon")),
        expect.to_contain(resp("message"), c.text("- yoghurt (fridge), use by 2026-10-09\n- peas (freezer)")),
      ],
    },
  ],
});

export const checkExpiringItems = defineFunction({
  name: "check_expiring_items",
  description:
    "Flags stocked items expiring within the window, clears the flag on ones that moved out of it, and emails each household its newly flagged items once.",
  stack: [
    s.set_var(
      "cutoff",
      withFilters(c.now(), fl.epochms_add_secs(EXPIRY_WINDOW_DAYS * 86400), fl.epochms_date("Y-m-d", "UTC")),
    ),
    s.db.query({
      table: item,
      bind: [{ table: location, as: "loc", where: expr(col("location_id"), "=", col("loc.id")) }],
      where: [
        expr(col("expiring"), "=", c.bool(false)),
        expr(col("quantity"), ">", c.decimal(0)),
        expr(col("expires_on"), "!=", c.null()),
        expr(col("expires_on"), "<=", ref("cutoff")),
      ],
      eval: [
        { name: "loc.name", as: "location" },
        { name: "loc.household_id", as: "household_id" },
      ],
      sort: [{ sortBy: "expires_on", dir: "asc" }],
      as: "fresh",
    }),
    s.foreach({
      list: ref("fresh"),
      as: "row",
      body: [s.db.edit({ table: item, fieldValue: ref("row.id"), row: { expiring: true } })],
    }),
    s.db.query({
      table: item,
      where: [
        expr(col("expiring"), "=", c.bool(true)),
        or(expr(col("expires_on"), "=", c.null()), expr(col("expires_on"), ">", ref("cutoff"))),
      ],
      as: "stale",
    }),
    s.foreach({
      list: ref("stale"),
      as: "row",
      body: [s.db.edit({ table: item, fieldValue: ref("row.id"), row: { expiring: false } })],
    }),
    s.set_var("by_household", withFilters(ref("fresh"), fl.index_by("household_id"))),
    s.db.query({ table: household, as: "households" }),
    s.set_var("emailed", c.int(0)),
    s.foreach({
      list: ref("households"),
      as: "h",
      body: [
        s.set_var("due", withFilters(ref("by_household"), fl.get(ref("h.id"), c.array([])))),
        s.conditional({
          when: and(cond.notEmpty(ref("h.alert_email")), cond.notEmpty(ref("due"))),
          then: [
            s.function.run({
              fn: expiryDigest,
              input: { household: ref("h.name"), items: ref("due") },
              as: "digest",
            }),
            s.util.send_email({
              service_provider: "xano",
              to: ref("h.alert_email"),
              subject: ref("digest.subject"),
              message: ref("digest.message"),
            }),
            s.update_var("emailed", withFilters(ref("emailed"), fl.add(1))),
          ],
        }),
      ],
    }),
  ],
  response: {
    flagged: withFilters(ref("fresh"), fl.count()),
    cleared: withFilters(ref("stale"), fl.count()),
    emailed: ref("emailed"),
  },
});
