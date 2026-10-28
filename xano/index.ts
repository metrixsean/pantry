import { workspace } from "@xano/sdk";
import { household } from "./tables/household.js";
import { user } from "./tables/user.js";
import { location } from "./tables/location.js";
import { item } from "./tables/item.js";
import { alertLog } from "./tables/alert_log.js";
import { shoppingEntry } from "./tables/shopping_entry.js";
import { authApi, signup, login, me } from "./api/auth.js";
import { itemsApi, listItems, createItem, updateItem, deleteItem, listLocations } from "./api/items.js";
import {
  householdApi,
  createHousehold,
  joinByInvite,
  getHousehold,
  updateHousehold,
  listMembers,
  listAlerts,
} from "./api/household.js";
import { shoppingApi, listShopping, addShopping, updateShopping, restockShopping } from "./api/shopping.js";
import { expiryDigest, checkExpiringItems } from "./functions/expiry.js";
import { startHousehold, joinHousehold } from "./functions/household.js";
import { restockEntry } from "./functions/shopping.js";
import { nightlyExpiryCheck } from "./tasks/nightly-expiry.js";
import { expiryCheckFlagsOnce, emptyItemsListedOnce } from "./tests/expiry.js";
import { startThenJoinHousehold } from "./tests/household.js";
import { restockTopsUpOrAdds } from "./tests/shopping.js";

export default workspace("pantry")
  .registerTables([household, user, location, item, alertLog, shoppingEntry])
  .registerApiGroups([authApi, itemsApi, householdApi, shoppingApi])
  .registerQueries([
    signup,
    login,
    me,
    listItems,
    createItem,
    updateItem,
    deleteItem,
    listLocations,
    createHousehold,
    joinByInvite,
    getHousehold,
    updateHousehold,
    listMembers,
    listAlerts,
    listShopping,
    addShopping,
    updateShopping,
    restockShopping,
  ])
  .registerFunctions([expiryDigest, checkExpiringItems, startHousehold, joinHousehold, restockEntry])
  .registerTasks([nightlyExpiryCheck])
  .registerWorkflowTests([expiryCheckFlagsOnce, emptyItemsListedOnce, startThenJoinHousehold, restockTopsUpOrAdds]);
