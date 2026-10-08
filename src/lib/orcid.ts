// Counts of ORCID accounts by creation date, from the public ORCID search API.
// The search results don't include creation dates, so each point is a
// `rows=0` range query on `profile-submission-date` that only returns a count.

export const QUERY = 'current-institution-affiliation-name:"University of South Alabama"';

const SEARCH_URL = 'https://pub.orcid.org/v3.0/search/';
// ORCID launched in October 2012
const FIRST_MONTH = { year: 2012, month: 9 };
// ORCID's public API allows 24 requests/second
const CONCURRENCY = 8;

export interface Point {
	/** First day of the month, as YYYY-MM */
	month: string;
	/** Accounts created on or before the end of this month */
	count: number;
}

export interface Series {
	points: Point[];
	total: number;
	fetchedAt: string;
}

type Fetch = typeof fetch;

/** Number of matching accounts created strictly before `date`. */
export async function countBefore(date: Date, fetch: Fetch): Promise<number> {
	const q = `${QUERY} AND profile-submission-date:[* TO ${date.toISOString()}}`;
	const res = await fetch(`${SEARCH_URL}?rows=0&q=${encodeURIComponent(q)}`, {
		headers: { Accept: 'application/json' }
	});
	if (!res.ok) throw new Error(`ORCID search failed: ${res.status} ${res.statusText}`);
	const body: { 'num-found': number } = await res.json();
	return body['num-found'];
}

export async function getSeries(fetch: Fetch): Promise<Series> {
	const now = new Date();
	const months: Date[] = [];
	for (
		let d = new Date(Date.UTC(FIRST_MONTH.year, FIRST_MONTH.month, 1));
		d <= now;
		d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
	) {
		months.push(d);
	}

	const counts = new Array<number>(months.length);
	let next = 0;
	async function worker() {
		while (next < months.length) {
			const i = next++;
			const m = months[i];
			counts[i] = await countBefore(
				new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1)),
				fetch
			);
		}
	}
	await Promise.all(Array.from({ length: CONCURRENCY }, worker));

	const points = months.map((m, i) => ({
		month: m.toISOString().slice(0, 7),
		count: counts[i]
	}));
	return { points, total: counts.at(-1) ?? 0, fetchedAt: now.toISOString() };
}
