<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import LogIn from "@lucide/svelte/icons/log-in";

  import * as Card from "$lib/components/ui/card/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import ModeToggle from "$lib/components/mode-toggle.svelte";
  import { getMe, getToken, logIn, signUp } from "$lib/api";
  import { safeNext } from "$lib/session";

  let mode = $state<"login" | "signup">("login");
  let name = $state("");
  let email = $state("");
  let password = $state("");
  let error = $state("");
  let busy = $state(false);
  let next: string | null = null;

  const field = "border-input bg-background w-full rounded-md border px-3 py-2 text-sm";

  async function landing() {
    const me = await getMe();
    await goto(next ?? (me.household_id == null ? "/join" : "/"), { replaceState: true });
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    busy = true;
    error = "";
    try {
      if (mode === "signup") await signUp({ name, email, password });
      else await logIn({ email, password });
      await landing();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }

  function flip() {
    mode = mode === "login" ? "signup" : "login";
    error = "";
  }

  onMount(() => {
    next = safeNext(new URLSearchParams(location.search).get("next"));
    if (getToken()) landing().catch(() => {});
  });
</script>

<main class="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-8">
  <div class="flex items-center justify-between">
    <h1 class="text-3xl font-semibold tracking-tight">pantry</h1>
    <ModeToggle />
  </div>

  <Card.Root>
    <Card.Header>
      <Card.Title>{mode === "login" ? "welcome back" : "make an account"}</Card.Title>
      <Card.Description>
        {mode === "login"
          ? "log in to see what's in your kitchen."
          : "then start a household or join one with an invite code."}
      </Card.Description>
    </Card.Header>
    <form onsubmit={submit}>
      <Card.Content class="flex flex-col gap-3">
        {#if mode === "signup"}
          <input class={field} placeholder="your name" autocomplete="name" required bind:value={name} />
        {/if}
        <input class={field} type="email" placeholder="email" autocomplete="email" required bind:value={email} />
        <input
          class={field}
          type="password"
          placeholder={mode === "signup" ? "password (8+ characters)" : "password"}
          autocomplete={mode === "signup" ? "new-password" : "current-password"}
          minlength={mode === "signup" ? 8 : undefined}
          required
          bind:value={password}
        />
        {#if error}
          <p class="text-destructive text-sm">{error}</p>
        {/if}
      </Card.Content>
      <Card.Footer class="flex flex-col items-stretch gap-2 pt-6">
        <Button type="submit" disabled={busy}>
          <LogIn />
          {mode === "login" ? "log in" : "sign up"}
        </Button>
        <Button type="button" variant="link" onclick={flip}>
          {mode === "login" ? "new here? make an account" : "already have one? log in"}
        </Button>
      </Card.Footer>
    </form>
  </Card.Root>
</main>
