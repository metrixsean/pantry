<script lang="ts">
  import Monitor from "@lucide/svelte/icons/monitor";
  import Moon from "@lucide/svelte/icons/moon";
  import Sun from "@lucide/svelte/icons/sun";

  import { Button } from "$lib/components/ui/button/index.js";
  import { getMode, setMode, watchMode, type Mode } from "$lib/theme.js";

  /** system → light → dark → system. */
  const next: Record<Mode, Mode> = { system: "light", light: "dark", dark: "system" };

  const icons = {
    system: Monitor,
    light: Sun,
    dark: Moon,
  };

  // Starts at "system" so the prerendered HTML is deterministic; the effect
  // corrects it in the browser, after the inline script has already applied
  // the right class.
  let mode = $state<Mode>("system");

  $effect(() => {
    mode = getMode();
    return watchMode((m) => (mode = m));
  });

  function change() {
    const target = next[mode];
    setMode(target);
    mode = target;
  }

  const Icon = $derived(icons[mode]);
</script>

<Button variant="ghost" size="icon" onclick={change} aria-label="Switch to {next[mode]} theme">
  <Icon />
</Button>
