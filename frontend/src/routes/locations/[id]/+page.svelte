<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import CalendarX from "@lucide/svelte/icons/calendar-x";
  import Check from "@lucide/svelte/icons/check";
  import Minus from "@lucide/svelte/icons/minus";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import X from "@lucide/svelte/icons/x";
  import { Button } from "$lib/components/ui/button/index.js";
  import { consumeItem, deleteItem, getItems, getLocations, updateItem, type Item, type Location } from "$lib/api";
  import { requireHousehold } from "$lib/session";

  const id = Number(page.params.id);

  let place = $state<Location | null>();
  let places = $state<Location[]>([]);
  let items = $state<Item[]>([]);
  let saving = $state<number[]>([]);
  let error = $state("");
  let note = $state<{ text: string; shopping?: boolean } | null>(null);
  let draft = $state<{ id: number; name: string; unit: string; expires_on: string; location_id: number } | null>(
    null,
  );

  const field = "border-input bg-background rounded-md border px-2 py-1 text-sm";

  function fail(e: unknown) {
    error = e instanceof Error ? e.message : String(e);
  }

  function placeName(location_id: number) {
    return places.find((l) => l.id === location_id)?.name ?? "somewhere else";
  }

  onMount(async () => {
    try {
      if (!(await requireHousehold())) return;
      const [locations, rows] = await Promise.all([getLocations(), getItems({ location_id: id })]);
      places = locations;
      place = locations.find((l) => l.id === id) ?? null;
      items = rows;
    } catch (e) {
      fail(e);
    }
  });

  async function setQuantity(item: Item, quantity: number): Promise<boolean> {
    if (quantity === item.quantity) return true;
    if (!Number.isFinite(quantity) || quantity < 0) return false;
    error = "";
    note = null;
    saving.push(item.id);
    try {
      const updated = await updateItem({ id: item.id, quantity });
      items = items.map((i) => (i.id === item.id ? { ...i, ...updated } : i));
      if (updated.quantity <= 0 && item.quantity > 0) {
        note = { text: `${updated.name} is all gone, it's on the shopping list`, shopping: true };
      }
      return true;
    } catch (e) {
      fail(e);
      return false;
    } finally {
      saving = saving.filter((s) => s !== item.id);
    }
  }

  async function consume(item: Item) {
    error = "";
    note = null;
    saving.push(item.id);
    try {
      const { item: updated, listed } = await consumeItem({ id: item.id });
      items = items.map((i) => (i.id === item.id ? { ...i, ...updated } : i));
      if (updated.quantity <= 0) {
        note = {
          text: listed
            ? `that was the last ${item.name}, it's on the shopping list now`
            : `that was the last ${item.name}, it was already on the shopping list`,
          shopping: true,
        };
      }
    } catch (e) {
      fail(e);
    } finally {
      saving = saving.filter((s) => s !== item.id);
    }
  }

  async function move(item: Item, location_id: number) {
    if (location_id === item.location_id) return;
    error = "";
    note = null;
    saving.push(item.id);
    try {
      const updated = await updateItem({ id: item.id, location_id });
      items = items.filter((i) => i.id !== item.id);
      note = { text: `moved ${updated.name} to ${placeName(location_id)}` };
    } catch (e) {
      fail(e);
    } finally {
      saving = saving.filter((s) => s !== item.id);
    }
  }

  function edit(item: Item) {
    error = "";
    draft = {
      id: item.id,
      name: item.name,
      unit: item.unit ?? "",
      expires_on: item.expires_on ?? "",
      location_id: item.location_id,
    };
  }

  async function saveEdit(e: SubmitEvent) {
    e.preventDefault();
    if (!draft) return;
    const { id, expires_on, location_id } = draft;
    const name = draft.name.trim();
    if (!name) return fail("name it something");
    error = "";
    note = null;
    saving.push(id);
    try {
      const updated = await updateItem({
        id,
        name,
        unit: draft.unit.trim(),
        expires_on: expires_on || null,
        clear_expiry: !expires_on,
        location_id,
      });
      if (updated.location_id === place?.id) {
        items = items.map((i) => (i.id === id ? { ...i, ...updated } : i));
      } else {
        items = items.filter((i) => i.id !== id);
        note = { text: `moved ${updated.name} to ${placeName(updated.location_id)}` };
      }
      draft = null;
    } catch (e) {
      fail(e);
    } finally {
      saving = saving.filter((s) => s !== id);
    }
  }

  async function remove(item: Item) {
    if (!confirm(`bin ${item.name}?`)) return;
    error = "";
    try {
      await deleteItem(item.id);
      items = items.filter((i) => i.id !== item.id);
    } catch (e) {
      fail(e);
    }
  }
