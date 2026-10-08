<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { navigating } from '$app/state';
	import { GROUPS, GROUP_LABELS, QUERY, type Group, type Point } from '#lib/orcid.ts';
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

	// One line per group plus the overall total. Colors follow the series, never its rank.
	type Key = 'total' | Group;
	const SERIES: { key: Key; label: string; color: string }[] = [
		{ key: 'total', label: 'All accounts', color: 'var(--text-primary)' },
		{ key: 'faculty', label: GROUP_LABELS.faculty, color: 'var(--series-1)' },
		{ key: 'student', label: GROUP_LABELS.student, color: 'var(--series-2)' },
		{ key: 'staff', label: GROUP_LABELS.staff, color: 'var(--series-3)' },
		{ key: 'unknown', label: GROUP_LABELS.unknown, color: 'var(--series-muted)' }
	];
	const value = (p: Point, key: Key) => (key === 'total' ? p.total : p.byGroup[key]);

	let hidden = $state<Partial<Record<Key, boolean>>>({});
	const visible = $derived(SERIES.filter((s) => !hidden[s.key]));

	const points = $derived(data.series.points);
	const last = $derived(points.at(-1)!);
	const headline = $derived(data.live ?? last.total);
	const sinceSnapshot = $derived(data.live === null ? 0 : data.live - last.total);

	// Layout
	let width = $state(800);
	const height = 360;
	const margin = { top: 16, right: 16, bottom: 32, left: 48 };
	const plotW = $derived(Math.max(width - margin.left - margin.right, 1));
	const plotH = height - margin.top - margin.bottom;

	// Scales
	const yMax = $derived(
		niceMax(Math.max(1, ...visible.map((s) => value(last, s.key))))
	);
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

	// Milestones marked on the chart
	const EVENTS = [
		{ month: '2023-08', label: 'Open South FLC formed (Aug 2023)', detail: 'during the "Year of Open Science"' }
	];
	const events = $derived(
		EVENTS.flatMap((e) => {
			const i = points.findIndex((p) => p.month === e.month);
			return i < 0 ? [] : [{ ...e, i }];
		})
	);

	const path = (key: Key) =>
		points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(value(p, key))}`).join('');

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
	const fmtDate = (iso: string) => new Date(iso).toLocaleString('en-US');
	const fmtNum = (n: number) => n.toLocaleString('en-US');
	const pct = (n: number) => `${Math.round((n / last.total) * 100)}%`;
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
			<div class="text-5xl font-semibold">{fmtNum(headline)}</div>
			<div class="text-sm text-(--text-secondary)">
				accounts today{#if sinceSnapshot > 0}&nbsp;· {fmtNum(sinceSnapshot)} new since the last
					snapshot{/if}
			</div>
		</div>
	</header>

	<!-- Legend, doubling as series toggles -->
	<div class="mb-3 flex flex-wrap gap-2 text-sm" role="group" aria-label="Series">
		{#each SERIES as s (s.key)}
			<button
				class="flex items-center gap-2 rounded-md border border-(--grid) px-3 py-1 hover:bg-(--grid)"
				class:opacity-40={hidden[s.key]}
				aria-pressed={!hidden[s.key]}
				onclick={() => (hidden[s.key] = !hidden[s.key])}
			>
				<span class="inline-block h-0.5 w-3 rounded" style:background={s.color}></span>
				<span>{s.label}</span>
				<span class="font-semibold tabular-nums">{fmtNum(value(last, s.key))}</span>
			</button>
		{/each}
	</div>

	<div
		class="relative transition-opacity"
		class:opacity-50={refreshing || !!navigating.to}
		bind:clientWidth={width}
	>
		<svg
			{width}
			{height}
			role="img"
			aria-label="Line chart of cumulative ORCID accounts by month and role, reaching {fmtNum(
				last.total
			)} in all, with the Open South FLC formation marked at August 2023"
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

			{#each events as e (e.month)}
				<line
					x1={x(e.i)}
					x2={x(e.i)}
					y1={margin.top}
					y2={margin.top + plotH}
					stroke="var(--text-secondary)"
					stroke-dasharray="4 4"
				/>
				<text x={x(e.i) - 6} y={margin.top + 12} text-anchor="end" class="fill-(--text-secondary) text-xs">
					<tspan class="font-medium">{e.label}</tspan>
					<tspan x={x(e.i) - 6} dy="1.3em">{e.detail}</tspan>
				</text>
			{/each}

			{#each visible as s (s.key)}
				<path
					d={path(s.key)}
					fill="none"
					stroke={s.color}
					stroke-width="2"
					stroke-linejoin="round"
					stroke-linecap="round"
				/>
			{/each}

			{#if hover !== null}
				<line
					x1={x(hover)}
					x2={x(hover)}
					y1={margin.top}
					y2={margin.top + plotH}
					stroke="var(--text-secondary)"
				/>
				{#each visible as s (s.key)}
					<circle
						cx={x(hover)}
						cy={y(value(points[hover], s.key))}
						r="4"
						fill={s.color}
						stroke="var(--surface-1)"
						stroke-width="2"
					/>
				{/each}
			{/if}
		</svg>

		{#if hover !== null && visible.length}
			{@const p = points[hover]}
			<div
				class="pointer-events-none absolute top-2 rounded-md border border-(--grid) bg-(--surface-1) px-3 py-2 text-sm shadow-md"
				style:left="{x(hover) + 220 > width ? x(hover) - 220 : x(hover) + 12}px"
			>
				<div class="mb-1 text-xs text-(--text-secondary)">By end of {fmtMonth(p.month)}</div>
				{#each events.filter((e) => e.i === hover) as e (e.month)}
					<div class="mb-1 text-xs font-medium">{e.label} ({e.detail})</div>
				{/each}
				{#each visible as s (s.key)}
					<div class="flex items-center gap-2">
						<span class="inline-block h-0.5 w-3 rounded" style:background={s.color}></span>
						<span class="w-10 text-right font-semibold tabular-nums">{fmtNum(value(p, s.key))}</span>
						<span class="text-(--text-secondary)">{s.label}</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<div class="mt-4 flex flex-wrap items-center justify-between gap-4 text-sm text-(--text-secondary)">
		<span>
			Live total updated {fmtDate(data.fetchedAt)} · roles from the snapshot of {fmtDate(
				data.series.snapshotAt
			)}
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
		<div class="overflow-x-auto">
			<table class="mt-2 tabular-nums">
				<thead>
					<tr>
						<th class="pr-6 text-left">Month</th>
						{#each SERIES as s (s.key)}<th class="pr-4 text-right">{s.label}</th>{/each}
					</tr>
				</thead>
				<tbody>
					{#each points.toReversed() as p (p.month)}
						<tr>
							<td class="pr-6">{fmtMonth(p.month)}</td>
							{#each SERIES as s (s.key)}<td class="pr-4 text-right">{fmtNum(value(p, s.key))}</td>{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</details>

	<footer class="mt-6 space-y-2 text-xs text-(--text-secondary)">
		<p>
			Data comes from the
			<a
				class="underline"
				href="https://info.orcid.org/documentation/api-tutorials/api-tutorial-searching-the-orcid-registry/"
				>ORCID public API</a
			>
			with the query <code>{QUERY}</code>, counted by account creation date. The headline total is
			live; the breakdown by role comes from a daily snapshot of every matching record.
		</p>
		<p>
			Roles are a best guess. ORCID doesn't record whether someone is faculty or a student, so each
			account is classified from the role title on its current University of South Alabama
			employment ("Assistant Professor", "Graduate Student", "Resident Physician", ...), or as a
			student if it lists only a current USA education. Librarians and physicians count as faculty.
			Accounts with no role title are guessed from weaker signals (number of works, a completed
			doctorate, and how recently the ORCID iD was issued): {fmtNum(data.series.inferred.faculty)}
			faculty and {fmtNum(data.series.inferred.student)} students were classified this way, and
			{fmtNum(last.byGroup.unknown)} accounts ({pct(last.byGroup.unknown)}) couldn't be classified
			at all.
		</p>
		<p>
			This software was generated with the assistance of AI tools and may contain mistakes.
			<a class="font-medium hover:underline" href="https://github.com/OpenSouthAL/orcid-south-dashboard">[GitHub repo]</a>
		</p>
	</footer>
</main>
