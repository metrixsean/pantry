<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import Ticket from "@lucide/svelte/icons/ticket";
  import House from "@lucide/svelte/icons/house";

  import * as Card from "$lib/components/ui/card/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import ModeToggle from "$lib/components/mode-toggle.svelte";
  import { joinHousehold, signOut, startHousehold, type Me } from "$lib/api";
  import { requireUser } from "$lib/session";

  let me = $state<Me | null>(null);
  let code = $state("");
  let houseName = $state("");
  let error = $state("");
  let busy = $state(false);

  const field = "border-input bg-background w-full rounded-md border px-3 py-2 text-sm";

  async function run(event: SubmitEvent, action: () => Promise<unknown>) {
    event.preventDefault();
    busy = true;
    error = "";
    try {
      await action();
      await goto("/");
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }

  async function leave() {
    signOut();
    await goto("/login");
  }

  onMount(async () => {
    code = new URLSearchParams(location.search).get("code") ?? "";
    try {
      me = await requireUser();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  });
</script>

<main class="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-8">
  <div class="flex items-center justify-between">
    <h1 class="text-3xl font-semibold tracking-tight">pantry</h1>
    <ModeToggle />
  </div>

  <p class="text-muted-foreground text-sm">
    {#if me}
      hey {me.name}.
      {me.household_id == null
        ? "pick a kitchen to share."
        : "you're already in a household, joining another one moves you over."}
    {:else}
      …
    {/if}
  </p>

  {#if error}
    <p class="text-destructive text-sm">{error}</p>
  {/if}

  <Card.Root>
    <Card.Header>
      <Card.Title class="flex items-center gap-2"><Ticket class="size-4" /> got an invite code?</Card.Title>
      <Card.Description>someone in the household can find it on their settings page.</Card.Description>
    </Card.Header>
    <form onsubmit={(e) => run(e, () => joinHousehold({ invite_code: code }))}>
      <Card.Content>
        <input class="{field} font-mono" placeholder="invite code" autocomplete="off" required bind:value={code} />
      </Card.Content>
      <Card.Footer class="pt-6">
        <Button type="submit" disabled={busy || !me}>join</Button>
      </Card.Footer>
    </form>
  </Card.Root>

  <Card.Root>
    <Card.Header>
      <Card.Title class="flex items-center gap-2"><House class="size-4" /> starting fresh?</Card.Title>
      <Card.Description>you get a pantry, a fridge and a freezer, plus a code to hand out.</Card.Description>
    </Card.Header>
    <form onsubmit={(e) => run(e, () => startHousehold({ name: houseName }))}>
      <Card.Content>
        <input class={field} placeholder="household name, like flat 4" required bind:value={houseName} />
      </Card.Content>
      <Card.Footer class="pt-6">
        <Button type="submit" variant="secondary" disabled={busy || !me}>start a household</Button>
      </Card.Footer>
    </form>
  </Card.Root>

  <Button variant="link" onclick={leave}>not you? log out</Button>
</main>
