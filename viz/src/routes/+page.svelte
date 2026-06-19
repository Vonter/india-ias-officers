<script lang="ts">
	import Fuse from 'fuse.js';
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { canonicalKey } from '$lib/canonical';
	import { loadDepartmentKeys, loadEducationKeys, loadOfficers, loadPositionKeys } from '$lib/data';
	import { facetById, loadFacetValues } from '$lib/facets';
	import {
		activeFilterCount,
		cadreOptions,
		clearFilters,
		compareOfficers,
		distinctValues,
		emptyFilters,
		officerMatches,
		SORT_OPTIONS,
		yearOptions,
		type MatchContext,
		type OfficerFilters
	} from '$lib/officerFilters';
	import type { Officer } from '$lib/types';
	import OfficerCard from '$lib/components/OfficerCard.svelte';
	import FilterPanel from '$lib/components/FilterPanel.svelte';
	import Loading from '$lib/components/Loading.svelte';
	import ExploreRail from '$lib/components/ExploreRail.svelte';
	import SearchIcon from '$lib/components/SearchIcon.svelte';

	const PAGE_SIZE = 24;

	let officers = $state<Officer[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Each filter field paired with its query-string key; the order sets how the
	// shareable URL is written. Filter state is seeded from the URL on load.
	const URL_PARAMS: [keyof OfficerFilters, string][] = [
		['q', 'q'],
		['cadre', 'cadre'],
		['yearFrom', 'from'],
		['yearTo', 'to'],
		['gender', 'gender'],
		['status', 'status'],
		['deputation', 'dep'],
		['domicile', 'domicile'],
		['recruitment', 'rec'],
		['motherTongue', 'mt'],
		['service', 'service'],
		['department', 'dept'],
		['position', 'pos'],
		['education', 'edu'],
		['sort', 'sort']
	];

	const seeded = emptyFilters() as Record<keyof OfficerFilters, string>;
	for (const [key, param] of URL_PARAMS) {
		const value = page.url.searchParams.get(param);
		if (value) seeded[key] = value;
	}
	const filters = $state<OfficerFilters>(seeded as OfficerFilters);
	let pageNum = $state(1);
	let filtersOpen = $state(false);

	// Lazy per-officer key indexes that back the join-based facet filters.
	let deptIndex = $state<Map<string, Set<string>> | null>(null);
	let posIndex = $state<Map<string, Set<string>> | null>(null);
	let eduIndex = $state<Map<string, Set<string>> | null>(null);

	// Suggestion lists for the join-based facets, loaded the first time their
	// search field is focused (each is derived from aggregated postings / nested
	// data, so we avoid the work until it is asked for).
	let departments = $state<string[]>([]);
	let positions = $state<string[]>([]);
	let education = $state<string[]>([]);

	function loadFacetOptions(id: 'departments' | 'positions' | 'education') {
		const current = id === 'departments' ? departments : id === 'positions' ? positions : education;
		if (current.length) return;
		const facet = facetById(id);
		if (!facet) return;
		loadFacetValues(facet).then((values) => {
			const labels = values.map((v) => v.label);
			if (id === 'departments') departments = labels;
			else if (id === 'positions') positions = labels;
			else education = labels;
		});
	}

	$effect(() => {
		loadOfficers()
			.then((rows) => (officers = rows))
			.catch((e) => (error = e instanceof Error ? e.message : String(e)))
			.finally(() => (loading = false));
	});

	$effect(() => {
		if (filters.department && !deptIndex) loadDepartmentKeys().then((m) => (deptIndex = m));
	});
	$effect(() => {
		if (filters.position && !posIndex) loadPositionKeys().then((m) => (posIndex = m));
	});
	$effect(() => {
		if (filters.education && !eduIndex) loadEducationKeys().then((m) => (eduIndex = m));
	});

	const cadres = $derived(cadreOptions(officers));
	const years = $derived(yearOptions(officers));
	const domiciles = $derived(distinctValues(officers, 'place_of_domicile'));
	const recruitments = $derived(distinctValues(officers, 'source_of_recruitment'));
	const motherTongues = $derived(distinctValues(officers, 'mother_tongue'));

	const matchCtx = $derived<MatchContext>({
		deptIndex,
		deptKey: filters.department ? canonicalKey(filters.department) : '',
		posIndex,
		posKey: filters.position ? canonicalKey(filters.position) : '',
		eduIndex,
		eduKey: filters.education ? canonicalKey(filters.education) : ''
	});

	// Typo-tolerant free-text search over the headline officer fields.
	const officerFuse = $derived(
		new Fuse(officers, {
			keys: ['name'],
			threshold: 0.1,
			ignoreLocation: true
		})
	);
	const queryMatches = $derived.by(() => {
		const q = filters.q.trim();
		if (!q) return null;
		return new Set(officerFuse.search(q).map((r) => r.item.identity_no));
	});

	const filtered = $derived.by(() => {
		let result = officers.filter((o) => officerMatches(o, filters, matchCtx));
		if (queryMatches) result = result.filter((o) => queryMatches.has(o.identity_no));
		result.sort((a, b) => compareOfficers(a, b, filters.sort));
		return result;
	});

	const totalPages = $derived(Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
	const clampedPage = $derived(Math.min(pageNum, totalPages));
	const pageItems = $derived(
		filtered.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE)
	);

	const activeCount = $derived(activeFilterCount(filters));

	// Any filter change returns to the first page.
	$effect(() => {
		for (const [key] of URL_PARAMS) void filters[key];
		pageNum = 1;
	});

	// Mirror the active filters into the URL so the view is shareable.
	$effect(() => {
		const parts: string[] = [];
		for (const [key, param] of URL_PARAMS) {
			const value = key === 'sort' && filters.sort === 'seniority' ? '' : filters[key];
			if (value) parts.push(`${param}=${encodeURIComponent(value)}`);
		}
		const qs = parts.join('&');
		replaceState(`${page.url.pathname}${qs ? `?${qs}` : ''}`, {});
	});

	function resetFilters() {
		clearFilters(filters);
		filters.sort = 'seniority';
	}

	function gotoPage(n: number) {
		pageNum = Math.min(Math.max(1, n), totalPages);
		document.getElementById('results-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	const numberFmt = new Intl.NumberFormat('en-IN');
</script>

<svelte:head>
	<title>IAS Directory — List of Indian Administrative Service officers</title>
</svelte:head>

<h1 class="sr-only">Officer directory</h1>

<ExploreRail />

<div class="mx-auto max-w-6xl px-5 py-10">
	<!-- Search -->
	<div class="flex items-center gap-3 border-b-2 border-ink pb-2">
		<button
			type="button"
			class="flex items-center gap-1.5 border border-line px-3 py-1.5 text-sm font-semibold text-ink-soft hover:border-ink"
			aria-expanded={filtersOpen}
			onclick={() => (filtersOpen = !filtersOpen)}
		>
			Filters
			{#if activeCount > 0}
				<span class="bg-accent px-1.5 text-xs text-white">{activeCount}</span>
			{/if}
		</button>
		<SearchIcon />
		<label for="officer-search" class="sr-only">Search officers</label>
		<input
			id="officer-search"
			type="search"
			bind:value={filters.q}
			placeholder="Search by name, domicile or cadre…"
			class="w-full bg-transparent py-1.5 font-display text-xl text-ink placeholder:font-sans placeholder:text-base placeholder:text-faint focus:outline-none"
		/>
	</div>

	<div class="mt-6 grid gap-10 {filtersOpen ? 'lg:grid-cols-[16rem_1fr]' : ''}">
		<FilterPanel
			{filters}
			{cadres}
			{years}
			{domiciles}
			{recruitments}
			{motherTongues}
			{departments}
			{positions}
			{education}
			onactivate={loadFacetOptions}
			open={filtersOpen}
		/>

		<!-- Results -->
		<section id="results-top">
			{#if error}
				<div class="border border-accent/40 bg-accent-soft p-6 text-accent-dark">
					<p class="font-semibold">Could not load officer data.</p>
					<p class="mt-1 text-sm">{error}</p>
				</div>
			{:else if loading}
				<Loading message="Loading the directory…" />
			{:else}
				<div class="mb-4 flex flex-wrap items-center justify-between gap-3 pb-3">
					<p class="text-sm text-muted">
						<span class="font-display text-lg font-medium text-ink"
							>{numberFmt.format(filtered.length)}</span
						>
						{filtered.length === 1 ? 'officer' : 'officers'}
						{#if activeCount > 0}<span> match your filters</span>{/if}
					</p>
					<label class="flex items-center gap-2 text-sm">
						<span class="text-muted">Sort</span>
						<select
							bind:value={filters.sort}
							class="border border-line bg-card px-2 py-1.5 text-sm font-medium text-ink"
						>
							{#each SORT_OPTIONS as opt (opt.value)}<option value={opt.value}>{opt.label}</option
								>{/each}
						</select>
					</label>
				</div>

				{#if pageItems.length === 0}
					<div class="border border-dashed border-line bg-card p-12 text-center">
						<p class="font-display text-xl text-ink">No officers found</p>
						<p class="mt-1 text-sm text-muted">
							Try broadening your search or clearing some filters.
						</p>
						{#if activeCount > 0}
							<button type="button" class="btn-primary mt-5" onclick={resetFilters}
								>Clear all filters</button
							>
						{/if}
					</div>
				{:else}
					<div class="border-t border-line">
						{#each pageItems as officer (officer.identity_no)}
							<OfficerCard {officer} />
						{/each}
					</div>

					{#if totalPages > 1}
						<nav class="mt-6 flex items-center justify-between gap-2" aria-label="Pagination">
							<button
								type="button"
								class="btn-ghost disabled:opacity-40"
								disabled={clampedPage <= 1}
								onclick={() => gotoPage(clampedPage - 1)}
							>
								← Previous
							</button>
							<span class="text-sm text-muted">
								Page <span class="font-medium text-ink">{clampedPage}</span> of {numberFmt.format(
									totalPages
								)}
							</span>
							<button
								type="button"
								class="btn-ghost disabled:opacity-40"
								disabled={clampedPage >= totalPages}
								onclick={() => gotoPage(clampedPage + 1)}
							>
								Next →
							</button>
						</nav>
					{/if}
				{/if}
			{/if}
		</section>
	</div>
</div>
