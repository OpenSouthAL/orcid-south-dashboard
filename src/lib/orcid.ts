// ORCID accounts at the University of South Alabama. Per-account creation dates
// and roles come from a daily snapshot (scripts/build-accounts.ts); the
// headline total is counted live from the public ORCID search API.

import snapshot from './data/accounts.json';
import type { Account } from './classify.ts';

export const QUERY = 'current-institution-affiliation-name:"University of South Alabama"';

const SEARCH_URL = 'https://pub.orcid.org/v3.0/search/';
// ORCID launched in October 2012
const FIRST_MONTH = { year: 2012, month: 9 };

export const GROUPS = ['faculty', 'student', 'staff', 'unknown'] as const;
export type Group = (typeof GROUPS)[number];

export const GROUP_LABELS: Record<Group, string> = {
	faculty: 'Faculty',
	student: 'Students & trainees',
	staff: 'Staff & postdocs',
	unknown: 'Unknown'
};

export interface Point {
	/** YYYY-MM */
	month: string;
	/** Accounts created on or before the end of this month */
	total: number;
	byGroup: Record<Group, number>;
}

export interface Series {
	points: Point[];
	snapshotAt: string;
	/** How many accounts in each group were classified by weaker signals, not a role title */
	inferred: Record<Group, number>;
}

function group(a: Account): Group {
	return a.role === 'postdoc' ? 'staff' : a.role;
}

const zero = (): Record<Group, number> => ({ faculty: 0, student: 0, staff: 0, unknown: 0 });

export function getSeries(): Series {
	const accounts = snapshot.accounts as Account[];
	const now = new Date();
	const points: Point[] = [];
	const running = zero();
	let total = 0;
	let next = 0;
	for (
		let d = new Date(Date.UTC(FIRST_MONTH.year, FIRST_MONTH.month, 1));
		d <= now;
		d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
	) {
		const month = d.toISOString().slice(0, 7);
		// accounts are sorted by creation date
		while (next < accounts.length && accounts[next].created.slice(0, 7) <= month) {
			running[group(accounts[next++])]++;
			total++;
		}
		points.push({ month, total, byGroup: { ...running } });
	}

	const inferred = zero();
	for (const a of accounts) if (a.basis === 'inferred') inferred[group(a)]++;

	return { points, snapshotAt: snapshot.fetchedAt, inferred };
}

/** Live count of all matching accounts, straight from ORCID. */
export async function liveTotal(fetch: typeof globalThis.fetch): Promise<number> {
	const res = await fetch(`${SEARCH_URL}?rows=0&q=${encodeURIComponent(QUERY)}`, {
		headers: { Accept: 'application/json' }
	});
	if (!res.ok) throw new Error(`ORCID search failed: ${res.status} ${res.statusText}`);
	const body: { 'num-found': number } = await res.json();
	return body['num-found'];
}
