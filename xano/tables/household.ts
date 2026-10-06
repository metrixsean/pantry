import { table, f } from "@xano/sdk";

export const household = table({
  name: "household",
  schema: {
    name: f.text({ required: true }),
    invite_code: f.text({ required: true }),
  },
  seed: [{ id: 1, name: "home", invite_code: "home-sweet-home" }],
  index: [{ type: "unique", fields: [{ name: "invite_code" }] }],
});
