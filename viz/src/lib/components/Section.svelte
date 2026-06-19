<script lang="ts">
	let {
		title,
		count,
		id,
		children
	}: {
		title: string;
		count?: number;
		id?: string;
		children: import('svelte').Snippet;
	} = $props();

	const numberFmt = new Intl.NumberFormat('en-IN');
	let open = $state(true);
</script>

<section {id} class="scroll-mt-6">
	<button
		type="button"
		aria-expanded={open}
		onclick={() => (open = !open)}
		class="group flex w-full items-baseline justify-between gap-3 border-b border-ink pb-2.5 text-left"
	>
		<h2 class="font-display text-2xl leading-none font-medium text-ink group-hover:text-accent">
			{title}
		</h2>
		<span class="flex shrink-0 items-baseline gap-2.5">
			{#if count !== undefined}
				<span class="font-mono text-xs text-muted tabular-nums">
					{numberFmt.format(count)}
				</span>
			{/if}
			<svg
				class="h-4 w-4 self-center text-faint transition-transform group-hover:text-accent {open
					? ''
					: '-rotate-90'}"
				viewBox="0 0 20 20"
				fill="currentColor"
				aria-hidden="true"
			>
				<path
					fill-rule="evenodd"
					d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
					clip-rule="evenodd"
				/>
			</svg>
		</span>
	</button>
	{#if open}
		<div class="pt-5">
			{@render children()}
		</div>
	{/if}
</section>
