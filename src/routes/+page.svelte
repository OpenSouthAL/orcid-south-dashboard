<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { navigating } from '$app/state';
	import { QUERY } from '#lib/orcid.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const REFRESH_MS = 10 * 60 * 1000;
	$effect(() => {
		const id = setInterval(invalidateAll, REFRESH_MS);
		return () => clearInterval(id);
	});

	let refreshing = $state(false);
	async function refresh() {
		refreshing = true;
		await invalidateAll();
		refreshing = false;
	}

	const points = $derived(data.series.points);
	const total = $derived(data.series.total);

	// Layout
	let width = $state(800);
	const height = 360;
	const margin = { top: 16, right: 56, bottom: 32, left: 48 };
	const plotW = $derived(Math.max(width - margin.left - margin.right, 1));
	const plotH = height - margin.top - margin.bottom;

	// Scales
	const yMax = $derived(niceMax(Math.max(total, 1)));
	const x = (i: number) => margin.left + (i / Math.max(points.length - 1, 1)) * plotW;
	const y = (v: number) => margin.top + plotH - (v / yMax) * plotH;

	function niceMax(v: number) {
		const step = 10 ** Math.floor(Math.log10(v));
		for (const m of [1, 2, 2.5, 5, 10]) if (m * step >= v) return m * step;
		return 10 * step;
	}

	const yTicks = $derived(Array.from({ length: 5 }, (_, i) => (yMax / 4) * i));
	// January of every year, thinned out on narrow screens
	const xTicks = $derived.by(() => {
		const januaries = points.flatMap((p, i) => (p.month.endsWith('-01') ? [i] : []));
		const every = Math.ceil(januaries.length / Math.max(Math.floor(plotW / 56), 1));
		return januaries.filter((_, k) => k % every === 0);
	});

	const line = $derived(points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.count)}`).join(''));
	const area = $derived(
		`${line}L${x(points.length - 1)},${y(0)}L${x(0)},${y(0)}Z`
	);

	// Hover
	let hover = $state<number | null>(null);
	function onPointer(e: PointerEvent) {
		const svg = e.currentTarget as SVGSVGElement;
		const px = e.clientX - svg.getBoundingClientRect().left;
		const i = Math.round(((px - margin.left) / plotW) * (points.length - 1));
		hover = Math.min(Math.max(i, 0), points.length - 1);
	}

	const fmtMonth = (month: string) =>
		new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-US', {
			month: 'short',
			year: 'numeric',
			timeZone: 'UTC'
		});
	const fmtNum = (n: number) => n.toLocaleString('en-US');
</script>

<svelte:head>
	<title>USA ORCID Accounts</title>
</svelte:head>

<main class="mx-auto max-w-5xl py-4">
	<header class="mb-6 flex flex-wrap items-end justify-between gap-4">
		<div>
			<h1 class="text-2xl font-semibold">ORCID accounts at the University of South Alabama</h1>
			<p class="mt-1 text-sm text-(--text-secondary)">
				Cumulative ORCID accounts created, by month, for people whose current affiliation is the
				University of South Alabama
			</p>
		</div>
		<div class="text-right">
			<div class="text-5xl font-semibold">{fmtNum(total)}</div>
			<div class="text-sm text-(--text-secondary)">accounts to date</div>
		</div>
	</header>

	<div
		class="relative transition-opacity"
		class:opacity-50={refreshing || !!navigating.to}
		bind:clientWidth={width}
	>
		<svg
			{width}
			{height}
			role="img"
			aria-label="Line chart of cumulative ORCID accounts by month, reaching {fmtNum(total)}"
			class="block touch-none select-none"
			onpointermove={onPointer}
			onpointerdown={onPointer}
			onpointerleave={() => (hover = null)}
		>
			{#each yTicks as t (t)}
				<line x1={margin.left} x2={margin.left + plotW} y1={y(t)} y2={y(t)} stroke="var(--grid)" />
				<text
					x={margin.left - 8}
					y={y(t)}
					dy="0.32em"
					text-anchor="end"
					class="fill-(--text-secondary) text-xs tabular-nums">{fmtNum(t)}</text
				>
			{/each}
			{#each xTicks as i (i)}
				<text
					x={x(i)}
					y={height - 8}
					text-anchor="middle"
					class="fill-(--text-secondary) text-xs tabular-nums">{points[i].month.slice(0, 4)}</text
				>
			{/each}

			<path d={area} fill="var(--series-1)" fill-opacity="0.1" />
			<path
				d={line}
				fill="none"
				stroke="var(--series-1)"
				stroke-width="2"
				stroke-linejoin="round"
				stroke-linecap="round"
			/>

			<!-- End label -->
			{#if points.length}
				<circle
					cx={x(points.length - 1)}
					cy={y(total)}
					r="4"
					fill="var(--series-1)"
					stroke="var(--surface-1)"
					stroke-width="2"
				/>
				<text
					x={x(points.length - 1) + 8}
					y={y(total)}
					dy="0.32em"
					class="fill-(--text-primary) text-xs font-semibold tabular-nums">{fmtNum(total)}</text
				>
			{/if}

			{#if hover !== null}
				<line
					x1={x(hover)}
					x2={x(hover)}
					y1={margin.top}
					y2={margin.top + plotH}
					stroke="var(--text-secondary)"
				/>
				<circle
					cx={x(hover)}
					cy={y(points[hover].count)}
					r="4"
					fill="var(--series-1)"
					stroke="var(--surface-1)"
					stroke-width="2"
				/>
			{/if}
		</svg>

		{#if hover !== null}
			{@const p = points[hover]}
			<div
				class="pointer-events-none absolute top-2 rounded-md border border-(--grid) bg-(--surface-1) px-3 py-2 text-sm shadow-md"
				style:left="{Math.min(x(hover) + 12, width - 160)}px"
			>
				<div class="flex items-center gap-2">
					<span class="inline-block h-0.5 w-3 rounded bg-(--series-1)"></span>
					<span class="font-semibold tabular-nums">{fmtNum(p.count)}</span>
					<span class="text-(--text-secondary)">accounts</span>
				</div>
				<div class="text-xs text-(--text-secondary)">by end of {fmtMonth(p.month)}</div>
			</div>
		{/if}
	</div>

	<div class="mt-4 flex flex-wrap items-center justify-between gap-4 text-sm text-(--text-secondary)">
		<span>
			Updated {new Date(data.series.fetchedAt).toLocaleString('en-US')} · refreshes every 10 minutes
		</span>
		<button
			class="rounded-md border border-(--grid) px-3 py-1 hover:bg-(--grid) disabled:opacity-50"
			onclick={refresh}
			disabled={refreshing}
		>
			{refreshing ? 'Refreshing…' : 'Refresh'}
		</button>
	</div>

	<details class="mt-6 text-sm">
		<summary class="cursor-pointer text-(--text-secondary)">Show data table</summary>
		<table class="mt-2 tabular-nums">
			<thead>
				<tr><th class="pr-6 text-left">Month</th><th class="text-right">Accounts</th></tr>
			</thead>
			<tbody>
				{#each points.toReversed() as p (p.month)}
					<tr><td class="pr-6">{fmtMonth(p.month)}</td><td class="text-right">{fmtNum(p.count)}</td></tr>
				{/each}
			</tbody>
		</table>
	</details>

	<footer class="mt-6 text-xs text-(--text-secondary)">
		Data comes live from the
		<a class="underline" href="https://info.orcid.org/documentation/api-tutorials/api-tutorial-searching-the-orcid-registry/"
			>ORCID public search API</a
		>
		with the query <code>{QUERY}</code>, counted by account creation date. It includes everyone
		(faculty, staff and students) who lists the university as a current affiliation on a public
		ORCID record.
	</footer>
</main>
