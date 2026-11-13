import { workflowTest, s, c, ref } from "@xano/sdk";
import { household } from "../tables/household.js";
import { location } from "../tables/location.js";
import { saveLocation } from "../functions/locations.js";

export const locationNamesStayUnique = workflowTest({
  name: "locations can be added and renamed but not doubled up",
  stack: [
    s.db.add({ table: household, row: { name: "garage house", invite_code: "wf-garage" }, as: "house" }),
    s.db.add({ table: location, row: { name: "Fridge", household_id: ref("house.id") }, as: "fridge" }),

    s.function.call({
      fn: saveLocation,
      input: { household_id: ref("house.id"), name: c.text("  garage fridge ") },
      as: "garage",
    }),
    s.expect.to_equal({ expr: ref("garage.name"), value: c.text("garage fridge") }),
    s.expect.to_equal({ expr: ref("garage.household_id"), value: ref("house.id") }),

    s.function.call({
      fn: saveLocation,
      input: { household_id: ref("house.id"), location_id: ref("fridge.id"), name: c.text("fridge") },
      as: "same_name",
    }),
    s.expect.to_equal({ expr: ref("same_name.name"), value: c.text("fridge") }),

    s.function.call({
      fn: saveLocation,
      input: { household_id: ref("house.id"), location_id: ref("garage.id"), name: c.text("shed") },
      as: "shed",
    }),
    s.expect.to_equal({ expr: ref("shed.id"), value: ref("garage.id") }),
    s.expect.to_equal({ expr: ref("shed.name"), value: c.text("shed") }),

    s.expect.to_throw({
      body: [
        s.db.add({ table: household, row: { name: "dupe house", invite_code: "wf-dupe" }, as: "h" }),
        s.db.add({ table: location, row: { name: "pantry", household_id: ref("h.id") } }),
        s.function.call({ fn: saveLocation, input: { household_id: ref("h.id"), name: c.text("PANTRY") } }),
      ],
      exception: c.text("already got one"),
    }),
    s.expect.to_throw({
      body: [
        s.db.add({ table: household, row: { name: "swap house", invite_code: "wf-swap" }, as: "h" }),
        s.db.add({ table: location, row: { name: "pantry", household_id: ref("h.id") } }),
        s.db.add({ table: location, row: { name: "cupboard", household_id: ref("h.id") }, as: "cupboard" }),
        s.function.call({
          fn: saveLocation,
          input: { household_id: ref("h.id"), location_id: ref("cupboard.id"), name: c.text("pantry") },
        }),
      ],
      exception: c.text("already got one"),
    }),
    s.expect.to_throw({
      body: [
        s.db.add({ table: household, row: { name: "mine", invite_code: "wf-loc-mine" }, as: "mine" }),
        s.db.add({ table: household, row: { name: "theirs", invite_code: "wf-loc-theirs" }, as: "theirs" }),
        s.db.add({ table: location, row: { name: "their freezer", household_id: ref("theirs.id") }, as: "spot" }),
        s.function.call({
          fn: saveLocation,
          input: { household_id: ref("mine.id"), location_id: ref("spot.id"), name: c.text("mine now") },
        }),
      ],
      exception: c.text("no such location"),
    }),
    s.expect.to_throw({
      body: [
        s.db.add({ table: household, row: { name: "blank house", invite_code: "wf-blank" }, as: "h" }),
        s.function.call({ fn: saveLocation, input: { household_id: ref("h.id"), name: c.text("   ") } }),
      ],
      exception: c.text("name it something"),
    }),
  ],
});
