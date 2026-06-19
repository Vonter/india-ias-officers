<script lang="ts">
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import { loadOfficer } from '$lib/data';
	import { facetFilterHref } from '$lib/facets';
	import { canonicalKey } from '$lib/canonical';
	import { computeOfficerStats } from '$lib/officerStats';
	import {
		computeServing,
		display,
		displayYear,
		formatDate,
		formatDuration,
		formatMonths,
		formatYear,
		formatPeriod,
		gapMonths,
		isCurrentPosting,
		isPresent,
		parseDate,
		splitExperience
	} from '$lib/format';
	import type { NestedOfficer, Posting } from '$lib/types';
	import Badge from '$lib/components/Badge.svelte';
	import StatusBadges from '$lib/components/StatusBadges.svelte';
	import Section from '$lib/components/Section.svelte';
	import Loading from '$lib/components/Loading.svelte';

	let officer = $state<NestedOfficer | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);

	let id = $derived(page.params.id ?? '');

	$effect(() => {
		const current = id;
		loading = true;
		error = null;
		officer = null;
		loadOfficer(current)
			.then((o) => {
				if (current === id) officer = o;
			})
			.catch((e) => (error = e instanceof Error ? e.message : String(e)))
			.finally(() => {
				if (current === id) loading = false;
			});
	});

	const dep = $derived(officer?.central_deputation);
	const onDep = $derived(
		isPresent(dep?.on_deputation) && dep!.on_deputation.toLowerCase() === 'yes'
	);

	// Serving only when the record says so *and* a posting is still live; a
	// superannuated officer (or one with no current posting) counts as retired.
	const hasCurrentPosting = $derived(
		(officer?.experience ?? []).some((p) => isCurrentPosting(p.period_from, p.period_to))
	);
	const serving = $derived(
		officer ? computeServing(officer.retirement_reason, hasCurrentPosting) : false
	);

	// Every dated record reads newest-first.
	const postings = $derived(
		[...(officer?.experience ?? [])].sort(
			(a, b) =>
				(parseDate(b.period_from)?.getTime() ?? 0) - (parseDate(a.period_from)?.getTime() ?? 0)
		)
	);
	const education = $derived([...(officer?.education ?? [])].reverse());

	type Fact = { label: string; value: string; href?: string; mono?: boolean };
	const facts = $derived.by((): Fact[] => {
		if (!officer) return [];
		const stats = computeOfficerStats(officer);
		const list: Fact[] = [
			{ label: 'Year of birth', value: formatYear(officer.date_of_birth) },
			{
				label: 'Source of recruitment',
				value: display(officer.source_of_recruitment),
				href: facetValHref('recruitment', officer.source_of_recruitment)
			},
			{ label: 'Joined service', value: formatYear(officer.date_of_joining) },
			{
				label: 'Avg. posting duration',
				value: stats.avgPostingMonths != null ? formatMonths(stats.avgPostingMonths) : ''
			},
			{ label: 'Most common posting', value: display(stats.specialisationLabel) },
			{
				label: 'Top training subject',
				value: stats.trainingTotal > 0 ? (stats.trainingSubject ?? 'General') : ''
			}
		];
		return list.filter((f) => isPresent(f.value));
	});

	function facetValHref(facetId: string, v: string): string | undefined {
		return isPresent(v) ? `${base}${facetFilterHref(facetId, v.trim())}` : undefined;
	}

	// Batch isn't a facet of its own; the directory filters by an allotment-year
	// range, so a single batch pins both ends of that range to the same year.
	const batchHref = $derived.by(() => {
		const year = displayYear(officer?.allotment_year);
		return year ? `${base}/?from=${year}&to=${year}` : undefined;
	});
	function deptHref(v: string): string | undefined {
		return isPresent(v) ? `${base}${facetFilterHref('departments', v.trim())}` : undefined;
	}
	function positionHref(v: string): string | undefined {
		return isPresent(v) && !canonicalKey(v).includes('not available')
			? `${base}${facetFilterHref('positions', v.trim())}`
			: undefined;
	}

	type TrainingEntry = { year: string; title: string; meta: string[] };

	// Each training stream records a different shape; flatten every row to a shared
	// title / year / supporting-detail form so they read like the Education and
	// Awards sections rather than needing a horizontally scrolling table.
	function trainingEntries(key: string, rows: Record<string, string>[]): TrainingEntry[] {
		return rows.map((r) => {
			const title = display(r.training_name ?? r.name, 'Programme');
			let meta: string[];
			if (key === 'in') {
				meta = [
					display(r.institute),
					display(r.city),
					isPresent(r.duration_weeks) ? `${r.duration_weeks.trim()} weeks` : ''
				];
			} else if (key === 'for') {
				meta = [display(r.subject), display(r.country), display(r.duration)];
			} else if (key === 'dom') {
				meta = [display(r.subject), display(r.duration)];
			} else {
				meta = [formatPeriod(r.date_from, r.date_to)];
			}
			return { year: display(r.year), title, meta: meta.filter(Boolean) };
		});
	}

	const trainingTabs = $derived.by(() => {
		if (!officer) return [];
		const t = officer.training;
		// Year can be a single value or a range like "1992-1993"; sort by the
		// starting year so each stream reads newest-first.
		const startYear = (v: string) => Number(/\d{4}/.exec(v ?? '')?.[0]) || 0;
		const byYearDesc = <T extends { year: string }>(rows: T[]) =>
			[...rows].sort((a, b) => startYear(b.year) - startYear(a.year));
		return [
			{ key: 'mid', label: 'Mid-career', rows: byYearDesc(t.mid_career ?? []) },
			{ key: 'in', label: 'In-service', rows: byYearDesc(t.in_service ?? []) },
			{ key: 'dom', label: 'Domestic', rows: byYearDesc(t.domestic ?? []) },
			{ key: 'for', label: 'Foreign', rows: byYearDesc(t.foreign ?? []) }
		]
			.filter((tab) => tab.rows.length > 0)
			.map((tab) => ({
				...tab,
				entries: trainingEntries(tab.key, tab.rows as unknown as Record<string, string>[])
			}));
	});
	const totalTraining = $derived(trainingTabs.reduce((n, t) => n + t.rows.length, 0));

	const awards = $derived(
		[...(officer?.awards_publications ?? [])].sort(
			(a, b) => (Number(b.year) || 0) - (Number(a.year) || 0)
		)
	);

	function postingPeriod(p: Posting): string {
		return formatPeriod(p.period_from, p.period_to, serving, true);
	}

	// Flag a break of at least two months between an older posting's end and the
	// next posting's start. Postings read newest-first, so `older` sits below.
	const GAP_THRESHOLD_MONTHS = 2;
	function gapLabel(newer: Posting, older: Posting): string {
		const months = gapMonths(older.period_to, newer.period_from);
		if (months == null || months < GAP_THRESHOLD_MONTHS) return '';
		return formatMonths(months);
	}
