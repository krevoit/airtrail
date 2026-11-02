<script lang="ts">
  import { LoaderCircle, TowerControl } from '@o7/icon/lucide';
  import { onMount } from 'svelte';
  import { toast } from 'svelte-sonner';
  import { superForm } from 'sveltekit-superforms';
  import { zod4 as zod } from 'sveltekit-superforms/adapters';

  import type { PageProps } from './$types';

  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import * as Alert from '$lib/components/ui/alert';
  import { Button } from '$lib/components/ui/button';
  import * as Form from '$lib/components/ui/form';
  import { Input, PasswordInput } from '$lib/components/ui/input';
  import { AcrobaticLoader } from '$lib/components/ui/loader';
  import RouteGlobe from '$lib/components/recap/RouteGlobe.svelte';
  import type { LonLat, MapRoute } from '$lib/components/recap/geo';
  import { api } from '$lib/trpc';
  import { isOAuthCallback } from '$lib/utils';
  import { signInSchema } from '$lib/zod/auth';

  const { data }: PageProps = $props();

  // Decoration for the sign-in page: a few long-haul routes.
  const PLACES: Record<string, LonLat> = {
    LHR: [-0.46, 51.47],
    JFK: [-73.78, 40.64],
    SIN: [103.99, 1.36],
    SYD: [151.18, -33.94],
    LAX: [-118.41, 33.94],
    DXB: [55.36, 25.25],
    HND: [139.78, 35.55],
    GRU: [-46.47, -23.43],
    JNB: [28.24, -26.13],
    CDG: [2.55, 49.01],
  };
  const showcaseRoutes: MapRoute[] = [
    ['LHR', 'JFK'],
    ['LHR', 'SIN'],
    ['SIN', 'SYD'],
    ['SYD', 'LAX'],
    ['LAX', 'HND'],
    ['HND', 'SIN'],
    ['DXB', 'LHR'],
    ['DXB', 'JNB'],
    ['GRU', 'CDG'],
    ['JFK', 'GRU'],
  ].map(([from, to]) => ({ from: PLACES[from!]!, to: PLACES[to!]!, count: 1 }));
  const showcaseAirports = Object.values(PLACES);
  const isSetup = data.isSetup;
  let appConfig = $state(data.appConfig);

  let oauthLoading = $state(true);
  let autoLoggingIn = $state(false);
  let oauthLinkRequired = $state(false);

  onMount(async () => {
    if (!isSetup) {
      await goto('/setup');
      return;
    }

    if (!appConfig) {
      oauthLoading = false;
      return;
    }

    if (!appConfig.oauth.enabled) {
      oauthLoading = false;
      appConfig.oauth.autoLogin = false;
      return;
    }

    if (isOAuthCallback(page.url.search)) {
      oauthLoading = true;
      const resp = await fetch('/api/oauth/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: window.location.toString() }),
      });

      if (!resp.ok) {
        const err: {
          code?: string;
          username?: string;
          linkToken?: string;
          message?: string;
        } = await resp.json();
        if (
          resp.status === 409 &&
          err.code === 'oauth_link_required' &&
          err.username &&
          err.linkToken
        ) {
          $formData.username = err.username;
          $formData.oauthLinkToken = err.linkToken;
          oauthLinkRequired = true;
          oauthLoading = false;
          window.history.replaceState({}, '', '/login');
          return;
        }

        await goto('/login', { replaceState: true }); // clear potential query params
        toast.error(err.message ?? 'OAuth login failed');
        oauthLoading = false;
        return;
      }

      const result: { redirectTo?: string } = await resp.json();
      await goto(result.redirectTo ?? '/', { invalidateAll: true });
      return;
    }

    if (
      appConfig.oauth.autoLogin &&
      !window.location.search.includes('autoLogin=false')
    ) {
      autoLoggingIn = true;
      await goto('/login?autoLogin=false', { replaceState: true });
      await oauthLogin();
      return;
    }

    oauthLoading = false;
  });

  const form = superForm(data.form, {
    validators: zod(signInSchema),
    onUpdated({ form }) {
      if (form.message) {
        toast.error(form.message.text);
      }
    },
  });
  const { form: formData, enhance, submitting } = form;

  const oauthLogin = async () => {
    oauthLoading = true;
    const redirect = window.location.toString().split('?')[0];
    if (!redirect) return;

    try {
      const resp = await api.oauth.authorize.mutate(redirect);
      window.location.href = resp.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'OAuth login failed');
      oauthLoading = false;
    }
  };

  let showLoader = $derived.by(() => {
    if (oauthLinkRequired) return false;

    return (
      (autoLoggingIn || !page.url.search.includes('autoLogin=false')) &&
      (!appConfig ||
        appConfig.oauth.autoLogin ||
        isOAuthCallback(page.url.search))
    );
  });
