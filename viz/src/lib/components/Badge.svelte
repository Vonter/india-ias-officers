<script lang="ts">
	type Variant =
		| 'serving'
		| 'retired'
		| 'deputation'
		| 'neutral'
		| 'info'
		| 'cadre'
		| 'batch'
		| 'state';

	let {
		variant = 'neutral',
		href,
		children
	}: { variant?: Variant; href?: string; children: import('svelte').Snippet } = $props();

	const styles: Record<Variant, string> = {
		serving: 'border-serving/30 bg-serving-soft text-serving',
		retired: 'border-line bg-paper-dim text-muted',
		deputation: 'border-ink/20 bg-paper-deep text-ink',
		info: 'border-gold/30 bg-gold-soft text-gold',
		neutral: 'border-line bg-paper-dim text-ink-soft',
		cadre: 'border-navy/25 bg-paper-deep text-navy',
		batch: 'border-gold/30 bg-gold-soft text-gold',
		state: 'border-accent/30 bg-accent-soft text-accent-dark'
	};

	const layout =
		'inline-flex items-center gap-1 border px-2 py-0.5 text-[0.6875rem] font-semibold tracking-wide uppercase';
</script>

{#if href}
	<a
		{href}
		class="{layout} {styles[variant]} transition-colors hover:border-current hover:opacity-80"
	>
		{@render children()}
	</a>
{:else}
	<span class="{layout} {styles[variant]}">
		{@render children()}
	</span>
{/if}
