<script lang="ts">
	import { onMount } from 'svelte';

	interface Suite {
		id: string;
		name: string;
		description: string;
		version: string;
		total_cases: number;
		passed_cases?: number;
		overall_score?: number;
		generated_at?: string;
	}

	interface PageData {
		suiteIds: string[];
	}

	let { data }: { data: PageData } = $props();

	let suites = $state<Suite[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	onMount(async () => {
		try {
			const loadedSuites: Suite[] = [];

			for (const suiteId of data.suiteIds) {
				try {
					const response = await fetch(`/suites/${suiteId}.json`);
					if (response.ok) {
						const data = await response.json();
						loadedSuites.push({
							id: suiteId,
							name: data.suite_id,
							description: data.suite_description,
							version: data.suite_version,
							total_cases: data.total_cases,
							passed_cases: data.passed_cases,
							overall_score: data.overall_score,
							generated_at: data.generated_at,
						});
					}
				} catch (e) {
					console.error(`Failed to load suite ${suiteId}:`, e);
				}
			}

			// Sort by overall_score descending (best first)
			loadedSuites.sort((a, b) => (b.overall_score || 0) - (a.overall_score || 0));

			suites = loadedSuites;
			loading = false;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load suites';
			loading = false;
		}
	});
</script>

<svelte:head>
	<title>Test Suites - NOPE Safety API</title>
	<meta name="description" content="Transparency dashboard showing NOPE's classification expectations and test suite results." />
</svelte:head>

<div class="py-12">
	<div class="max-w-5xl mx-auto px-4">
		<!-- Header -->
		<div class="mb-12">
			<h1 class="text-4xl font-bold text-zinc-900 mb-4">Test Suite Transparency</h1>
			<p class="text-lg text-zinc-600 max-w-3xl">
				We believe in transparency about our classification expectations. Below are our test suites
				showing inputs, expected classifications, and actual results. These help you understand what
				risk signals we consider "good" classifications.
			</p>
		</div>

		<!-- Loading State -->
		{#if loading}
			<div class="bg-white rounded-lg border border-zinc-200 p-8 text-center">
				<div class="animate-pulse text-zinc-600">Loading test suites...</div>
			</div>
		{/if}

		<!-- Error State -->
		{#if error}
			<div class="bg-red-50 rounded-lg border border-red-200 p-6">
				<p class="text-red-800">Error loading suites: {error}</p>
			</div>
		{/if}

		<!-- Suites List -->
		{#if !loading && !error}
			{#if suites.length === 0}
				<div class="bg-white rounded-lg border border-zinc-200 p-8 text-center">
					<p class="text-zinc-600">No test suites available yet. Run <code class="bg-zinc-100 px-2 py-1 rounded text-sm">pnpm generate:suite-results</code> to generate results.</p>
				</div>
			{:else}
				<div class="space-y-4">
					{#each suites as suite}
						<a
							href="/{suite.id}"
							class="block bg-white rounded-lg border border-zinc-200 p-6 hover:border-zinc-400 hover:shadow-md transition-all"
						>
							<div class="flex items-start justify-between">
								<div class="flex-1">
									<div class="flex items-center gap-3 mb-2">
										<h2 class="text-xl font-semibold text-zinc-900">{suite.name}</h2>
										<span class="text-xs px-2 py-1 rounded bg-zinc-100 text-zinc-600">v{suite.version}</span>
									</div>
									<p class="text-zinc-600 mb-3">{suite.description}</p>
									<div class="flex items-center gap-4 text-sm text-zinc-500">
										<span>{suite.total_cases} test cases</span>
										{#if suite.passed_cases !== undefined}
											<span class="text-green-600">{suite.passed_cases} passed</span>
										{/if}
										{#if suite.generated_at}
											<span>Generated {new Date(suite.generated_at).toLocaleDateString()}</span>
										{/if}
									</div>
								</div>
								{#if suite.overall_score !== undefined}
									<div class="ml-4 text-right">
										<div class="text-3xl font-bold {suite.overall_score >= 90 ? 'text-green-600' : suite.overall_score >= 75 ? 'text-yellow-600' : 'text-red-600'}">
											{suite.overall_score.toFixed(1)}%
										</div>
										<div class="text-xs text-zinc-500">score</div>
									</div>
								{/if}
							</div>
						</a>
					{/each}
				</div>
			{/if}
		{/if}

		<!-- Methodology Note -->
		<div class="mt-12 bg-blue-50 rounded-lg border border-blue-200 p-6">
			<h3 class="text-sm font-semibold text-blue-900 mb-2">About These Tests</h3>
			<p class="text-sm text-blue-800">
				Each test case includes an input conversation, expected risk classification, and actual model output.
				We use these suites internally to validate changes and track classification quality over time.
				"Passing" means the actual classification matches our expected outcome within acceptable bounds.
			</p>
		</div>
	</div>
</div>
