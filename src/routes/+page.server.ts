import { getSeries, type Series } from '#lib/orcid.ts';
import type { PageServerLoad } from './$types';

// Each refresh makes ~170 requests to ORCID, so share one result across visitors
const CACHE_KEY = 'https://cache.internal/orcid-series';
const CACHE_SECONDS = 60 * 60;

export const load: PageServerLoad = async ({ fetch, platform, setHeaders }) => {
	const cache = await platform?.caches.open('orcid');

	let series: Series | undefined = await (await cache?.match(CACHE_KEY))?.json();
	if (!series) {
		series = await getSeries(fetch);
		await cache?.put(
			CACHE_KEY,
			new Response(JSON.stringify(series), {
				headers: { 'cache-control': `public, max-age=${CACHE_SECONDS}` }
			})
		);
	}

	setHeaders({ 'cache-control': 'public, max-age=600' });
	return { series };
};
