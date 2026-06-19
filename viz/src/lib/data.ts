import { asyncBufferFromUrl, parquetReadObjects } from 'hyparquet';
import { base } from '$app/paths';
import { canonicalKey } from './canonical';
import { computeServing, isCurrentPosting, isPresent } from './format';
import type { Officer, NestedOfficer, ExperienceRow, EducationRow, Posting } from './types';

// Each Parquet file is fetched once and memoised for the lifetime of the tab.
// Passing `columns` reads only those column chunks over HTTP range requests.
const tables = new Map<string, Promise<unknown[]>>();

function loadTable<T>(name: string, columns?: string[]): Promise<T[]> {
	let pending = tables.get(name);
	if (!pending) {
		pending = (async () => {
			const file = await asyncBufferFromUrl({ url: `${base}/data/${name}.parquet` });
			return parquetReadObjects({ file, columns });
		})();
		tables.set(name, pending);
	}
	return pending as Promise<T[]>;
}

// The directory only reads these posting columns; skipping the rest (organisation,
// experience_major_minor, sno) trims the experience download substantially.
const EXPERIENCE_COLUMNS = [
	'identity_no',
	'designation_level',
	'ministry_dept_office_location',
	'period_from',
	'period_to'
];

export const loadExperience = () => loadTable<ExperienceRow>('experience', EXPERIENCE_COLUMNS);
export const loadEducation = () => loadTable<EducationRow>('education');

// The set of officers holding at least one live posting today.
let servingSet: Promise<Set<string>> | null = null;
function loadCurrentlyPosted(): Promise<Set<string>> {
	if (!servingSet) {
		servingSet = loadExperience().then((rows) => {
			const posted = new Set<string>();
			for (const row of rows) {
				if (isCurrentPosting(row.period_from, row.period_to)) posted.add(row.identity_no);
			}
			return posted;
		});
	}
	return servingSet;
}

// Officers are enriched at load time with a trustworthy serving flag, derived by
// joining the retirement reason with whether the officer still holds a posting.
let officers: Promise<Officer[]> | null = null;
export function loadOfficers(): Promise<Officer[]> {
	if (!officers) {
		officers = Promise.all([loadTable<Officer>('officers'), loadCurrentlyPosted()]).then(
			([rows, posted]) => {
				for (const o of rows)
					o.serving = computeServing(o.retirement_reason, posted.has(o.identity_no));
				return rows;
			}
		);
	}
	return officers;
}

let officerIndex: Promise<Map<string, Officer>> | null = null;
export function loadOfficerIndex(): Promise<Map<string, Officer>> {
	if (!officerIndex) {
		officerIndex = loadOfficers().then((rows) => new Map(rows.map((o) => [o.identity_no, o])));
	}
	return officerIndex;
}

// The full nested record per officer is sharded into CHUNK_COUNT Parquet files by
// a stable hash of identity_no, so the detail page fetches only the one chunk that
// holds the requested officer. CHUNK_COUNT and shardOf mirror scripts/prepare-data.mjs.
const CHUNK_COUNT = 64;
const CHUNK_WIDTH = String(CHUNK_COUNT - 1).length;

function shardOf(id: string): number {
	let h = 0x811c9dc5;
	for (let i = 0; i < id.length; i++) {
		h ^= id.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return (h >>> 0) % CHUNK_COUNT;
}

const officerChunks = new Map<number, Promise<Map<string, NestedOfficer>>>();
function loadOfficerChunk(shard: number): Promise<Map<string, NestedOfficer>> {
	let pending = officerChunks.get(shard);
	if (!pending) {
		const nn = String(shard).padStart(CHUNK_WIDTH, '0');
		pending = loadTable<NestedOfficer>(`officers/chunk-${nn}`).then(
			(rows) => new Map(rows.map((o) => [o.identity_no, o]))
		);
		officerChunks.set(shard, pending);
	}
	return pending;
}

export async function loadOfficer(id: string): Promise<NestedOfficer | null> {
	return (await loadOfficerChunk(shardOf(id))).get(id) ?? null;
}

// For the join-based filters (department, position, education), each officer is
// mapped to the set of canonical keys they touch, so the directory can be sliced
// by a posting or qualification the same way it is sliced by a biodata column.
const postingKeyCache = new Map<string, Promise<Map<string, Set<string>>>>();

function buildKeyIndex(
	rows: Iterable<{ identity_no: string }>,
	keysOf: (row: { identity_no: string }) => Iterable<string>
): Map<string, Set<string>> {
	const index = new Map<string, Set<string>>();
	for (const row of rows) {
		for (const raw of keysOf(row)) {
			if (!isPresent(raw)) continue;
			const key = canonicalKey(raw);
			if (!key || key.includes('not available')) continue;
			let set = index.get(row.identity_no);
			if (!set) index.set(row.identity_no, (set = new Set()));
			set.add(key);
		}
	}
	return index;
}

function loadPostingKeys(field: keyof Posting): Promise<Map<string, Set<string>>> {
	let pending = postingKeyCache.get(field);
	if (!pending) {
		pending = loadExperience().then((rows) =>
			buildKeyIndex(rows, (row) => [(row as ExperienceRow)[field]])
		);
		postingKeyCache.set(field, pending);
	}
	return pending;
}

export const loadDepartmentKeys = () => loadPostingKeys('ministry_dept_office_location');
export const loadPositionKeys = () => loadPostingKeys('designation_level');

let educationKeys: Promise<Map<string, Set<string>>> | null = null;
export function loadEducationKeys(): Promise<Map<string, Set<string>>> {
	if (!educationKeys) {
		educationKeys = loadEducation().then((rows) =>
			buildKeyIndex(rows, (row) => [(row as EducationRow).qualification_university_institute])
		);
	}
	return educationKeys;
}