</script>

<main class="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-8">
  <div class="flex items-center gap-2">
    <Button variant="ghost" size="icon" href="/" aria-label="Back to stock"><ArrowLeft /></Button>
    <h1 class="text-3xl font-semibold tracking-tight">{place?.name ?? "…"}</h1>
  </div>

  {#if error}
    <p class="text-destructive text-sm">{error}</p>
  {:else if note}
    <p class="text-muted-foreground text-sm">
      {note.text}
      {#if note.shopping}
        <a class="text-foreground underline underline-offset-4" href="/shopping">see the list</a>
      {/if}
    </p>
  {/if}

  {#if place === null}
    <p class="text-muted-foreground text-sm">no such place in this kitchen</p>
  {:else if place}
    <table class="w-full text-sm">
      <thead class="text-muted-foreground text-left">
        <tr>
          <th class="py-2 font-medium">item</th>
          <th class="py-2 font-medium">quantity</th>
          <th class="py-2 font-medium">expires</th>
          <th></th>
        </tr>
      </thead>
      <tbody class="divide-border divide-y">
        {#each items as item (item.id)}
          <tr class:opacity-50={saving.includes(item.id)}>
            {#if draft?.id === item.id}
              <td colspan="4" class="py-2">
                <form class="flex flex-wrap items-center gap-2" onsubmit={saveEdit}>
                  <input class="{field} min-w-0 flex-1" aria-label="Name" required bind:value={draft.name} />
                  <input class="{field} w-20" aria-label="Unit" placeholder="unit" bind:value={draft.unit} />
                  <input class={field} type="date" aria-label="Expires on" bind:value={draft.expires_on} />
                  {#if draft.expires_on}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Never expires"
                      title="never expires"
                      onclick={() => draft && (draft.expires_on = "")}><CalendarX /></Button
                    >
                  {/if}
                  <select class={field} aria-label="Lives in" bind:value={draft.location_id}>
                    {#each places as l (l.id)}
                      <option value={l.id}>{l.name}</option>
                    {/each}
                  </select>
                  <Button
                    type="submit"
                    variant="ghost"
                    size="icon"
                    aria-label="Save"
                    disabled={saving.includes(item.id)}><Check /></Button
                  >
                  <Button variant="ghost" size="icon" aria-label="Cancel" onclick={() => (draft = null)}><X /></Button>
                </form>
              </td>
            {:else}
              <td class="py-2">{item.name}</td>
              <td class="py-2">
                <div class="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="One less {item.name}"
                    disabled={item.quantity <= 0 || saving.includes(item.id)}
                    onclick={() => consume(item)}><Minus /></Button
                  >
                  <input
                    class="{field} w-20"
                    type="number"
                    min="0"
                    step="any"
                    aria-label="Quantity of {item.name}"
                    value={item.quantity}
                    disabled={saving.includes(item.id)}
                    onchange={async (e) => {
                      const input = e.currentTarget;
                      if (!(await setQuantity(item, input.valueAsNumber))) input.value = String(item.quantity);
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="One more {item.name}"
                    disabled={saving.includes(item.id)}
                    onclick={() => setQuantity(item, item.quantity + 1)}><Plus /></Button
                  >
                  <span class="text-muted-foreground">{item.unit}</span>
                </div>
              </td>
              <td class="py-2" class:text-destructive={item.expiring}>{item.expires_on ?? ""}</td>
              <td class="py-2 text-right whitespace-nowrap">
                <select
                  class={field}
                  aria-label="Move {item.name} to"
                  value={item.location_id}
                  disabled={saving.includes(item.id)}
                  onchange={(e) => move(item, Number(e.currentTarget.value))}
                >
                  {#each places as l (l.id)}
                    <option value={l.id}>{l.name}</option>
                  {/each}
                </select>
                <Button variant="ghost" size="icon" aria-label="Edit {item.name}" onclick={() => edit(item)}>
                  <Pencil />
                </Button>
                <Button variant="ghost" size="icon" aria-label="Bin {item.name}" onclick={() => remove(item)}>
                  <Trash2 />
                </Button>
              </td>
            {/if}
          </tr>
        {:else}
          <tr>
            <td colspan="4" class="text-muted-foreground py-2">
              nothing in here. don't need it any more?
              <a class="text-foreground underline underline-offset-4" href="/settings">bin it in settings</a>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</main>
