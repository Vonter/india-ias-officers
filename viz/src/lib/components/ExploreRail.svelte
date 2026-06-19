<script lang="ts">
	import { base } from '$app/paths';
	import { FACETS } from '$lib/facets';
</script>

<!-- Horizontal links to each facet's explore page. -->
<section class="border-b border-line bg-paper-dim">
	<div
		class="mx-auto flex max-w-6xl flex-nowrap items-center gap-x-3 gap-y-2 overflow-x-auto px-5 py-3 text-sm whitespace-nowrap [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:overflow-x-visible sm:py-3.5 sm:whitespace-normal [&::-webkit-scrollbar]:hidden"
	>
		{#each FACETS as f, i (f.id)}
			<a
				href="{base}/explore/{f.id}"
				class="shrink-0 font-medium text-ink-soft transition-colors hover:text-accent"
			>
				{f.singular}{#if i < FACETS.length - 1}<span class="ml-3 text-faint">|</span>{/if}
			</a>
		{/each}
	</div>
</section>
