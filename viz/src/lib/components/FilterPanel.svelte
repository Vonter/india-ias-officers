<script lang="ts">
	import { activeFilterCount, clearFilters, type OfficerFilters } from '$lib/officerFilters';
	import FacetFilter from './FacetFilter.svelte';

	type FacetId = 'departments' | 'positions' | 'education';

	let {
		filters,
		years,
		cadres = [],
		domiciles = [],
		motherTongues = [],
		recruitments = [],
		departments = [],
		positions = [],
		education = [],
		onactivate,
		open = false
	}: {
		filters: OfficerFilters;
		years: number[];
		cadres?: string[];
		domiciles?: string[];
		motherTongues?: string[];
		recruitments?: string[];
		departments?: string[];
		positions?: string[];
		education?: string[];
		onactivate?: (facet: FacetId) => void;
		open?: boolean;
	} = $props();

	const active = $derived(activeFilterCount(filters));
</script>

<aside class={open ? 'block' : 'hidden'}>
	<div class="sticky top-6 space-y-5">
		{#if active > 0}
			<div class="flex items-center justify-between">
				<span class="text-xs font-semibold tracking-wide text-muted uppercase">Filters</span>
				<button
					type="button"
					class="text-xs font-semibold text-accent hover:underline"
					onclick={() => clearFilters(filters)}
				>
					Clear all
				</button>
			</div>
		{/if}

		<FacetFilter label="State cadre" options={cadres} bind:value={filters.cadre} />
		<FacetFilter
			label="Department"
			options={departments}
			bind:value={filters.department}
			onactivate={() => onactivate?.('departments')}
		/>
		<FacetFilter
			label="Position"
			options={positions}
			bind:value={filters.position}
			onactivate={() => onactivate?.('positions')}
		/>
		<FacetFilter label="Place of domicile" options={domiciles} bind:value={filters.domicile} />
		<FacetFilter
			label="Education"
			options={education}
			bind:value={filters.education}
			onactivate={() => onactivate?.('education')}
		/>
		<FacetFilter
			label="Source of recruitment"
			options={recruitments}
			bind:value={filters.recruitment}
		/>
		<FacetFilter label="Mother tongue" options={motherTongues} bind:value={filters.motherTongue} />

		<div>
			<span class="mb-1.5 block text-xs font-semibold tracking-wide text-ink uppercase"
				>Batch (allotment year)</span
			>
			<div class="flex items-center gap-2">
				<select
					bind:value={filters.yearFrom}
					aria-label="From year"
					class="w-full border border-line bg-card px-2 py-1.5 text-sm"
				>
					<option value="">From</option>
					{#each years as y (y)}<option value={String(y)}>{y}</option>{/each}
				</select>
				<span class="text-faint">–</span>
				<select
					bind:value={filters.yearTo}
					aria-label="To year"
					class="w-full border border-line bg-card px-2 py-1.5 text-sm"
				>
					<option value="">To</option>
					{#each years as y (y)}<option value={String(y)}>{y}</option>{/each}
				</select>
			</div>
		</div>

		<fieldset>
			<legend class="mb-1.5 text-xs font-semibold tracking-wide text-ink uppercase"
				>Service status</legend
			>
			<div class="space-y-1.5">
				{#each [{ v: '', l: 'Any status' }, { v: 'serving', l: 'Currently serving' }, { v: 'retired', l: 'Retired / former' }] as opt (opt.v)}
					<label class="flex items-center gap-2 text-sm text-ink-soft">
						<input
							type="radio"
							name="status"
							value={opt.v}
							bind:group={filters.status}
							class="accent-accent"
						/>
						{opt.l}
					</label>
				{/each}
			</div>
		</fieldset>

		<fieldset>
			<legend class="mb-1.5 text-xs font-semibold tracking-wide text-ink uppercase">Gender</legend>
			<div class="space-y-1.5">
				{#each [{ v: '', l: 'Any' }, { v: 'Male', l: 'Male' }, { v: 'Female', l: 'Female' }] as opt (opt.v)}
					<label class="flex items-center gap-2 text-sm text-ink-soft">
						<input
							type="radio"
							name="gender"
							value={opt.v}
							bind:group={filters.gender}
							class="accent-accent"
						/>
						{opt.l}
					</label>
				{/each}
			</div>
		</fieldset>

		<label class="flex items-center gap-2 text-sm font-medium text-ink-soft">
			<input
				type="checkbox"
				checked={filters.deputation === 'yes'}
				onchange={(e) => (filters.deputation = e.currentTarget.checked ? 'yes' : '')}
				class="accent-accent"
			/>
			On central deputation
		</label>
	</div>
</aside>
