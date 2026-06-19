// Source department and position strings are entered by hand and riddled with
// abbreviations, punctuation and casing differences. We collapse each raw value
// to a canonical *key* so that the obvious variants of one entity group together
// ("Finance Deptt", "Finance Department", "Finance Dept." → one key), while the
// most common raw spelling survives as the display label.

// Whole-word expansions of the abbreviations that dominate the source data.
const EXPANSIONS: [RegExp, string][] = [
	[/\bdept?t?s?\b\.?/gi, 'department'],
	[/\bdeptt\b\.?/gi, 'department'],
	[/\bsectt\b\.?/gi, 'secretariat'],
	[/\bsect\b\.?/gi, 'secretariat'],
	[/\bsecy\b\.?/gi, 'secretary'],
	[/\bsecys\b\.?/gi, 'secretaries'],
	[/\badmin\b\.?/gi, 'administration'],
	[/\badmn\b\.?/gi, 'administration'],
	[/\bdev\b\.?/gi, 'development'],
	[/\bdevp?t?\b\.?/gi, 'development'],
	[/\bgovt\b\.?/gi, 'government'],
	[/\bcorpn\b\.?/gi, 'corporation'],
	[/\bcommr\b\.?/gi, 'commissioner'],
	[/\bdistt\b\.?/gi, 'district'],
	[/\bmin\b\.?/gi, 'ministry'],
	[/\borgn\b\.?/gi, 'organisation'],
	[/\borganization\b/gi, 'organisation'],
	[/\bdir\b\.?/gi, 'director'],
	[/\baddl\b\.?/gi, 'additional'],
	[/\bspl\b\.?/gi, 'special'],
	[/\bprin\b\.?/gi, 'principal']
];

/** A stable grouping key — lower-cased, abbreviation-expanded, punctuation-free. */
export function canonicalKey(raw: string): string {
	let value = ` ${raw.toLowerCase()} `;
	value = value.replace(/&/g, ' and ');
	for (const [pattern, replacement] of EXPANSIONS) value = value.replace(pattern, replacement);
	value = value
		.replace(/[^a-z0-9 ]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	return value;
}

/**
 * Pick the best display label for a group of raw spellings that share a key:
 * the most frequent, breaking ties toward the longer (usually un-abbreviated)
 * form so "Finance Department" beats "Finance Deptt".
 */
export function pickLabel(counts: Map<string, number>): string {
	let best = '';
	let bestCount = -1;
	for (const [raw, count] of counts) {
		if (count > bestCount || (count === bestCount && raw.length > best.length)) {
			best = raw;
			bestCount = count;
		}
	}
	return best;
}
