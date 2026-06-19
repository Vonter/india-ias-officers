<script lang="ts">
	import { base } from '$app/paths';

	let { items }: { items: { label: string; href?: string }[] } = $props();
</script>

<nav aria-label="Breadcrumb" class="text-xs tracking-wide">
	<ol class="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted uppercase">
		<li><a class="transition-colors hover:text-accent" href="{base}/">Home</a></li>
		{#each items as item, i (i)}
			<li aria-hidden="true" class="text-faint">/</li>
			<li>
				{#if item.href}
					<a class="transition-colors hover:text-accent" href={item.href}>{item.label}</a>
				{:else}
					<span class="font-semibold text-ink" aria-current="page">{item.label}</span>
				{/if}
			</li>
		{/each}
	</ol>
</nav>
