import { canonicalKey } from './canonical';
import {
	computeServing,
	durationYears,
	isCurrentPosting,
	isPresent,
	splitExperience
} from './format';
import type { NestedOfficer } from './types';

// Headline measures from a single officer's record: typical posting length, the
// field of experience with the most cumulative time, and the most-trained subject.

/** Whether an officer still holds a live posting — mirrors the profile page. */
function officerServing(o: NestedOfficer): boolean {
	const hasCurrent = (o.experience ?? []).some((p) => isCurrentPosting(p.period_from, p.period_to));
	return computeServing(o.retirement_reason, hasCurrent);
}

/** Mean length, in months, of an officer's datable postings. */
function avgPostingMonths(o: NestedOfficer): number | null {
	const live = officerServing(o);
	let total = 0;
	let n = 0;
	for (const p of o.experience ?? []) {
		const years = durationYears(p.period_from, p.period_to, live);
		if (years == null || years <= 0) continue;
		total += years * 12;
		n += 1;
	}
	return n === 0 ? null : total / n;
}

type Tally = { label: string; weight: number };

/** The heaviest label in a tally, or null when nothing qualified. */
function pickTop(map: Map<string, Tally>): string | null {
	let best: Tally | null = null;
	for (const t of map.values()) if (!best || t.weight > best.weight) best = t;
	return best?.label ?? null;
}

/**
 * The field of experience the officer has spent the most cumulative months in,
 * keyed on the *major* (the leading half of the "Major / Minor" posting label).
 */
function topSpecialisation(o: NestedOfficer): string | null {
	const live = officerServing(o);
	const byMajor = new Map<string, Tally>();
	for (const p of o.experience ?? []) {
		const major = splitExperience(p.experience_major_minor)[0];
		if (!major) continue;
		const key = canonicalKey(major);
		if (!key) continue;
		const entry = byMajor.get(key) ?? { label: major, weight: 0 };
		const years = durationYears(p.period_from, p.period_to, live);
		if (years != null && years > 0) entry.weight += years * 12;
		byMajor.set(key, entry);
	}
	return pickTop(byMajor);
}

/** The subject the officer has trained in most often (domestic + foreign). */
function topTrainingSubject(o: NestedOfficer): string | null {
	const bySubject = new Map<string, Tally>();
	const rows = [...(o.training?.domestic ?? []), ...(o.training?.foreign ?? [])];
	for (const r of rows) {
		const raw = r.subject;
		if (!isPresent(raw)) continue;
		const key = canonicalKey(raw);
		if (!key || key.includes('not available')) continue;
		const entry = bySubject.get(key) ?? { label: raw.trim(), weight: 0 };
		entry.weight += 1;
		bySubject.set(key, entry);
	}
	return pickTop(bySubject);
}

/** Count of every training programme across all four categories. */
function trainingTotal(o: NestedOfficer): number {
	const t = o.training;
	if (!t) return 0;
	return (
		(t.mid_career?.length ?? 0) +
		(t.in_service?.length ?? 0) +
		(t.domestic?.length ?? 0) +
		(t.foreign?.length ?? 0)
	);
}

export interface OfficerStats {
	avgPostingMonths: number | null;
	specialisationLabel: string | null;
	trainingSubject: string | null;
	trainingTotal: number;
}

export function computeOfficerStats(o: NestedOfficer): OfficerStats {
	return {
		avgPostingMonths: avgPostingMonths(o),
		specialisationLabel: topSpecialisation(o),
		trainingSubject: topTrainingSubject(o),
		trainingTotal: trainingTotal(o)
	};
}
