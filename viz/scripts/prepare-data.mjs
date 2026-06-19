#!/usr/bin/env node
/**
 * Builds the browser-facing data artifacts from the nested source table.
 *
 *   Input   data-src/officers_nested.parquet   one nested document per officer
 *   Outputs static/data/education.parquet       flat (identity_no, qualification)
 *           static/data/officers/chunk-NN.parquet
 *                                               nested documents, sharded by id
 *
 * The detail page needs the full nested record for a single officer, so the
 * nested documents are sharded into CHUNK_COUNT Parquet files by a stable hash
 * of identity_no. A visitor loads only the one chunk holding the officer they
 * opened (~175 KB) instead of the whole 3.7 MB table.
 *
 * Education is the only other consumer of the nested table (the directory's
 * education filter and facet), so it is republished as a small flat table and
 * the nested monolith never has to reach the browser.
 *
 * The flat directory/posting tables (officers.parquet, experience.parquet) are
 * produced upstream and are not touched here.
 *
 * CHUNK_COUNT and shardOf must stay in sync with src/lib/data.ts.
 */
import { mkdir, writeFile, rm, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { asyncBufferFromFile, parquetReadObjects } from 'hyparquet';
import { parquetWriteBuffer } from 'hyparquet-writer';

const CHUNK_COUNT = 64;

function shardOf(id) {
	let h = 0x811c9dc5;
	for (let i = 0; i < id.length; i++) {
		h ^= id.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return (h >>> 0) % CHUNK_COUNT;
}

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');
const SOURCE = join(ROOT, 'data-src', 'officers_nested.parquet');
const DATA_DIR = join(ROOT, 'static', 'data');
const OFFICERS_DIR = join(DATA_DIR, 'officers');

function writeParquet(path, rows, columns) {
	const columnData = columns.map((name) => ({ name, data: rows.map((r) => r[name]) }));
	return writeFile(path, Buffer.from(parquetWriteBuffer({ columnData, compressed: true })));
}

async function main() {
	const file = await asyncBufferFromFile(SOURCE);
	const docs = await parquetReadObjects({ file });
	console.log(`Read ${docs.length} nested officer documents`);

	await mkdir(DATA_DIR, { recursive: true });

	const education = [];
	for (const o of docs)
		for (const e of o.education ?? [])
			education.push({
				identity_no: o.identity_no,
				qualification_university_institute: e.qualification_university_institute ?? ''
			});
	await writeParquet(join(DATA_DIR, 'education.parquet'), education, [
		'identity_no',
		'qualification_university_institute'
	]);
	console.log(`  education.parquet: ${education.length} rows`);

	const buckets = Array.from({ length: CHUNK_COUNT }, () => []);
	for (const o of docs) buckets[shardOf(o.identity_no)].push(o);

	await mkdir(OFFICERS_DIR, { recursive: true });
	for (const name of await readdir(OFFICERS_DIR).catch(() => []))
		if (name.endsWith('.parquet')) await rm(join(OFFICERS_DIR, name));

	const columns = Object.keys(docs[0]);
	const width = String(CHUNK_COUNT - 1).length;
	for (let i = 0; i < CHUNK_COUNT; i++) {
		const nn = String(i).padStart(width, '0');
		await writeParquet(join(OFFICERS_DIR, `chunk-${nn}.parquet`), buckets[i], columns);
	}
	const counts = buckets.map((b) => b.length);
	console.log(
		`  officers/chunk-*.parquet: ${CHUNK_COUNT} chunks, ` +
			`${Math.min(...counts)}-${Math.max(...counts)} officers each`
	);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
