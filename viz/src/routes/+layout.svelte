<script lang="ts">
	import '@fontsource-variable/fraunces/opsz.css';
	import '@fontsource-variable/fraunces/opsz-italic.css';
	import '@fontsource-variable/nunito/index.css';
	import '@fontsource/iosevka/400.css';
	import '@fontsource/iosevka/500.css';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import SiteHeader from '$lib/components/SiteHeader.svelte';
	import SiteFooter from '$lib/components/SiteFooter.svelte';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<a
	href="#main-content"
	class="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
>
	Skip to main content
</a>

<div class="flex min-h-screen flex-col bg-paper">
	<SiteHeader />
	<main id="main-content" class="flex-1">
		{@render children()}
	</main>
	<SiteFooter />
</div>
