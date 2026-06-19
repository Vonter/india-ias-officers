// Source values are raw strings that may be missing or non-standard, so every
// helper degrades gracefully.

const HONORIFICS = [
	'Shri',
	'Smt.',
	'Smt',
	'Ms.',
	'Ms',
	'Mr.',
	'Mr',
	'Mrs.',
	'Mrs',
	'Dr.',
	'Dr',
	'Dr.(Ms.)',
	'Md.',
	'Md'
];

const MONTHS = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December'
];

const ABSENT = new Set(['', 'n.a.', 'na', 'n/a', 'not available', 'nil', '-', '--']);

export function isPresent(value: string | undefined | null): value is string {
	return value != null && !ABSENT.has(value.trim().toLowerCase());
}

/** Missing data renders as the fallback, never a literal "Not Available". */
export function display(value: string | undefined | null, fallback = ''): string {
	return isPresent(value) ? value!.trim() : fallback;
}

// Allotment years outside this window are data artefacts (1900, 0, future).
const EARLIEST_BATCH = 1947;
const LATEST_BATCH = new Date().getFullYear() + 1;

/** A trustworthy four-digit batch year, or null for sentinels like 1900 / 0. */
export function cleanYear(value: string | undefined | null): number | null {
	if (!isPresent(value)) return null;
	const year = Number(value!.trim());
	if (!Number.isInteger(year) || year < EARLIEST_BATCH || year > LATEST_BATCH) return null;
	return year;
}

export function displayYear(value: string | undefined | null): string {
	const year = cleanYear(value);
	return year == null ? '' : String(year);
}

// A posting left open-ended ("Till-Date") for longer than this is treated as
// stale source data rather than a genuinely ongoing tenure.
const STALE_POSTING_YEARS = 8;

/** Parse a dd/mm/yyyy source date into a Date, or null. */
export function parseDate(value: string | undefined | null): Date | null {
	if (!isPresent(value)) return null;
	const match = value!.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
	if (!match) return null;
	const [, d, m, y] = match;
	const date = new Date(Number(y), Number(m) - 1, Number(d));
	return Number.isNaN(date.getTime()) ? null : date;
}

