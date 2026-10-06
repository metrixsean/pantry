import { workspace } from "@xano/sdk";
import { household } from "./tables/household.js";
import { location } from "./tables/location.js";
import { item } from "./tables/item.js";
import { itemsApi, listItems, createItem, listLocations } from "./api/items.js";

export default workspace("pantry")
  .registerTables([household, location, item])
  .registerApiGroups([itemsApi])
  .registerQueries([listItems, createItem, listLocations]);
