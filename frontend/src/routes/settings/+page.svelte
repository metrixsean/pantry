<script lang="ts">
  import { onMount } from "svelte";
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import History from "@lucide/svelte/icons/history";
  import Bell from "@lucide/svelte/icons/bell";
  import Users from "@lucide/svelte/icons/users";
  import LogOut from "@lucide/svelte/icons/log-out";
  import MapPin from "@lucide/svelte/icons/map-pin";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import Check from "@lucide/svelte/icons/check";
  import X from "@lucide/svelte/icons/x";
  import Plus from "@lucide/svelte/icons/plus";
  import { goto } from "$app/navigation";

  import * as Card from "$lib/components/ui/card/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import ModeToggle from "$lib/components/mode-toggle.svelte";
  import {
    createLocation,
    deleteLocation,
    getAlertHistory,
    getHouseholdSettings,
    getItems,
    getLocations,
    getMembers,
    renameLocation,
    setAlertSettings,
    signOut,
    type AlertLogEntry,
    type Household,
    type Item,
    type Location,
    type Me,
    type Member,
  } from "$lib/api";
  import { requireHousehold } from "$lib/session";

  let me = $state<Me | null>(null);
  let house = $state<Household | undefined>();
  let members = $state<Member[]>([]);
  let inviteLink = $state("");
  let alertEmail = $state("");
  let frequency = $state<"daily" | "weekly">("daily");
  let history = $state<AlertLogEntry[]>([]);
  let error = $state("");
  let saved = $state(false);
  let saving = $state(false);

  let places = $state<Location[]>([]);
  let stock = $state<Item[]>([]);
  let newPlace = $state("");
  let adding = $state(false);
  let renaming = $state<{ id: number; name: string } | null>(null);
  let busy = $state<number[]>([]);
  let placeError = $state("");

  const counts = $derived(
    stock.reduce((acc, i) => acc.set(i.location_id, (acc.get(i.location_id) ?? 0) + 1), new Map<number, number>()),
  );
  const byName = (a: Location, b: Location) => a.name.localeCompare(b.name);

  const field = "border-input bg-background rounded-md border px-3 py-2 text-sm";

  async function load() {
    try {
      me = await requireHousehold();
      if (!me) return;
      [house, members, history, places, stock] = await Promise.all([
        getHouseholdSettings(),
        getMembers(),
        getAlertHistory(),
        getLocations(),
        getItems(),
      ]);
      alertEmail = house.alert_email ?? "";
      frequency = house.alert_frequency ?? "daily";
      inviteLink = `${location.origin}/join?code=${encodeURIComponent(house.invite_code)}`;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  async function save(event: SubmitEvent) {
    event.preventDefault();
    saving = true;
    saved = false;
    error = "";
    try {
      house = await setAlertSettings({
        alert_email: alertEmail.trim() || null,
        alert_frequency: frequency,
      });
      alertEmail = house.alert_email ?? "";
      frequency = house.alert_frequency ?? "daily";
      saved = true;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      saving = false;
    }
  }

  function placeFail(e: unknown) {
    placeError = e instanceof Error ? e.message : String(e);
  }

  async function addPlace(event: SubmitEvent) {
    event.preventDefault();
    const name = newPlace.trim();
    if (!name) return;
    adding = true;
    placeError = "";
    try {
      const created = await createLocation({ name });
      places = [...places, created].sort(byName);
      newPlace = "";
    } catch (e) {
      placeFail(e);
    } finally {
      adding = false;
    }
  }

  function startRename(place: Location) {
    placeError = "";
    renaming = { id: place.id, name: place.name };
  }

  async function saveRename(event: SubmitEvent) {
    event.preventDefault();
    if (!renaming) return;
    const { id } = renaming;
    const name = renaming.name.trim();
    if (!name) return placeFail("name it something");
    if (name === places.find((p) => p.id === id)?.name) {
      renaming = null;
      return;
    }
    placeError = "";
    busy.push(id);
    try {
      const updated = await renameLocation({ id, name });
      places = places.map((p) => (p.id === id ? updated : p)).sort(byName);
      renaming = null;
    } catch (e) {
      placeFail(e);
    } finally {
      busy = busy.filter((b) => b !== id);
    }
  }

  async function removePlace(place: Location) {
    if (!confirm(`bin ${place.name}?`)) return;
    placeError = "";
    busy.push(place.id);
    try {
      await deleteLocation(place.id);
      places = places.filter((p) => p.id !== place.id);
    } catch (e) {
      placeFail(e);
    } finally {
      busy = busy.filter((b) => b !== place.id);
    }
  }

  async function leave() {
    signOut();
    await goto("/login");
  }

  const when = (ms: number) => new Date(ms).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

  onMount(load);
</script>

<main class="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-8">
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-2">
      <Button variant="ghost" size="icon" href="/" aria-label="Back to stock">
        <ArrowLeft />
      </Button>
      <h1 class="text-3xl font-semibold tracking-tight">settings</h1>
    </div>
    <div class="flex items-center gap-1">
      <Button variant="ghost" size="icon" onclick={leave} aria-label="Log out">
        <LogOut />
      </Button>
      <ModeToggle />
    </div>
  </div>

  {#if error}
    <p class="text-destructive text-sm">{error}</p>
  {/if}

  <Card.Root>
    <Card.Header>
      <Card.Title>{house?.name ?? "household"}</Card.Title>
      <Card.Description>
        invite code: <span class="text-foreground font-mono">{house?.invite_code ?? "…"}</span>
        {#if inviteLink}
          <br />or send them <a class="text-foreground underline underline-offset-4" href={inviteLink}>{inviteLink}</a>
        {/if}
      </Card.Description>
    </Card.Header>
    <Card.Content>
      <p class="mb-2 flex items-center gap-2 text-sm font-medium"><Users class="size-4" /> who's in</p>
      <ul class="divide-border divide-y text-sm">
        {#each members as member (member.id)}
          <li class="flex items-baseline justify-between gap-4 py-2">
            <span>{member.name}{member.id === me?.id ? " (you)" : ""}</span>
            <span class="text-muted-foreground">{member.email}</span>
          </li>
        {/each}
      </ul>
      <Button class="mt-2 px-0" variant="link" href="/join">switch household</Button>
    </Card.Content>
  </Card.Root>

  <Card.Root>
    <Card.Header>
      <Card.Title class="flex items-center gap-2"><MapPin class="size-4" /> locations</Card.Title>
      <Card.Description>
        everywhere food lives. a place has to be empty before you can bin it, so move or finish what's in there
        first.
      </Card.Description>
    </Card.Header>
    <Card.Content>
      {#if placeError}
        <p class="text-destructive mb-2 text-sm">{placeError}</p>
      {/if}
      <ul class="divide-border divide-y text-sm">
        {#each places as place (place.id)}
          {@const count = counts.get(place.id) ?? 0}
          <li class="flex min-h-12 items-center justify-between gap-2 py-1" class:opacity-50={busy.includes(place.id)}>
            {#if renaming?.id === place.id}
              <form class="flex flex-1 items-center gap-2" onsubmit={saveRename}>
                <input
                  class="{field} min-w-0 flex-1"
                  aria-label="New name for {place.name}"
                  required
                  bind:value={renaming.name}
                />
                <Button type="submit" variant="ghost" size="icon" aria-label="Save" disabled={busy.includes(place.id)}>
                  <Check />
                </Button>
                <Button variant="ghost" size="icon" aria-label="Cancel" onclick={() => (renaming = null)}><X /></Button>
              </form>
            {:else}
              <a class="underline-offset-4 hover:underline" href="/locations/{place.id}">{place.name}</a>
              <div class="flex items-center gap-1">
                <span class="text-muted-foreground mr-2">{count} {count === 1 ? "item" : "items"}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Rename {place.name}"
                  disabled={busy.includes(place.id)}
                  onclick={() => startRename(place)}><Pencil /></Button
                >
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={count ? `${place.name} isn't empty yet` : `Bin ${place.name}`}
                  disabled={count > 0 || busy.includes(place.id)}
                  onclick={() => removePlace(place)}><Trash2 /></Button
                >
              </div>
            {/if}
          </li>
        {:else}
          <li class="text-muted-foreground py-2">nowhere to put anything yet</li>
        {/each}
      </ul>
    </Card.Content>
    <form onsubmit={addPlace}>
      <Card.Footer class="flex gap-2">
        <input class="{field} min-w-0 flex-1" placeholder="garage fridge" aria-label="New location" bind:value={newPlace} />
        <Button type="submit" disabled={adding || !house || !newPlace.trim()}><Plus /> add</Button>
      </Card.Footer>
    </form>
  </Card.Root>

  <Card.Root>
    <Card.Header>
      <Card.Title class="flex items-center gap-2"><Bell class="size-4" /> expiry alerts</Card.Title>
      <Card.Description>
        daily: every night we email the stuff that just came within 3 days of going off.
        weekly: one email on monday with everything due in the next 7 days.
        leave the address blank to turn alerts off.
      </Card.Description>
    </Card.Header>
    <form onsubmit={save}>
      <Card.Content>
        <input
          class="{field} w-full"
          type="email"
          placeholder="kitchen@example.com"
          bind:value={alertEmail}
          oninput={() => (saved = false)}
        />
        <select class="{field} mt-3" bind:value={frequency} onchange={() => (saved = false)}>
          <option value="daily">daily</option>
          <option value="weekly">weekly (mondays)</option>
        </select>
      </Card.Content>
      <Card.Footer class="flex items-center gap-3">
        <Button type="submit" disabled={saving || !house}>save</Button>
        {#if saved}
          <span class="text-muted-foreground text-sm">
            {house?.alert_email ? `${house.alert_frequency ?? "daily"} alerts go to ${house.alert_email}` : "alerts are off"}
          </span>
        {/if}
      </Card.Footer>
    </form>
  </Card.Root>

  <Card.Root>
    <Card.Header>
      <Card.Title class="flex items-center gap-2"><History class="size-4" /> sent alerts</Card.Title>
      <Card.Description>the last 30 emails we sent, newest first.</Card.Description>
    </Card.Header>
    <Card.Content>
      {#if history.length === 0}
        <p class="text-muted-foreground text-sm">nothing sent yet. the first one goes out after the nightly check.</p>
      {:else}
        <ul class="divide-border divide-y text-sm">
          {#each history as entry (entry.id)}
            <li class="flex items-baseline justify-between gap-4 py-2">
              <div>
                <p>{entry.subject}</p>
                <p class="text-muted-foreground">{entry.frequency} to {entry.sent_to}</p>
              </div>
              <time class="text-muted-foreground shrink-0">{when(entry.sent_at)}</time>
            </li>
          {/each}
        </ul>
      {/if}
    </Card.Content>
  </Card.Root>
</main>
