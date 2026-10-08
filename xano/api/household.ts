import { apiGroup, query, input, s, inp, ref, guard } from "@xano/sdk";
import { household } from "../tables/household.js";

export const householdApi = apiGroup({ name: "household", canonical: "household" });

export const getHousehold = query({
  name: "household/{household_id}",
  verb: "GET",
  apiGroup: householdApi,
  input: { household_id: input.int({ required: true }) },
  stack: [
    s.db.get({ table: household, fieldValue: inp("household_id"), as: "house" }),
    guard.found("house"),
  ],
  response: ref("house"),
});

export const updateHousehold = query({
  name: "household/{household_id}",
  verb: "PATCH",
  apiGroup: householdApi,
  input: {
    household_id: input.int({ required: true }),
    alert_email: input.email({ nullable: true, methods: ["lower"] }),
  },
  stack: [
    s.db.get({ table: household, fieldValue: inp("household_id"), as: "house" }),
    guard.found("house"),
    s.db.edit({
      table: household,
      fieldValue: inp("household_id"),
      row: { alert_email: inp("alert_email") },
      as: "updated",
    }),
  ],
  response: ref("updated"),
});
