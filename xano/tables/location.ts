import { table, f } from "@xano/sdk";
import { household } from "./household.js";

export const location = table({
  name: "location",
  schema: {
    name: f.text({ required: true }),
    household_id: f.tableRef(household, { required: true }),
  },
  seed: [
    { name: "pantry", household_id: 1 },
    { name: "fridge", household_id: 1 },
    { name: "freezer", household_id: 1 },
  ],
});
