<script lang="ts">
	import { base } from '$app/paths';

	let copied = $state(false);

	async function share() {
		const url = window.location.href;
		const data = { title: document.title, url };
		if (navigator.share) {
			try {
				await navigator.share(data);
			} catch {
				// User dismissed the native share sheet — nothing to do.
			}
			return;
		}
		try {
			await navigator.clipboard.writeText(url);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			// Clipboard unavailable; nothing more we can do silently.
		}
	}
</script>

<header class="border-b border-line bg-paper">
	<div class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
		<a href="{base}/" class="group flex items-baseline gap-2.5">
			<span class="font-display text-2xl leading-none font-semibold tracking-tight text-ink">
				IAS Directory
			</span>
		</a>

		<button
			type="button"
			onclick={share}
			class="flex items-center gap-1.5 border border-line px-3 py-1.5 text-sm font-semibold text-ink-soft transition-colors hover:border-ink"
		>
			<svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
				<path
					d="M13 4.5a2.5 2.5 0 11.7 1.74L8.96 8.6a2.5 2.5 0 010 2.8l4.74 2.36a2.5 2.5 0 11-.67 1.34l-4.74-2.36a2.5 2.5 0 110-3.48l4.74-2.36A2.5 2.5 0 0113 4.5z"
				/>
			</svg>
			{copied ? 'Link copied' : 'Share'}
		</button>
	</div>
</header>
