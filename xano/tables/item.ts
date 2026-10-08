import { table, f } from "@xano/sdk";
import { location } from "./location.js";

export const item = table({
  name: "item",
  schema: {
    name: f.text({ required: true }),
    location_id: f.tableRef(location, { required: true }),
    quantity: f.decimal({ required: true }),
    unit: f.text(),
    expires_on: f.date(),
    expiring: f.bool({ default: false }),
  },
  index: [
    { type: "btree", fields: [{ name: "location_id" }] },
    { type: "btree", fields: [{ name: "expires_on" }] },
  ],
});
