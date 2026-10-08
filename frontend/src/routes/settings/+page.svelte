<script lang="ts">
  import { onMount } from "svelte";
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import Bell from "@lucide/svelte/icons/bell";

  import * as Card from "$lib/components/ui/card/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import ModeToggle from "$lib/components/mode-toggle.svelte";
  import { getHouseholdSettings, setAlertEmail, type Household } from "$lib/api";

  let house = $state<Household | undefined>();
  let alertEmail = $state("");
  let error = $state("");
  let saved = $state(false);
  let saving = $state(false);

  const field = "border-input bg-background rounded-md border px-3 py-2 text-sm";

  async function load() {
    try {
      house = await getHouseholdSettings();
      alertEmail = house.alert_email ?? "";
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
      house = await setAlertEmail(alertEmail.trim() || null);
      alertEmail = house.alert_email ?? "";
      saved = true;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      saving = false;
    }
  }

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
    <ModeToggle />
  </div>

  {#if error}
    <p class="text-destructive text-sm">{error}</p>
  {/if}

  <Card.Root>
    <Card.Header>
      <Card.Title>{house?.name ?? "household"}</Card.Title>
      <Card.Description>
        invite code: <span class="text-foreground font-mono">{house?.invite_code ?? "…"}</span>
      </Card.Description>
    </Card.Header>
  </Card.Root>

  <Card.Root>
    <Card.Header>
      <Card.Title class="flex items-center gap-2"><Bell class="size-4" /> expiry alerts</Card.Title>
      <Card.Description>
        every night we check for stuff that goes off within 3 days and email the new ones here.
        leave it blank to turn alerts off.
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
      </Card.Content>
      <Card.Footer class="flex items-center gap-3">
        <Button type="submit" disabled={saving || !house}>save</Button>
        {#if saved}
          <span class="text-muted-foreground text-sm">
            {house?.alert_email ? `alerts go to ${house.alert_email}` : "alerts are off"}
          </span>
        {/if}
      </Card.Footer>
    </form>
  </Card.Root>
</main>
