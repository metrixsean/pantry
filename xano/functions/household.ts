import { defineFunction, input, s, c, fl, inp, ref, guard, withFilters } from "@xano/sdk";
import { household } from "../tables/household.js";
import { location } from "../tables/location.js";
import { user } from "../tables/user.js";

export const STARTER_LOCATIONS = ["pantry", "fridge", "freezer"];

export const startHousehold = defineFunction({
  name: "start_household",
  description: "Creates a household with a fresh invite code and the usual three locations, and moves the user into it.",
  input: {
    user_id: input.int({ required: true }),
    name: input.text({ required: true, methods: ["trim", "min:1"] }),
  },
  stack: [
    s.security.create_uuid({ as: "uuid" }),
    s.db.add({
      table: household,
      row: { name: inp("name"), invite_code: withFilters(ref("uuid"), fl.substr(0, 8)) },
      as: "house",
    }),
    s.foreach({
      list: c.array(STARTER_LOCATIONS),
      as: "spot",
      body: [s.db.add({ table: location, row: { name: ref("spot"), household_id: ref("house.id") } })],
    }),
    s.db.edit({ table: user, fieldValue: inp("user_id"), row: { household_id: ref("house.id") } }),
  ],
  response: ref("house"),
});

export const joinHousehold = defineFunction({
  name: "join_household",
  description: "Moves the user into the household whose invite code matches.",
  input: {
    user_id: input.int({ required: true }),
    invite_code: input.text({ required: true, methods: ["trim", "lower"] }),
  },
  stack: [
    s.db.get({ table: household, fieldName: "invite_code", fieldValue: inp("invite_code"), as: "house" }),
    guard.found("house", { message: "no household with that invite code" }),
    s.db.edit({ table: user, fieldValue: inp("user_id"), row: { household_id: ref("house.id") } }),
  ],
  response: ref("house"),
});
