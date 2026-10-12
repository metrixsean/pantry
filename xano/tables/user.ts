import { table, f } from "@xano/sdk";
import { household } from "./household.js";

export const user = table({
  name: "user",
  auth: true,
  schema: {
    name: f.text({ required: true }),
    email: f.email({ required: true }),
    password: f.password({ required: true }),
    household_id: f.tableRef(household),
  },
  index: [
    { type: "unique", fields: [{ name: "email" }] },
    { type: "btree", fields: [{ name: "household_id" }] },
  ],
});
