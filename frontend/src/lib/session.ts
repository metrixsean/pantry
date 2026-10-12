import { goto } from "$app/navigation";
import { ApiError, getMe, getToken, signOut, type Me } from "./api";

const here = () => location.pathname + location.search;

export function loginUrl(next = here()): string {
  return `/login?next=${encodeURIComponent(next)}`;
}

// anything that isn't a same-site path goes home, so ?next= can't bounce people off-site
export function safeNext(raw: string | null): string | null {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : null;
}

export async function requireUser(): Promise<Me | null> {
  if (!getToken()) {
    await goto(loginUrl(), { replaceState: true });
    return null;
  }
  try {
    return await getMe();
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      signOut();
      await goto(loginUrl(), { replaceState: true });
      return null;
    }
    throw e;
  }
}

export async function requireHousehold(): Promise<Me | null> {
  const me = await requireUser();
  if (me && me.household_id == null) {
    await goto("/join", { replaceState: true });
    return null;
  }
  return me;
}