</script>

{#if !showLoader}
  <div class="h-full grid lg:grid-cols-2">
    <div class="flex items-center justify-center">
      <div class="mx-auto grid w-[350px] gap-6">
        <div class="grid gap-2 text-center">
          <div class="mb-4 flex items-center justify-center gap-2">
            <span
              class="flex size-10 items-center justify-center rounded-xl bg-primary/12 text-primary dark:bg-primary/20"
            >
              <TowerControl size={22} />
            </span>
            <span class="text-xl font-bold tracking-tight">AirTrail</span>
          </div>
          <h1 class="text-3xl font-bold tracking-tight">
            {page.data.demo ? 'Welcome to AirTrail' : 'Welcome back'}
          </h1>
          <p class="text-muted-foreground text-balance">
            {#if page.data.demo}
              This is a demo of AirTrail, filled with a frequent flyer's
              history. Jump straight in, no account needed.
            {:else if !appConfig?.oauth.enabled}
              Sign in with your username and password.
            {:else}
              Sign in to see your flights.
            {/if}
          </p>
        </div>
        {#if page.data.demo}
          <Button href="/demo" data-sveltekit-reload size="lg">
            Explore the demo
          </Button>
          <p class="-mt-2 text-center text-sm text-muted-foreground">
            Or log in below. Every demo account's password is
            <code>airtrail-demo</code>.
          </p>
        {/if}
        {#if oauthLinkRequired || !(appConfig?.oauth.enabled && appConfig.oauth.hidePasswordForm)}
          {#if oauthLinkRequired}
            <Alert.Root variant="info">
              <Alert.Description>
                Log in with your AirTrail password to link this OAuth account.
              </Alert.Description>
            </Alert.Root>
          {/if}
          <form
            use:enhance
            action="/api/users/login"
            method="POST"
            class="grid gap-4"
          >
            <input
              type="hidden"
              name="oauthLinkToken"
              value={$formData.oauthLinkToken ?? ''}
            />
            <Form.Field {form} name="username">
              <Form.Control>
                {#snippet children({ props })}
                  <Form.Label>Username</Form.Label>
                  <Input {...props} bind:value={$formData.username} />
                {/snippet}
              </Form.Control>
              <Form.FieldErrors />
            </Form.Field>
            <Form.Field {form} name="password">
              <Form.Control>
                {#snippet children({ props })}
                  <Form.Label>Password</Form.Label>
                  <PasswordInput {...props} bind:value={$formData.password} />
                {/snippet}
              </Form.Control>
              <Form.FieldErrors />
            </Form.Field>
            <Form.Button disabled={$submitting || oauthLoading} size="lg">
              {#if $submitting}
                <LoaderCircle class="animate-spin mr-1" size="18" />
              {/if}
              Log in
            </Form.Button>
          </form>
        {/if}
        {#if appConfig?.oauth.enabled && !oauthLinkRequired}
          <Button
            onclick={oauthLogin}
            disabled={oauthLoading}
            size="lg"
            variant={appConfig.oauth.hidePasswordForm ? 'default' : 'outline'}
          >
            {#if oauthLoading}
              <LoaderCircle class="animate-spin mr-1" size={16} />
            {/if}
            {appConfig.oauth.buttonText}
          </Button>
        {/if}
      </div>
    </div>
    <div class="relative hidden p-3 lg:flex">
      <div
        class="relative flex flex-1 flex-col items-center justify-center overflow-hidden rounded-3xl border bg-muted/40"
      >
        <div
          class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--primary)_0%,transparent_65%)] opacity-[0.07]"
        ></div>
        <div class="w-full max-w-[520px] px-10 pb-24">
          <RouteGlobe
            routes={showcaseRoutes}
            airports={showcaseAirports}
            countries={new Set()}
          />
        </div>
        <div class="absolute inset-x-0 bottom-10 px-10 text-center">
          <p class="text-xl font-semibold tracking-tight">
            Every flight you've taken, on one map.
          </p>
          <p class="mt-1 text-sm text-muted-foreground">
            Your routes, your stats and your year in flights, on your own
            server.
          </p>
        </div>
      </div>
    </div>
  </div>
{:else}
  <div class="h-full flex items-center justify-center">
    <AcrobaticLoader />
  </div>
{/if}
