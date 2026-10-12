// The one contract: endpoint paths and request types come from the generated
// route manifest, and response *types* from your xanosdk query defs. Never
// hand-type a URL or a request body: change a def and everything here follows.
//
// Keep the backend out of the browser bundle:
//   • Paths and verbs: `routePath()` / `ROUTES` from xano/routes.gen.ts, plain data
//     generated from the defs (`npm run xano:routes`; dev, build and typecheck
//     regenerate it). Never import a def as a VALUE for its getPath()/verb:
//     its s.*/c.* factory calls run at module load, so one import pulls in the
//     backend graph it references and the SDK runtime that builds it.
//   • Request types: `RouteInputs["<VERB> <name>"]` from the same file
//     (`ChannelInputs` / `MessageInputs` for realtime), types only. For
//     runtime validation, `npx xanosdk marketplace install zod` adds zod
//     schemas under the same keys.
//   • Response types: `import type` the def. InferResponse erases to nothing.
//
// Nothing here imports the manifest yet — an add-on's endpoints may already be
// in it. Wire an endpoint (one in xano/, or an add-on's) like:
//
//   import type { InferResponse } from "@xano/sdk";
//   import type { createNoteQuery } from "../../../xano/api/create-note.js";
//   import { ROUTES, routePath, type RouteInputs } from "../../../xano/routes.gen.js";
//
//   export type CreateNoteBody = RouteInputs["POST create_note"];
//   export type Note = InferResponse<typeof createNoteQuery>;
//
//   export async function createNote(body: CreateNoteBody): Promise<Note> {
//     const res = await fetch(XANO_HOST + routePath("POST create_note"), {
//       method: ROUTES["POST create_note"].verb,
//       headers: { "content-type": "application/json" },
//       body: JSON.stringify(body),
//     });
//     if (!res.ok) throw new Error(await res.text());
//     return res.json();
//   }
//
// Keys are "<VERB> <query name>"; path params are passed by name, e.g.
// routePath("GET notes/{id}", { id }). A renamed endpoint is a compile error.

// Types the global the deploy injects, for every file in the project: the
// documented `window.XANO_HOST` reads compile anywhere. `undefined` in dev.
declare global {
  interface Window {
    XANO_HOST?: string;
  }
}

/**
 * The deployed Xano backend's base URL. Injected as `window.XANO_HOST` by
 * `npx xanosdk deploy <entry> --static <dir>`, or read from `VITE_XANO_HOST` in dev.
 * Empty string when neither is set (the UI runs with no backend).
 */
export const XANO_HOST: string =
  (typeof window !== "undefined" && window.XANO_HOST) ||
  import.meta.env.VITE_XANO_HOST ||
  "";

import type { InferResponse } from "@xano/sdk";
import type { me } from "../../../xano/api/auth.js";
import type { listItems, listLocations } from "../../../xano/api/items.js";
import type { getHousehold, listAlerts, listMembers } from "../../../xano/api/household.js";
import { ROUTES, routePath, type RouteInputs } from "../../../xano/routes.gen.js";

export type Me = InferResponse<typeof me>;
export type Item = InferResponse<typeof listItems>[number];
export type Location = InferResponse<typeof listLocations>[number];
export type NewItem = RouteInputs["POST create_item"];
export type Household = InferResponse<typeof getHousehold>;
export type Member = InferResponse<typeof listMembers>[number];
export type AlertLogEntry = InferResponse<typeof listAlerts>[number];

const TOKEN_KEY = "pantry.token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function signOut(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (init.body) headers.set("content-type", "application/json");
  const res = await fetch(XANO_HOST + url, { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      message = JSON.parse(text).message || text;
    } catch {}
    throw new ApiError(res.status, message || res.statusText);
  }
  return res.json();
}

async function authenticate(url: string, body: unknown): Promise<void> {
  const { token } = await call<{ token: string }>(url, { method: "POST", body: JSON.stringify(body) });
  localStorage.setItem(TOKEN_KEY, token);
}

export function signUp(body: RouteInputs["POST signup"]): Promise<void> {
  return authenticate(routePath("POST signup"), body);
}

export function logIn(body: RouteInputs["POST login"]): Promise<void> {
  return authenticate(routePath("POST login"), body);
}

export function getMe(): Promise<Me> {
  return call(routePath("GET me"));
}

export function startHousehold(body: RouteInputs["POST household/start"]): Promise<Household> {
  return call(routePath("POST household/start"), {
    method: ROUTES["POST household/start"].verb,
    body: JSON.stringify(body),
  });
}

export function joinHousehold(body: RouteInputs["POST household/join"]): Promise<Household> {
  return call(routePath("POST household/join"), {
    method: ROUTES["POST household/join"].verb,
    body: JSON.stringify(body),
  });
}

export function getLocations(): Promise<Location[]> {
  return call(routePath("GET list_locations"));
}

export function getItems(query: RouteInputs["GET list_items"] = {}): Promise<Item[]> {
  const qs = query.location_id === undefined ? "" : `?location_id=${query.location_id}`;
  return call(routePath("GET list_items") + qs);
}

export function addItem(body: NewItem): Promise<Item> {
  return call(routePath("POST create_item"), {
    method: ROUTES["POST create_item"].verb,
    body: JSON.stringify(body),
  });
}

export function getHouseholdSettings(): Promise<Household> {
  return call(routePath("GET household"));
}

export function getMembers(): Promise<Member[]> {
  return call(routePath("GET household/members"));
}

export function setAlertSettings(body: RouteInputs["PATCH household"]): Promise<Household> {
  return call(routePath("PATCH household"), {
    method: ROUTES["PATCH household"].verb,
    body: JSON.stringify(body),
  });
}

export function getAlertHistory(): Promise<AlertLogEntry[]> {
  return call(routePath("GET household/alerts"));
}
