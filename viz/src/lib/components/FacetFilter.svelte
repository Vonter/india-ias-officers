<script lang="ts">
	import Fuse from 'fuse.js';

	let {
		label,
		options,
		value = $bindable(''),
		placeholder = 'Type to search…',
		onactivate
	}: {
		label: string;
		options: string[];
		value?: string;
		placeholder?: string;
		onactivate?: () => void;
	} = $props();

	const inputId = $derived(`f-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);

	// Writable derived: tracks the external value (URL seed, "Clear all") but can
	// be overridden locally while the user types.
	let query = $derived(value);
	let open = $state(false);
	let activeIndex = $state(-1);
	let inputEl = $state<HTMLInputElement>();

	const fuse = $derived(new Fuse(options, { threshold: 0.4, ignoreLocation: true }));

	const suggestions = $derived.by(() => {
		const q = query.trim();
		if (!open || !q || q === value) return [];
		return fuse.search(q, { limit: 8 }).map((r) => r.item);
	});

	function choose(option: string) {
		value = option;
		open = false;
		activeIndex = -1;
	}

	function clear() {
		value = '';
		open = false;
		activeIndex = -1;
		inputEl?.focus();
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			open = true;
			activeIndex = Math.min(activeIndex + 1, suggestions.length - 1);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			activeIndex = Math.max(activeIndex - 1, 0);
		} else if (event.key === 'Enter' && activeIndex >= 0 && suggestions[activeIndex]) {
			event.preventDefault();
			choose(suggestions[activeIndex]);
		} else if (event.key === 'Escape') {
			open = false;
			activeIndex = -1;
		}
	}

	function onInput() {
		open = true;
		activeIndex = -1;
		if (!query.trim() && value) value = '';
	}
</script>

<div class="relative">
	<label for={inputId} class="mb-1.5 block text-xs font-semibold tracking-wide text-ink uppercase">
		{label}
	</label>
	<div class="relative">
		<input
			id={inputId}
			bind:this={inputEl}
			bind:value={query}
			type="text"
			{placeholder}
			role="combobox"
			aria-expanded={suggestions.length > 0}
			aria-controls="{inputId}-list"
			aria-autocomplete="list"
			autocomplete="off"
			class="w-full border border-line bg-card px-2 py-1.5 pr-7 text-sm text-ink"
			onfocus={() => {
				open = true;
				onactivate?.();
			}}
			onblur={() => (open = false)}
			oninput={onInput}
			onkeydown={onKeydown}
		/>
		{#if value}
			<button
				type="button"
				class="absolute inset-y-0 right-0 flex items-center px-2 text-faint hover:text-ink"
				aria-label="Clear {label}"
				onclick={clear}
			>
				✕
			</button>
		{/if}
	</div>
	{#if suggestions.length}
		<ul
			id="{inputId}-list"
			role="listbox"
			class="absolute z-20 mt-1 max-h-60 w-full overflow-auto border border-line bg-card shadow-lg"
		>
			{#each suggestions as suggestion, i (suggestion)}
				<li role="option" aria-selected={i === activeIndex}>
					<button
						type="button"
						class="w-full px-2 py-1.5 text-left text-sm {i === activeIndex
							? 'bg-paper-deep text-ink'
							: 'text-ink-soft hover:bg-paper-dim'}"
						onmousedown={(event) => event.preventDefault()}
						onclick={() => choose(suggestion)}
					>
						{suggestion}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>
