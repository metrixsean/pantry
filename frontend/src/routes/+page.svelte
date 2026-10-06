<script lang="ts">
  import { onMount } from "svelte";

  import * as Card from "$lib/components/ui/card/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import ModeToggle from "$lib/components/mode-toggle.svelte";
  import { addItem, getItems, getLocations, type Item, type Location } from "$lib/api";

  let locations = $state<Location[]>([]);
  let items = $state<Item[]>([]);
  let error = $state("");

  let name = $state("");
  let quantity = $state(1);
  let unit = $state("");
  let expiresOn = $state("");
  let locationId = $state<number | undefined>();

  const field = "border-input bg-background rounded-md border px-3 py-2 text-sm";

  function locationName(id: number) {
    return locations.find((l) => l.id === id)?.name ?? "?";
  }

  async function load() {
    try {
      [locations, items] = await Promise.all([getLocations(), getItems()]);
      locationId ??= locations[0]?.id;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (locationId === undefined) return;
    try {
      await addItem({
        name,
        quantity,
        location_id: locationId,
        unit: unit || undefined,
        expires_on: expiresOn || null,
      });
      name = unit = expiresOn = "";
      quantity = 1;
      await load();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  onMount(load);
</script>

<main class="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-8">
  <div class="flex items-center justify-between">
    <h1 class="text-3xl font-semibold tracking-tight">pantry</h1>
    <ModeToggle />
  </div>

  {#if error}
    <p class="text-destructive text-sm">{error}</p>
  {/if}

  <Card.Root>
    <Card.Header>
      <Card.Title>in stock</Card.Title>
      <Card.Description>soonest to expire first</Card.Description>
    </Card.Header>
    <Card.Content>
      {#if items.length === 0}
        <p class="text-muted-foreground text-sm">nothing here yet</p>
      {:else}
        <ul class="divide-border divide-y">
          {#each items as item (item.id)}
            <li class="flex items-baseline justify-between py-2">
              <span>{item.name}</span>
              <span class="text-muted-foreground text-sm">
                {item.quantity} {item.unit} · {locationName(item.location_id)}
                {#if item.expires_on}· {item.expires_on}{/if}
              </span>
            </li>
          {/each}
        </ul>
      {/if}
    </Card.Content>
  </Card.Root>

  <Card.Root>
    <Card.Header>
      <Card.Title>add an item</Card.Title>
    </Card.Header>
    <form onsubmit={submit}>
      <Card.Content class="grid grid-cols-2 gap-3">
        <input class={field} placeholder="name" required bind:value={name} />
        <select class={field} required bind:value={locationId}>
          {#each locations as l (l.id)}
            <option value={l.id}>{l.name}</option>
          {/each}
        </select>
        <input class={field} type="number" min="0" step="any" required bind:value={quantity} />
        <input class={field} placeholder="unit" bind:value={unit} />
        <input class={field} type="date" bind:value={expiresOn} />
      </Card.Content>
      <Card.Footer>
        <Button type="submit" disabled={locationId === undefined}>add</Button>
      </Card.Footer>
    </form>
  </Card.Root>
</main>
