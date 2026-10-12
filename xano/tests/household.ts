import { workflowTest, s, c, fl, ref, col, expr, withFilters } from "@xano/sdk";
import { location } from "../tables/location.js";
import { user } from "../tables/user.js";
import { startHousehold, joinHousehold } from "../functions/household.js";

export const startThenJoinHousehold = workflowTest({
  name: "start a household then join it by invite code",
  stack: [
    s.db.add({
      table: user,
      row: { name: "sam", email: "sam@example.com", password: "correct-horse" },
      as: "sam",
    }),
    s.db.add({
      table: user,
      row: { name: "alex", email: "alex@example.com", password: "battery-staple" },
      as: "alex",
    }),

    s.function.call({ fn: startHousehold, input: { user_id: ref("sam.id"), name: c.text("flat 4") }, as: "house" }),
    s.expect.to_equal({ expr: ref("house.name"), value: c.text("flat 4") }),
    s.expect.to_equal({ expr: withFilters(ref("house.invite_code"), fl.strlen()), value: c.int(8) }),

    s.db.query({ table: location, where: expr(col("household_id"), "=", ref("house.id")), as: "spots" }),
    s.expect.to_equal({ expr: withFilters(ref("spots"), fl.count()), value: c.int(3) }),

    s.db.get({ table: user, fieldValue: ref("sam.id"), as: "sam_after" }),
    s.expect.to_equal({ expr: ref("sam_after.household_id"), value: ref("house.id") }),

    s.function.call({
      fn: joinHousehold,
      input: {
        user_id: ref("alex.id"),
        invite_code: withFilters(ref("house.invite_code"), fl.upper(), fl.concat(" ")),
      },
      as: "joined",
    }),
    s.expect.to_equal({ expr: ref("joined.id"), value: ref("house.id") }),
    s.db.get({ table: user, fieldValue: ref("alex.id"), as: "alex_after" }),
    s.expect.to_equal({ expr: ref("alex_after.household_id"), value: ref("house.id") }),

    s.expect.to_throw({
      body: [
        s.db.add({ table: user, row: { name: "kit", email: "kit@example.com", password: "hunter22" }, as: "kit" }),
        s.function.call({ fn: joinHousehold, input: { user_id: ref("kit.id"), invite_code: c.text("nope-nope") } }),
      ],
      exception: c.text("no household with that invite code"),
    }),
  ],
});
