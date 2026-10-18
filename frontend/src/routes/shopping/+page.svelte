<script lang="ts">
  import { onMount } from "svelte";
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import { Button } from "$lib/components/ui/button/index.js";
  import { addShopping, getLocations, getShopping, restock, type Location, type ShoppingEntry } from "$lib/api";
  import { requireHousehold } from "$lib/session";

  let entries = $state<ShoppingEntry[]>([]);
  let locations = $state<Location[]>([]);
  let locationId = $state<number>();
  let expiresOn = $state("");
  let name = $state("");
  let error = $state("");

  const field = "border-input bg-background rounded-md border px-3 py-2 text-sm";

  async function run(fn: () => Promise<unknown>) {
    error = "";
    try {
      await fn();
      entries = await getShopping();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  onMount(() =>
    run(async () => {
      if (!(await requireHousehold())) return;
      locations = await getLocations();
      locationId = locations[0]?.id;
    }),
  );

  const add = (e: SubmitEvent) => {
    e.preventDefault();
    run(() => addShopping({ name }).then(() => (name = "")));
  };

  const tick = (entry: ShoppingEntry) =>
    locationId && run(() => restock({ id: entry.id, location_id: locationId!, expires_on: expiresOn || null }));
</script>

<main class="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-8">
  <div class="flex items-center gap-2">
    <Button variant="ghost" size="icon" href="/" aria-label="Back to stock"><ArrowLeft /></Button>
    <h1 class="text-3xl font-semibold tracking-tight">shopping</h1>
  </div>

  {#if error}
    <p class="text-destructive text-sm">{error}</p>
  {/if}

  <form class="flex gap-2" onsubmit={add}>
    <input class="{field} flex-1" placeholder="oat milk" bind:value={name} required />
    <Button type="submit">add</Button>
  </form>

  <p class="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
    ticked stuff goes into
    <select class={field} bind:value={locationId}>
      {#each locations as loc (loc.id)}<option value={loc.id}>{loc.name}</option>{/each}
    </select>
    expiring
    <input class={field} type="date" bind:value={expiresOn} />
  </p>

  <ul class="divide-border divide-y text-sm">
    {#each entries as entry (entry.id)}
      <li class="flex items-center gap-3 py-2" class:text-muted-foreground={entry.done}>
        <input type="checkbox" checked={entry.done} disabled={entry.done} onchange={() => tick(entry)} />
        <span class:line-through={entry.done}>{entry.name}</span>
        {#if entry.quantity}<span class="text-muted-foreground">× {entry.quantity}</span>{/if}
      </li>
    {:else}
      <li class="text-muted-foreground py-2">nothing to buy 🎉</li>
    {/each}
  </ul>
</main>
