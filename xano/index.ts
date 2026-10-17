import { workspace } from "@xano/sdk";
import { household } from "./tables/household.js";
import { user } from "./tables/user.js";
import { location } from "./tables/location.js";
import { item } from "./tables/item.js";
import { alertLog } from "./tables/alert_log.js";
import { shoppingEntry } from "./tables/shopping_entry.js";
import { authApi, signup, login, me } from "./api/auth.js";
import { itemsApi, listItems, createItem, listLocations } from "./api/items.js";
import {
  householdApi,
  createHousehold,
  joinByInvite,
  getHousehold,
  updateHousehold,
  listMembers,
  listAlerts,
} from "./api/household.js";
import { expiryDigest, checkExpiringItems } from "./functions/expiry.js";
import { startHousehold, joinHousehold } from "./functions/household.js";
import { nightlyExpiryCheck } from "./tasks/nightly-expiry.js";
import { expiryCheckFlagsOnce } from "./tests/expiry.js";
import { startThenJoinHousehold } from "./tests/household.js";

export default workspace("pantry")
  .registerTables([household, user, location, item, alertLog, shoppingEntry])
  .registerApiGroups([authApi, itemsApi, householdApi])
  .registerQueries([
    signup,
    login,
    me,
    listItems,
    createItem,
    listLocations,
    createHousehold,
    joinByInvite,
    getHousehold,
    updateHousehold,
    listMembers,
    listAlerts,
  ])
  .registerFunctions([expiryDigest, checkExpiringItems, startHousehold, joinHousehold])
  .registerTasks([nightlyExpiryCheck])
  .registerWorkflowTests([expiryCheckFlagsOnce, startThenJoinHousehold]);