</script>

<svelte:head>
	<title>{officer ? `${officer.name} — IAS Directory` : 'Officer profile'}</title>
</svelte:head>

<div class="mx-auto max-w-5xl px-5 py-8">
	{#if loading}
		<Loading message="Loading profile…" />
	{:else if error}
		<div class="border border-accent/40 bg-accent-soft p-6 text-accent-dark">
			<p class="font-semibold">Could not load this profile.</p>
			<p class="mt-1 text-sm">{error}</p>
		</div>
	{:else if !officer}
		<div class="border border-line bg-card p-12 text-center">
			<p class="font-display text-2xl text-ink">Officer not found</p>
			<a href="{base}/" class="btn-primary mt-5">Back to the directory</a>
		</div>
	{:else}
		<!-- Profile header -->
		<header class="mt-5 flex flex-col gap-5 border-b border-ink pb-7 sm:flex-row sm:items-start">
			<div class="min-w-0 flex-1">
				<h1 class="font-display text-3xl leading-tight font-semibold text-ink sm:text-4xl">
					{officer.name}
				</h1>
				<div class="mt-3 flex flex-wrap items-center gap-1.5">
					{#if isPresent(officer.cadre)}
						<Badge variant="cadre" href={facetValHref('cadres', officer.cadre)}
							>{officer.cadre.trim()} cadre</Badge
						>
					{/if}
					{#if displayYear(officer.allotment_year)}
						<Badge variant="batch" href={batchHref}
							>{displayYear(officer.allotment_year)} batch</Badge
						>
					{/if}
					{#if isPresent(officer.place_of_domicile)}
						<Badge variant="state" href={facetValHref('domiciles', officer.place_of_domicile)}
							>{officer.place_of_domicile.trim()}</Badge
						>
					{/if}
					<StatusBadges
						{serving}
						retirementReason={officer.retirement_reason}
						onDeputation={dep?.on_deputation}
						servingHref="{base}/?status=serving"
						retiredHref="{base}/?status=retired"
						deputationHref="{base}/?dep=yes"
					/>
				</div>
			</div>
		</header>

		<!-- Biodata facts -->
		<dl class="grid grid-cols-2 gap-x-8 gap-y-5 py-6 sm:grid-cols-3">
			{#each facts as fact (fact.label)}
				<div>
					<dt class="text-[0.65rem] font-semibold tracking-[0.12em] text-muted uppercase">
						{fact.label}
					</dt>
					<dd class="mt-1 text-[0.95rem] text-ink {fact.mono ? 'font-mono text-sm' : ''}">
						{#if fact.href}
							<a
								class="underline decoration-line decoration-1 underline-offset-2 hover:text-accent hover:decoration-accent"
								href={fact.href}>{fact.value}</a
							>
						{:else}
							{fact.value}
						{/if}
					</dd>
				</div>
			{/each}
		</dl>

		<div class="mt-10 space-y-12">
			<!-- Central deputation -->
			{#if onDep}
				<Section title="Central Deputation">
					<dl class="grid grid-cols-2 gap-5 sm:grid-cols-4">
						{#each [{ l: 'Status', v: 'On deputation to GoI' }, { l: 'Tenure type', v: display(dep?.tenure_type) }, { l: 'Start date', v: formatDate(dep?.start_date) }, { l: 'Expiry date', v: formatDate(dep?.expiry_date) }] as f (f.l)}
							{#if isPresent(f.v)}
								<div>
									<dt class="text-[0.65rem] font-semibold tracking-[0.12em] text-muted uppercase">
										{f.l}
									</dt>
									<dd class="mt-1 text-sm text-ink">{f.v}</dd>
								</div>
							{/if}
						{/each}
					</dl>
				</Section>
			{/if}

			<!-- Career -->
			{#if postings.length > 0}
				<Section title="Career &amp; Postings" count={postings.length}>
					<ol class="space-y-6">
						{#each postings as post, i (i)}
							{@const current = isCurrentPosting(post.period_from, post.period_to, serving)}
							{@const duration = formatDuration(post.period_from, post.period_to, serving)}
							{@const experience = splitExperience(post.experience_major_minor)}
							{@const gap = i + 1 < postings.length ? gapLabel(post, postings[i + 1]) : ''}
							<li class="flex gap-4 sm:gap-5">
								<!-- Tenure length, on the left -->
								<div class="w-20 shrink-0 pt-0.5 text-right sm:w-24">
									{#if current}
										<span
											class="font-mono text-xs font-semibold tracking-wide text-serving uppercase"
											>Now</span
										>
									{:else if duration}
										<span class="font-mono text-sm font-medium text-ink tabular-nums"
											>{duration}</span
										>
									{/if}
									{#if postingPeriod(post)}
										<span
											class="mt-0.5 block font-mono text-[0.7rem] leading-tight text-faint tabular-nums"
										>
											{postingPeriod(post)}
										</span>
									{/if}
								</div>
								<!-- Designation, department and other attributes, on the right -->
								<div class="min-w-0 flex-1 border-l border-line pb-1 pl-4 sm:pl-5">
									<div
										class="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3"
									>
										{#if isPresent(post.designation_level) && !canonicalKey(post.designation_level).includes('not available')}
											<h3 class="font-display text-lg leading-snug font-medium text-ink">
												{#if positionHref(post.designation_level)}
													<a class="hover:text-accent" href={positionHref(post.designation_level)}
														>{post.designation_level.trim()}</a
													>
												{:else}{post.designation_level.trim()}{/if}
											</h3>
										{:else}
											<h3 class="font-display text-lg leading-snug font-medium text-faint italic">
												Posting
											</h3>
										{/if}
										{#if experience.length}
											<div
												class="flex shrink-0 flex-wrap items-center justify-start gap-x-1.5 gap-y-1 text-[0.7rem] font-medium tracking-wide text-ink-soft uppercase sm:justify-end sm:pt-1"
											>
												{#each experience as part, i (i)}
													{#if i > 0}<span class="text-faint" aria-hidden="true">›</span>{/if}
													<span class="border border-line bg-paper-dim px-1.5 py-0.5">{part}</span>
												{/each}
											</div>
										{/if}
									</div>
									{#if isPresent(post.ministry_dept_office_location)}
										<a
											class="mt-1 inline-block text-sm text-accent hover:text-accent-dark hover:underline"
											href={deptHref(post.ministry_dept_office_location)}
										>
											{post.ministry_dept_office_location.trim()}
										</a>
									{/if}
									{#if isPresent(post.organisation)}
										<p class="mt-0.5 text-sm text-muted">{post.organisation.trim()}</p>
									{/if}
								</div>
							</li>
							{#if gap}
								<li class="flex gap-4 sm:gap-5">
									<div class="w-20 shrink-0 pt-0.5 text-right sm:w-24">
										<span class="font-mono text-xs text-faint tabular-nums">{gap}</span>
									</div>
									<div class="min-w-0 flex-1 border-l border-dashed border-line py-1 pl-4 sm:pl-5">
										<span
											class="text-[0.65rem] font-semibold tracking-[0.12em] text-faint uppercase"
											>No posting on record</span
										>
									</div>
								</li>
							{/if}
						{/each}
					</ol>
				</Section>
			{/if}

			<!-- Education -->
			{#if education.length > 0}
				<Section title="Education" count={education.length}>
					<ul class="space-y-4">
						{#each education as edu, i (i)}
							<li
								class="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-l-2 border-accent/30 pl-4"
							>
								<p class="min-w-0 flex-1 font-medium text-ink">
									{display(edu.qualification_university_institute, 'Qualification')}
								</p>
								{#if isPresent(edu.subject) || isPresent(edu.division)}
									<div class="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
										{#if isPresent(edu.subject)}
											<Badge variant="neutral">{edu.subject.trim()}</Badge>
										{/if}
										{#if isPresent(edu.division)}
											<Badge variant="info">{edu.division.trim()}</Badge>
										{/if}
									</div>
								{/if}
							</li>
						{/each}
					</ul>
				</Section>
			{/if}

			<!-- Training -->
			{#if totalTraining > 0}
				<Section title="Training" count={totalTraining}>
					<div class="space-y-6">
						{#each trainingTabs as tab (tab.key)}
							<div class="border border-line bg-card">
								<div
									class="flex items-baseline justify-between gap-3 border-b border-line bg-paper-dim px-4 py-2.5"
								>
									<h3 class="font-display text-base leading-none font-medium text-ink">
										{tab.label} Training
									</h3>
									<span class="shrink-0 font-mono text-xs text-muted tabular-nums"
										>{tab.rows.length}</span
									>
								</div>
								<ul class="divide-y divide-line-soft">
									{#each tab.entries as entry, i (i)}
										<li class="flex items-start justify-between gap-4 px-4 py-3">
											<div class="min-w-0 flex-1">
												<p class="font-medium text-ink">{entry.title}</p>
												{#if entry.meta.length}
													<p class="mt-0.5 text-sm text-muted">{entry.meta.join(' · ')}</p>
												{/if}
											</div>
											{#if entry.year}
												<span class="shrink-0 font-mono text-sm font-medium text-ink tabular-nums"
													>{entry.year}</span
												>
											{/if}
										</li>
									{/each}
								</ul>
							</div>
						{/each}
					</div>
				</Section>
			{/if}

			<!-- Awards & publications -->
			{#if awards.length > 0}
				<Section title="Awards &amp; Publications" count={awards.length}>
					<ul class="space-y-5">
						{#each awards as item, i (i)}
							<li class="flex items-start justify-between gap-4 border-l-2 border-gold/40 pl-4">
								<div class="min-w-0 flex-1">
									<div class="flex flex-wrap items-center gap-2">
										{#if isPresent(item.type)}<Badge variant="info">{item.type}</Badge>{/if}
										{#if isPresent(item.award_name_book_title)}
											<span class="font-medium text-ink">{item.award_name_book_title.trim()}</span>
										{/if}
									</div>
									{#if isPresent(item.awards_given_by_publisher) || isPresent(item.area) || isPresent(item.subject) || isPresent(item.level)}
										<p class="mt-1 text-sm text-muted">
											{[item.awards_given_by_publisher, item.area, item.subject, item.level]
												.filter(isPresent)
												.join(' · ')}
										</p>
									{/if}
								</div>
								{#if isPresent(item.year)}
									<span class="shrink-0 font-mono text-sm font-medium text-gold tabular-nums">
										{item.year.trim()}
									</span>
								{/if}
							</li>
						{/each}
					</ul>
				</Section>
			{/if}
		</div>
	{/if}
</div>
