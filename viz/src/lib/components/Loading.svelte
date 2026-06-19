<script lang="ts">
	let { message = 'Loading data…' }: { message?: string } = $props();
</script>

<div class="flex flex-col items-center justify-center gap-4 py-24 text-muted" role="status">
	<span class="relative flex h-3 w-3">
		<span class="absolute inline-flex h-full w-full animate-ping bg-accent opacity-60"></span>
		<span class="relative inline-flex h-3 w-3 bg-accent"></span>
	</span>
	<p class="eyebrow eyebrow-muted">{message}</p>
</div>
