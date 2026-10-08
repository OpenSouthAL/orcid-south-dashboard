// Builds src/lib/data/accounts.json: every ORCID account whose current
// affiliation is the University of South Alabama, with its creation date and a
// best-guess role (faculty / student / staff / postdoc / unknown).
//
// The ORCID search index can't filter by role, so this fetches each record.
// Run with: node scripts/build-accounts.ts

import { writeFile, mkdir } from 'node:fs/promises';
import { classify, type Account } from '../src/lib/classify.ts';
import { QUERY } from '../src/lib/orcid.ts';

const API = 'https://pub.orcid.org/v3.0';
const HEADERS = { Accept: 'application/json' };
// ORCID's public API allows 24 requests/second
const CONCURRENCY = 8;
const OUT = new URL('../src/lib/data/accounts.json', import.meta.url);

async function get(url: string, tries = 4): Promise<any> {
	for (let i = 1; ; i++) {
		const res = await fetch(url, { headers: HEADERS });
		if (res.ok) return res.json();
		if (i >= tries || (res.status !== 429 && res.status < 500)) {
			throw new Error(`${res.status} ${res.statusText}: ${url}`);
		}
		await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
	}
}

async function searchIds(): Promise<string[]> {
	const ids: string[] = [];
	for (let start = 0; ; start += 1000) {
		const page = await get(`${API}/search/?rows=1000&start=${start}&q=${encodeURIComponent(QUERY)}`);
		const result: any[] = page.result ?? [];
		ids.push(...result.map((r) => r['orcid-identifier'].path));
		if (!result.length || ids.length >= page['num-found']) return ids;
	}
}

const ids = await searchIds();
console.log(`Fetching ${ids.length} records…`);

const accounts: Account[] = [];
let next = 0;
async function worker() {
	while (next < ids.length) {
		const id = ids[next++];
		accounts.push(classify(id, await get(`${API}/${id}/record`)));
		if (accounts.length % 100 === 0) console.log(`  ${accounts.length}/${ids.length}`);
	}
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

accounts.sort((a, b) => a.created.localeCompare(b.created) || a.orcid.localeCompare(b.orcid));
const tally = Object.groupBy(accounts, (a) => `${a.role} (${a.basis})`);
console.table(Object.fromEntries(Object.entries(tally).map(([k, v]) => [k, v!.length])));

await mkdir(new URL('.', OUT), { recursive: true });
await writeFile(
	OUT,
	JSON.stringify({ fetchedAt: new Date().toISOString(), accounts }, null, '\t') + '\n'
);
console.log(`Wrote ${accounts.length} accounts to ${OUT.pathname}`);
