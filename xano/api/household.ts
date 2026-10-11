import { apiGroup, query, input, s, inp, ref, guard, col, cmp } from "@xano/sdk";
import { household } from "../tables/household.js";
import { alertLog } from "../tables/alert_log.js";

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
    alert_frequency: input.enum(["daily", "weekly"], { nullable: true }),
  },
  stack: [
    s.db.get({ table: household, fieldValue: inp("household_id"), as: "house" }),
    guard.found("house"),
    s.db.edit({
      table: household,
      fieldValue: inp("household_id"),
      row: { alert_email: inp("alert_email"), alert_frequency: inp("alert_frequency") },
      as: "updated",
    }),
  ],
  response: ref("updated"),
});

export const listAlerts = query({
  name: "household/{household_id}/alerts",
  verb: "GET",
  apiGroup: householdApi,
  input: { household_id: input.int({ required: true }) },
  stack: [
    s.db.get({ table: household, fieldValue: inp("household_id"), as: "house" }),
    guard.found("house"),
    s.db.query({
      table: alertLog,
      where: cmp(col("household_id"), "=", inp("household_id")),
      sort: [{ sortBy: "sent_at", dir: "desc" }],
      paging: { per_page: 30, metadata: false },
      as: "rows",
    }),
  ],
  response: ref("rows"),
});
