import { table, f } from "@xano/sdk";
import { household } from "./household.js";
import { user } from "./user.js";

export const shoppingEntry = table({
  name: "shopping_entry",
  schema: {
    name: f.text({ required: true }),
    quantity: f.decimal(),
    household_id: f.tableRef(household, { required: true }),
    done: f.bool({ default: false }),
    done_by: f.tableRef(user),
  },
  index: [{ type: "btree", fields: [{ name: "household_id" }, { name: "done" }] }],
});
