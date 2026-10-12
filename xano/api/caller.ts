import { s, c, ref, auth, expr, guard, statements } from "@xano/sdk";
import { user } from "../tables/user.js";

export const callerHousehold = () =>
  statements(
    s.db.get({ table: user, fieldValue: auth("id"), as: "me" }),
    guard.found("me", { errorType: "unauthorized", message: "sign in again" }),
    guard.require(expr(ref("me.household_id"), "!=", c.null()), { message: "join a household first" }),
  );
