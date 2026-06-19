<script lang="ts">
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import { facetById, facetFilterHref, loadFacetValues, type FacetDef } from '$lib/facets';
	import type { FacetValue } from '$lib/types';
	import Loading from '$lib/components/Loading.svelte';
	import ExploreRail from '$lib/components/ExploreRail.svelte';
	import SearchIcon from '$lib/components/SearchIcon.svelte';

	type FacetSort = 'officers' | 'officers-asc' | 'current' | 'label' | 'label-desc';

	let values = $state<FacetValue[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let q = $state('');
	let sort = $state<FacetSort>('officers');
	let limit = $state(80);

	let facet = $derived<FacetDef | undefined>(facetById(page.params.facet ?? ''));

	$effect(() => {
		const f = facet;
		loading = true;
		error = null;
		values = [];
		if (!f) {
			loading = false;
			error = 'Unknown category.';
			return;
		}
		loadFacetValues(f)
			.then((rows) => {
				if (facet === f) values = rows;
			})
			.catch((e) => (error = e instanceof Error ? e.message : String(e)))
			.finally(() => {
				if (facet === f) loading = false;
			});
	});

	const filtered = $derived.by(() => {
		const needle = q.trim().toLowerCase();
		const matched = needle ? values.filter((v) => v.label.toLowerCase().includes(needle)) : values;
		const list = [...matched];
		switch (sort) {
			case 'officers-asc':
				return list.sort((a, b) => a.totalOfficers - b.totalOfficers);
			case 'current':
				return list.sort(
					(a, b) => b.currentCount - a.currentCount || b.totalOfficers - a.totalOfficers
				);
			case 'label':
				return list.sort((a, b) => a.label.localeCompare(b.label));
			case 'label-desc':
				return list.sort((a, b) => b.label.localeCompare(a.label));
			default:
				return list.sort((a, b) => b.totalOfficers - a.totalOfficers);
		}
	});
	const shown = $derived(filtered.slice(0, limit));
	const numberFmt = new Intl.NumberFormat('en-IN');

	$effect(() => {
		void [q, sort];
		limit = 80;
	});
</script>

<svelte:head>
	<title>{facet ? `${facet.label} — IAS Directory` : 'Explore'}</title>
</svelte:head>

<ExploreRail />

<div class="mx-auto max-w-6xl px-5 py-8">
	{#if facet}
		<header class="border-b border-ink pb-6">
			<h1 class="font-display text-3xl font-semibold text-ink sm:text-4xl">{facet.label}</h1>
		</header>

		<div class="mt-6 flex items-center gap-3 border-b border-line pb-2">
			<SearchIcon class="h-4 w-4" />
			<label for="facet-search" class="sr-only">Search {facet.label}</label>
			<input
				id="facet-search"
				type="search"
				bind:value={q}
				placeholder="Search {facet.label.toLowerCase()}…"
				class="w-full bg-transparent py-1 text-ink placeholder:text-faint focus:outline-none"
			/>
		</div>

		{#if loading}
			<Loading message="Compiling…" />
		{:else if error}
			<div class="mt-6 border border-accent/40 bg-accent-soft p-6 text-accent-dark">
				<p class="font-semibold">{error}</p>
			</div>
		{:else}
			<div class="mt-4 flex flex-wrap items-center justify-between gap-3">
				<p class="text-sm text-muted">
					<span class="font-medium text-ink">{numberFmt.format(filtered.length)}</span>
					{filtered.length === 1 ? facet.singular.toLowerCase() : 'entries'}
				</p>
				<label class="flex items-center gap-2 text-sm">
					<span class="text-muted">Sort</span>
					<select
						bind:value={sort}
						class="border border-line bg-card px-2 py-1.5 text-sm font-medium text-ink"
					>
						<option value="officers">Most officers</option>
						<option value="officers-asc">Fewest officers</option>
						<option value="current">Most currently serving</option>
						<option value="label">Name (A–Z)</option>
						<option value="label-desc">Name (Z–A)</option>
					</select>
				</label>
			</div>

			<ul class="mt-3 divide-y divide-line border-y border-line">
				{#each shown as v (v.slug)}
					<li>
						<a
							href="{base}{facetFilterHref(facet.id, v.label)}"
							class="group flex items-center justify-between gap-4 py-3.5 transition-colors hover:bg-paper-dim"
						>
							<span
								class="min-w-0 font-display text-lg font-medium text-ink transition-colors group-hover:text-accent"
							>
								{v.label}
							</span>
							<span
								class="flex shrink-0 items-baseline gap-4 font-mono text-xs text-muted tabular-nums"
							>
								{#if v.currentCount > 0}
									<span class="text-serving">{numberFmt.format(v.currentCount)} serving</span>
								{/if}
								<span>{numberFmt.format(v.totalOfficers)} officers</span>
							</span>
						</a>
					</li>
				{/each}
			</ul>

			{#if shown.length < filtered.length}
				<div class="mt-6 text-center">
					<button type="button" class="btn-ghost" onclick={() => (limit += 80)}>Show more</button>
				</div>
			{/if}
		{/if}
	{:else}
		<div class="mt-6 border border-line bg-card p-12 text-center">
			<p class="font-display text-2xl text-ink">Unknown category</p>
			<a href="{base}/" class="btn-primary mt-5">Back to the directory</a>
		</div>
	{/if}
</div>
