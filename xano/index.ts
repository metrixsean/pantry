import { workspace } from "@xano/sdk";
import { household } from "./tables/household.js";
import { location } from "./tables/location.js";
import { item } from "./tables/item.js";
import { alertLog } from "./tables/alert_log.js";
import { itemsApi, listItems, createItem, listLocations } from "./api/items.js";
import { householdApi, getHousehold, updateHousehold, listAlerts } from "./api/household.js";
import { expiryDigest, checkExpiringItems } from "./functions/expiry.js";
import { nightlyExpiryCheck } from "./tasks/nightly-expiry.js";
import { expiryCheckFlagsOnce } from "./tests/expiry.js";

export default workspace("pantry")
  .registerTables([household, location, item, alertLog])
  .registerApiGroups([itemsApi, householdApi])
  .registerQueries([listItems, createItem, listLocations, getHousehold, updateHousehold, listAlerts])
  .registerFunctions([expiryDigest, checkExpiringItems])
  .registerTasks([nightlyExpiryCheck])
  .registerWorkflowTests([expiryCheckFlagsOnce]);
