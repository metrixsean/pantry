import { apiGroup, query, input, s, inp, ref, auth, guard, col, cmp } from "@xano/sdk";
import { household } from "../tables/household.js";
import { alertLog } from "../tables/alert_log.js";
import { user } from "../tables/user.js";
import { startHousehold, joinHousehold } from "../functions/household.js";
import { callerHousehold } from "./caller.js";

export const householdApi = apiGroup({ name: "household", canonical: "household" });

export const createHousehold = query({
  name: "household/start",
  verb: "POST",
  apiGroup: householdApi,
  auth: user,
  input: { name: input.text({ required: true, methods: ["trim", "min:1"] }) },
  stack: [
    s.function.run({ fn: startHousehold, input: { user_id: auth("id"), name: inp("name") }, as: "house" }),
  ],
  response: ref("house"),
});

export const joinByInvite = query({
  name: "household/join",
  verb: "POST",
  apiGroup: householdApi,
  auth: user,
  input: { invite_code: input.text({ required: true, methods: ["trim", "lower"] }) },
  stack: [
    s.function.run({
      fn: joinHousehold,
      input: { user_id: auth("id"), invite_code: inp("invite_code") },
      as: "house",
    }),
  ],
  response: ref("house"),
});

export const getHousehold = query({
  name: "household",
  verb: "GET",
  apiGroup: householdApi,
  auth: user,
  stack: [
    ...callerHousehold(),
    s.db.get({ table: household, fieldValue: ref("me.household_id"), as: "house" }),
    guard.found("house"),
  ],
  response: ref("house"),
});

export const updateHousehold = query({
  name: "household",
  verb: "PATCH",
  apiGroup: householdApi,
  auth: user,
  input: {
    alert_email: input.email({ nullable: true, methods: ["lower"] }),
    alert_frequency: input.enum(["daily", "weekly"], { nullable: true }),
  },
  stack: [
    ...callerHousehold(),
    s.db.edit({
      table: household,
      fieldValue: ref("me.household_id"),
      row: { alert_email: inp("alert_email"), alert_frequency: inp("alert_frequency") },
      as: "updated",
    }),
  ],
  response: ref("updated"),
});

export const listMembers = query({
  name: "household/members",
  verb: "GET",
  apiGroup: householdApi,
  auth: user,
  stack: [
    ...callerHousehold(),
    s.db.query({
      table: user,
      where: cmp(col("household_id"), "=", ref("me.household_id")),
      sort: [{ sortBy: "created_at", dir: "asc" }],
      output: ["id", "name", "email"],
      as: "rows",
    }),
  ],
  response: ref("rows"),
});

export const listAlerts = query({
  name: "household/alerts",
  verb: "GET",
  apiGroup: householdApi,
  auth: user,
  stack: [
    ...callerHousehold(),
    s.db.query({
      table: alertLog,
      where: cmp(col("household_id"), "=", ref("me.household_id")),
      sort: [{ sortBy: "sent_at", dir: "desc" }],
      paging: { per_page: 30, metadata: false },
      as: "rows",
    }),
  ],
  response: ref("rows"),
});
