import { defineFunction, input, s, c, fl, inp, ref, col, cmp, expr, guard, withFilters } from "@xano/sdk";
import { location } from "../tables/location.js";

export const saveLocation = defineFunction({
  name: "save_location",
  description:
    "Adds a location to a household, or renames one when location_id is set. Names are unique per household, ignoring case.",
  input: {
    household_id: input.int({ required: true }),
    location_id: input.int({ nullable: true }),
    name: input.text({ required: true, methods: ["trim"] }),
  },
  stack: [
    guard.require(expr(inp("name"), "!=", c.text("")), { errorType: "inputerror", message: "name it something" }),
    s.conditional({
      when: expr(inp("location_id"), "!=", c.null()),
      then: [
        s.db.get({ table: location, fieldValue: inp("location_id"), as: "loc" }),
        guard.found("loc", { message: "no such location" }),
        guard.require(expr(ref("loc.household_id"), "=", inp("household_id")), {
          errorType: "notfound",
          message: "no such location",
        }),
      ],
    }),
    s.db.query({
      table: location,
      where: [
        expr(col("household_id"), "=", inp("household_id")),
        expr(withFilters(col("name"), fl.lower()), "=", withFilters(inp("name"), fl.lower())),
        cmp(col("id"), "!=", inp("location_id"), { ignoreEmpty: true }),
      ],
      returnType: "exists",
      as: "taken",
    }),
    guard.require(expr(ref("taken"), "=", c.bool(false)), {
      errorType: "badrequest",
      message: "you've already got one of those",
    }),
    s.conditional({
      when: expr(inp("location_id"), "!=", c.null()),
      then: [s.db.edit({ table: location, fieldValue: inp("location_id"), row: { name: inp("name") }, as: "saved" })],
      else: [s.db.add({ table: location, row: { name: inp("name"), household_id: inp("household_id") }, as: "saved" })],
    }),
  ],
  response: ref("saved"),
});
