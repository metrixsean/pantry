import { task, every, s } from "@xano/sdk";
import { checkExpiringItems } from "../functions/expiry.js";

export const nightlyExpiryCheck = task({
  name: "nightly_expiry_check",
  description: "Flags items about to expire and emails each household about the new ones.",
  schedule: [{ startsOn: "2026-10-09T05:00:00Z", freq: every("1d") }],
  stack: [s.function.run({ fn: checkExpiringItems, as: "result" })],
});
