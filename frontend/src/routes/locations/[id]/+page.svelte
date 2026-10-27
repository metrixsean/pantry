<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import Minus from "@lucide/svelte/icons/minus";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import { Button } from "$lib/components/ui/button/index.js";
  import { deleteItem, getItems, getLocations, updateItem, type Item, type Location } from "$lib/api";
  import { requireHousehold } from "$lib/session";

  const id = Number(page.params.id);

  let place = $state<Location | null>();
  let items = $state<Item[]>([]);
  let saving = $state<number[]>([]);
  let error = $state("");

  const field = "border-input bg-background rounded-md border px-2 py-1 text-sm";

  function fail(e: unknown) {
    error = e instanceof Error ? e.message : String(e);
  }

  onMount(async () => {
    try {
      if (!(await requireHousehold())) return;
      const [locations, rows] = await Promise.all([getLocations(), getItems({ location_id: id })]);
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
    saving.push(item.id);
    try {
      const updated = await updateItem({ id: item.id, quantity });
      items = items.map((i) => (i.id === item.id ? { ...i, ...updated } : i));
      return true;
    } catch (e) {
      fail(e);
      return false;
    } finally {
      saving = saving.filter((s) => s !== item.id);
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
            <td class="py-2">{item.name}</td>
            <td class="py-2">
              <div class="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="One less {item.name}"
                  disabled={item.quantity <= 0 || saving.includes(item.id)}
                  onclick={() => setQuantity(item, Math.max(0, item.quantity - 1))}><Minus /></Button
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
            <td class="py-2 text-right">
              <Button variant="ghost" size="icon" aria-label="Bin {item.name}" onclick={() => remove(item)}>
                <Trash2 />
              </Button>
            </td>
          </tr>
        {:else}
          <tr><td colspan="4" class="text-muted-foreground py-2">nothing in here</td></tr>
        {/each}
      </tbody>
    </table>
  {/if}
</main>
