<script lang="ts">
	import { base } from '$app/paths';
	import Badge from './Badge.svelte';
	import StatusBadges from './StatusBadges.svelte';
	import { displayYear, isPresent } from '$lib/format';
	import type { Officer } from '$lib/types';

	let { officer, note }: { officer: Officer; note?: string } = $props();

	const batch = $derived(displayYear(officer.allotment_year));
</script>

<a
	href="{base}/officer/{officer.identity_no}"
	class="group flex items-start gap-4 border-b border-line bg-card px-4 py-4 transition-colors hover:bg-paper-dim"
>
	<div class="min-w-0 flex-1">
		<h3
			class="font-display text-lg leading-snug font-medium text-ink transition-colors group-hover:text-accent"
		>
			{officer.name}
		</h3>
		<div class="mt-2 flex flex-wrap items-center gap-1.5">
			{#if isPresent(officer.cadre)}
				<Badge variant="cadre">{officer.cadre.trim()} cadre</Badge>
			{/if}
			{#if batch}
				<Badge variant="batch">{batch} batch</Badge>
			{/if}
			{#if isPresent(officer.place_of_domicile)}
				<Badge variant="state">{officer.place_of_domicile.trim()}</Badge>
			{/if}
			<StatusBadges
				serving={officer.serving}
				retirementReason={officer.retirement_reason}
				onDeputation={officer.on_central_deputation}
				showServing={false}
			/>
			{#if note}
				<span class="text-xs text-muted">{note}</span>
			{/if}
		</div>
	</div>
	<span
		class="mt-1.5 hidden shrink-0 text-faint transition-colors group-hover:text-accent sm:block"
		aria-hidden="true"
	>
		<svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"
			><path
				fill-rule="evenodd"
				d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
				clip-rule="evenodd"
			/></svg
		>
	</span>
</a>
