<script lang="ts">
	import { computeOfficerStats } from '$lib/officerStats';
	import { formatMonths } from '$lib/format';
	import type { NestedOfficer } from '$lib/types';

	let { officer }: { officer: NestedOfficer } = $props();

	const stats = $derived(computeOfficerStats(officer));

	type Card = { label: string; value: string };

	const cards = $derived.by((): Card[] => {
		const out: Card[] = [];
		if (stats.avgPostingMonths != null) {
			out.push({ label: 'Avg. Posting Duration', value: formatMonths(stats.avgPostingMonths) });
		}
		if (stats.specialisationLabel) {
			out.push({ label: 'Most Common Posting', value: stats.specialisationLabel });
		}
		if (stats.trainingTotal > 0) {
			out.push({
				label: 'Top Training Subject',
				value: stats.trainingSubject ?? 'General'
			});
		}
		return out;
	});
</script>

{#if cards.length}
	<dl
		class="grid grid-cols-1 divide-y divide-line border border-line bg-card sm:grid-cols-3 sm:divide-x sm:divide-y-0"
	>
		{#each cards as card (card.label)}
			<div class="p-5">
				<dt class="text-[0.65rem] font-semibold tracking-[0.12em] text-muted uppercase">
					{card.label}
				</dt>
				<dd class="mt-2 font-display text-2xl leading-tight font-medium break-words text-ink">
					{card.value}
				</dd>
			</div>
		{/each}
	</dl>
{/if}
