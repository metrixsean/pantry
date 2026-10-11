import { table, f } from "@xano/sdk";
import { household } from "./household.js";

export const alertLog = table({
  name: "alert_log",
  schema: {
    household_id: f.tableRef(household, { required: true }),
    sent_to: f.email({ required: true }),
    frequency: f.enum(["daily", "weekly"], { required: true }),
    item_count: f.int({ required: true }),
    subject: f.text({ required: true }),
    sent_at: f.timestamp({ required: true }),
  },
  index: [{ type: "btree", fields: [{ name: "household_id" }, { name: "sent_at", op: "desc" }] }],
});