/** Render a dd/mm/yyyy source date as "12 March 1975", or "March 1975" when monthOnly. */
export function formatDate(value: string | undefined | null, monthOnly = false): string {
	const date = parseDate(value);
	if (!date) return display(value);
	const monthYear = `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
	return monthOnly ? monthYear : `${date.getDate()} ${monthYear}`;
}

/** Year of a dd/mm/yyyy source date, or the cleaned value if not a full date. */
export function formatYear(value: string | undefined | null): string {
	const date = parseDate(value);
	return date ? String(date.getFullYear()) : display(value);
}

/** "Till-Date" / open-ended postings are recorded as ongoing in the source. */
export function isOngoing(periodTo: string | undefined | null): boolean {
	if (!isPresent(periodTo)) return false;
	const v = periodTo!.trim().toLowerCase().replace(/[\s-]/g, '');
	return v === 'tilldate';
}

/** Years since a source date, or null if it can't be parsed. */
function yearsSince(value: string | undefined | null): number | null {
	const date = parseDate(value);
	if (!date) return null;
	return (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
}

/**
 * A posting that counts as the officer's present role: open-ended and begun
 * recently enough to be credible. `live = false` vetoes currency outright (e.g.
 * a retired officer holds no present posting whatever the dates say).
 */
export function isCurrentPosting(from: string, to: string, live = true): boolean {
	if (!live || !isOngoing(to)) return false;
	const years = yearsSince(from);
	return years == null || years <= STALE_POSTING_YEARS;
}

export function formatPeriod(from: string, to: string, live = true, monthOnly = false): string {
	if (!isPresent(from) && !isPresent(to)) return '';
	const start = formatDate(from, monthOnly);
	if (isCurrentPosting(from, to, live)) return isPresent(from) ? `${start} – Present` : 'Present';
	// Stale open-ended tenures: the true end is unknown, so leave it blank.
	if (isOngoing(to)) return isPresent(from) ? `Since ${start}` : '';
	const end = formatDate(to, monthOnly);
	if (!isPresent(from)) return end;
	if (!isPresent(to)) return start;
	return `${start} – ${end}`;
}

/** Whole years between two source dates (to today only for live tenures). */
export function durationYears(from: string, to: string, live = true): number | null {
	const start = parseDate(from);
	if (!start) return null;
	if (isOngoing(to) && !isCurrentPosting(from, to, live)) return null;
	const end = isOngoing(to) ? new Date() : parseDate(to);
	if (!end) return null;
	const ms = end.getTime() - start.getTime();
	if (ms < 0) return null;
	return ms / (1000 * 60 * 60 * 24 * 365.25);
}

/** Render a span of months as "1 mo" / "8 mos" / "2 yrs" / "2 yrs 5 mos". */
export function formatMonths(months: number): string {
	const years = months / 12;
	if (years < 1) {
		const m = Math.round(months);
		return m <= 1 ? '1 mo' : `${m} mos`;
	}
	const whole = Math.floor(years);
	const rem = Math.round((years - whole) * 12);
	if (rem === 0) return whole === 1 ? '1 yr' : `${whole} yrs`;
	return `${whole} yr${whole === 1 ? '' : 's'} ${rem} mo${rem === 1 ? '' : 's'}`;
}

export function formatDuration(from: string, to: string, live = true): string {
	const years = durationYears(from, to, live);
	if (years == null) return '';
	return formatMonths(years * 12);
}

/**
 * Months of unrecorded time between an earlier posting's end and a later
 * posting's start, or null when either date is missing/open-ended or the
 * postings meet or overlap. Used to flag breaks in the career timeline.
 */
export function gapMonths(earlierTo: string, laterFrom: string): number | null {
	const end = parseDate(earlierTo);
	const start = parseDate(laterFrom);
	if (!end || !start) return null;
	const ms = start.getTime() - end.getTime();
	if (ms <= 0) return null;
	return (ms / (1000 * 60 * 60 * 24 * 365.25)) * 12;
}

/** Drop a leading honorific (Shri, Smt., Dr., …) from a name. */
export function stripHonorific(name: string): string {
	let result = name.trim();
	for (const h of HONORIFICS) {
		if (result.toLowerCase().startsWith(h.toLowerCase() + ' ')) {
			result = result.slice(h.length).trim();
			break;
		}
	}
	return result;
}

export function isServing(retirementReason: string | undefined | null): boolean {
	return isPresent(retirementReason) && retirementReason!.trim().toLowerCase() === 'serving';
}

/**
 * The authoritative serving test: in active service only when the record says
 * "Serving" *and* a live posting is still held. Any other retirement reason or
 * the absence of a current posting means the officer has left the service.
 */
export function computeServing(
	retirementReason: string | undefined | null,
	hasCurrentPosting: boolean
): boolean {
	if (!hasCurrentPosting) return false;
	return isPresent(retirementReason) ? isServing(retirementReason) : true;
}

const NOT_AVAILABLE =
	/^(n\.?\s*(applicable|available)|n\.?\/?a\.?|not (applicable|available))\.?$/i;

/**
 * Split a "Major / Minor" field-of-experience label into its distinct parts,
 * dropping the frequent "Finance / Finance" duplication and not-available noise.
 */
export function splitExperience(value: string | undefined | null): string[] {
	if (!isPresent(value)) return [];
	const out: string[] = [];
	for (const raw of value!.split('/')) {
		const part = raw.trim();
		if (!part || NOT_AVAILABLE.test(part)) continue;
		if (!out.some((p) => p.toLowerCase() === part.toLowerCase())) out.push(part);
	}
	return out;
}
