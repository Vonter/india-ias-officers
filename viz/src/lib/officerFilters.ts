import { cleanYear, isPresent, stripHonorific } from './format';
import type { Officer } from './types';

// One shared definition of how the officer directory is filtered and sorted, so
// the home page and every facet detail page behave identically.

export type OfficerSort = 'seniority' | 'junior' | 'name' | 'name-desc';

export interface OfficerFilters {
	q: string;
	cadre: string;
	yearFrom: string;
	yearTo: string;
	gender: string;
	status: string;
	deputation: string;
	domicile: string;
	recruitment: string;
	motherTongue: string;
	service: string;
	/** Representative labels for the join-based facets; matched via canonical key. */
	department: string;
	position: string;
	education: string;
	sort: OfficerSort;
}

/** Lookup tables for the join-based facets, with the active filter pre-canonicalised. */
export interface MatchContext {
	deptIndex?: Map<string, Set<string>> | null;
	deptKey?: string;
	posIndex?: Map<string, Set<string>> | null;
	posKey?: string;
	eduIndex?: Map<string, Set<string>> | null;
	eduKey?: string;
}

const VALUE_KEYS = [
	'q',
	'cadre',
	'yearFrom',
	'yearTo',
	'gender',
	'status',
	'deputation',
	'domicile',
	'recruitment',
	'motherTongue',
	'service',
	'department',
	'position',
	'education'
] as const satisfies readonly (keyof OfficerFilters)[];

export function emptyFilters(): OfficerFilters {
	return {
		q: '',
		cadre: '',
		yearFrom: '',
		yearTo: '',
		gender: '',
		status: '',
		deputation: '',
		domicile: '',
		recruitment: '',
		motherTongue: '',
		service: '',
		department: '',
		position: '',
		education: '',
		sort: 'seniority'
	};
}

/** Reset the value-carrying filters, leaving the sort order untouched. */
export function clearFilters(f: OfficerFilters): void {
	for (const k of VALUE_KEYS) f[k] = '';
}

export function activeFilterCount(f: OfficerFilters): number {
	return VALUE_KEYS.filter((k) => f[k]).length;
}

// The free-text query (`f.q`) is matched fuzzily by the caller, so it is not
// considered here.
export function officerMatches(o: Officer, f: OfficerFilters, ctx: MatchContext = {}): boolean {
	if (f.cadre && o.cadre !== f.cadre) return false;
	if (f.gender && o.gender !== f.gender) return false;
	if (f.domicile && o.place_of_domicile?.trim() !== f.domicile) return false;
	if (f.recruitment && o.source_of_recruitment?.trim() !== f.recruitment) return false;
	if (f.motherTongue && o.mother_tongue?.trim() !== f.motherTongue) return false;
	if (f.service && o.service?.trim() !== f.service) return false;
	if (f.deputation === 'yes' && o.on_central_deputation?.toLowerCase() !== 'yes') return false;
	if (f.status === 'serving' && !o.serving) return false;
	if (f.status === 'retired' && o.serving) return false;
	const yr = cleanYear(o.allotment_year);
	if (f.yearFrom && (!yr || yr < Number(f.yearFrom))) return false;
	if (f.yearTo && (!yr || yr > Number(f.yearTo))) return false;
	// Join-based facets only narrow once their index has loaded.
	if (f.department && ctx.deptIndex && !ctx.deptIndex.get(o.identity_no)?.has(ctx.deptKey ?? ''))
		return false;
	if (f.position && ctx.posIndex && !ctx.posIndex.get(o.identity_no)?.has(ctx.posKey ?? ''))
		return false;
	if (f.education && ctx.eduIndex && !ctx.eduIndex.get(o.identity_no)?.has(ctx.eduKey ?? ''))
		return false;
	return true;
}

export function compareOfficers(a: Officer, b: Officer, sort: OfficerSort): number {
	if (sort === 'name') return stripHonorific(a.name).localeCompare(stripHonorific(b.name));
	if (sort === 'name-desc') return stripHonorific(b.name).localeCompare(stripHonorific(a.name));
	// Both seniority orderings list currently serving officers ahead of everyone
	// else, then rank by batch within each group.
	if (a.serving !== b.serving) return a.serving ? -1 : 1;
	if (sort === 'junior') {
		return (cleanYear(b.allotment_year) ?? 0) - (cleanYear(a.allotment_year) ?? 0);
	}
	// seniority: oldest batch first, then alphabetical.
	return (
		(cleanYear(a.allotment_year) ?? 9999) - (cleanYear(b.allotment_year) ?? 9999) ||
		stripHonorific(a.name).localeCompare(stripHonorific(b.name))
	);
}

export const SORT_OPTIONS: { value: OfficerSort; label: string }[] = [
	{ value: 'seniority', label: 'Most senior first' },
	{ value: 'junior', label: 'Most junior first' },
	{ value: 'name', label: 'Name (A–Z)' },
	{ value: 'name-desc', label: 'Name (Z–A)' }
];

/** Distinct, sorted cadre options drawn from a pool of officers. */
export function cadreOptions(pool: Officer[]): string[] {
	return [...new Set(pool.map((o) => o.cadre).filter(isPresent))].sort();
}

/** Distinct, sorted values of any string-valued officer column. */
export function distinctValues(pool: Officer[], field: keyof Officer): string[] {
	const out = new Set<string>();
	for (const o of pool) {
		const v = o[field];
		if (typeof v === 'string' && isPresent(v)) out.add(v.trim());
	}
	return [...out].sort((a, b) => a.localeCompare(b));
}

/** Distinct allotment years, newest first, drawn from a pool of officers. */
export function yearOptions(pool: Officer[]): number[] {
	return [
		...new Set(pool.map((o) => cleanYear(o.allotment_year)).filter((y): y is number => y != null))
	].sort((a, b) => b - a);
}
