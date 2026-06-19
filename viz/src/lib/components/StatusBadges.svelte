<script lang="ts">
	import Badge from './Badge.svelte';
	import { isPresent, isServing } from '$lib/format';

	let {
		serving,
		retirementReason,
		onDeputation = 'No',
		showServing = true,
		servingHref,
		retiredHref,
		deputationHref
	}: {
		serving: boolean;
		retirementReason: string;
		onDeputation?: string;
		showServing?: boolean;
		servingHref?: string;
		retiredHref?: string;
		deputationHref?: string;
	} = $props();

	// The source may still read "Serving" for an officer with no live posting;
	// trust the computed flag and label such records plainly as retired.
	let retiredReason = $derived(
		isPresent(retirementReason) && !isServing(retirementReason)
			? retirementReason.trim()
			: 'Retired'
	);
	let onDep = $derived(isPresent(onDeputation) && onDeputation.trim().toLowerCase() === 'yes');
</script>

{#if serving}
	{#if showServing}
		<Badge variant="serving" href={servingHref}>Serving</Badge>
	{/if}
{:else}
	<Badge variant="retired" href={retiredHref}>{retiredReason}</Badge>
{/if}
{#if onDep}
	<Badge variant="deputation" href={deputationHref}>Central Deputation</Badge>
{/if}
