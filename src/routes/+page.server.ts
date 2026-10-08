import { getSeries, liveTotal } from '#lib/orcid.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, setHeaders }) => {
	let live: number | null = null;
	try {
		live = await liveTotal(fetch);
	} catch (e) {
		console.error(e);
	}

	setHeaders({ 'cache-control': 'public, max-age=600' });
	return { series: getSeries(), live, fetchedAt: new Date().toISOString() };
};
