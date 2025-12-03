<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	interface TestCaseResult {
		case_id: string;
		description: string;
		input: Array<{ role: string; content: string }>;
		expected: {
			overall_severity: string;
			acceptable_severities?: string[];
			overall_imminence: string;
			acceptable_imminence?: string[];
			min_confidence: number;
			rationale?: string;
			domains?: Array<{
				domain: string;
				min_severity?: string;
				min_imminence?: string;
			}>;
			legal_flags?: {
				duty_to_warn?: boolean;
				child_safeguarding_urgent?: boolean;
				vulnerable_adult_safeguarding?: boolean;
				mash_rating?: string;
				dash_rating?: string;
			};
		};
		actual: {
			overall_severity: string;
			overall_imminence: string;
			confidence: number;
			domains: Array<{
				domain: string;
				severity: string;
				imminence: string;
				confidence: number;
				risk_features?: string[];
				protective_factors?: string[];
			}>;
			legal_flags?: any;
			primary_concerns?: string[];
		};
		passed: boolean;
		checks: {
			overall_severity: boolean;
			overall_imminence: boolean;
			confidence: boolean;
			domains?: Record<string, boolean>;
			legal_flags?: Record<string, boolean>;
		};
		score: number;
		debug?: {
			filter_stage?: {
				model: string;
				temperature: number;
				latency_ms?: number;
				tokens_per_second?: number;
				prompt_preview: string;
			};
			classification_stage?: {
				model: string;
				temperature: number;
				latency_ms?: number;
				tokens_per_second?: number;
				prompt_preview: string;
			};
		};
	}

	interface SuiteResults {
		suite_id: string;
		suite_version: string;
		suite_description: string;
		generated_at: string;
		model_used: string;
		total_cases: number;
		passed_cases: number;
		failed_cases: number;
		overall_score: number;
		cases: TestCaseResult[];
	}

	let suiteId = $derived($page.params.id);
	let suite = $state<SuiteResults | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let expandedCases = $state<Set<string>>(new Set());

	function toggleExpand(caseId: string) {
		const newExpanded = new Set(expandedCases);
		if (newExpanded.has(caseId)) {
			newExpanded.delete(caseId);
		} else {
			newExpanded.add(caseId);
		}
		expandedCases = newExpanded;
	}

	function getSeverityColor(severity: string): string {
		const colors: Record<string, string> = {
			none: 'text-zinc-600 bg-zinc-100',
			mild: 'text-blue-700 bg-blue-100',
			moderate: 'text-yellow-700 bg-yellow-100',
			high: 'text-orange-700 bg-orange-100',
			critical: 'text-red-700 bg-red-100',
		};
		return colors[severity] || 'text-zinc-600 bg-zinc-100';
	}

	function getImminenceColor(imminence: string): string {
		const colors: Record<string, string> = {
			not_applicable: 'text-zinc-600 bg-zinc-100',
			chronic: 'text-blue-700 bg-blue-100',
			subacute: 'text-yellow-700 bg-yellow-100',
			urgent: 'text-orange-700 bg-orange-100',
			emergency: 'text-red-700 bg-red-100',
		};
		return colors[imminence] || 'text-zinc-600 bg-zinc-100';
	}

	onMount(async () => {
		try {
			const response = await fetch(`/suites/${suiteId}.json`);
			if (!response.ok) {
				throw new Error(`Suite not found: ${suiteId}`);
			}
			suite = await response.json();
			loading = false;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load suite';
			loading = false;
		}
	});
</script>

<svelte:head>
	<title>{suite?.suite_id || 'Test Suite'} - NOPE Safety API</title>
	<meta name="description" content="Detailed test results for {suite?.suite_id || 'test suite'}" />
</svelte:head>

<div class="py-12">
	<div class="max-w-6xl mx-auto px-4">
		<!-- Back Link -->
		<a href="/" class="text-sm text-zinc-600 hover:text-zinc-900 mb-6 inline-block">
			← Back to Suites
		</a>

		<!-- Loading State -->
		{#if loading}
			<div class="bg-white rounded-lg border border-zinc-200 p-8 text-center">
				<div class="animate-pulse text-zinc-600">Loading test suite...</div>
			</div>
		{/if}

		<!-- Error State -->
		{#if error}
			<div class="bg-red-50 rounded-lg border border-red-200 p-6">
				<p class="text-red-800">Error: {error}</p>
			</div>
		{/if}

		<!-- Suite Content -->
		{#if suite}
			<!-- Header -->
			<div class="bg-white rounded-lg border border-zinc-200 p-6 mb-6">
				<div class="flex items-start justify-between mb-4">
					<div>
						<h1 class="text-3xl font-bold text-zinc-900 mb-2">{suite.suite_id}</h1>
						<p class="text-sm text-zinc-500">Version {suite.suite_version}</p>
					</div>
					<div class="text-right">
						<div class="text-3xl font-bold {suite.overall_score >= 90 ? 'text-green-600' : suite.overall_score >= 75 ? 'text-yellow-600' : 'text-red-600'}">
							{suite.overall_score.toFixed(1)}%
						</div>
						<div class="text-sm text-zinc-500">overall score</div>
					</div>
				</div>

				<p class="text-zinc-700 mb-4">{suite.suite_description}</p>

				<div class="flex flex-wrap gap-4 text-sm text-zinc-600 border-t border-zinc-200 pt-4">
					<div>
						<span class="font-medium">Total Cases:</span> {suite.total_cases}
					</div>
					<div>
						<span class="font-medium">Passed:</span> <span class="text-green-600">{suite.passed_cases}</span>
					</div>
					<div>
						<span class="font-medium">Failed:</span> <span class="text-red-600">{suite.failed_cases}</span>
					</div>
					<div>
						<span class="font-medium">Model:</span> {suite.model_used}
					</div>
					<div>
						<span class="font-medium">Generated:</span> {new Date(suite.generated_at).toLocaleString()}
					</div>
				</div>
			</div>

			<!-- Test Cases -->
			<div class="space-y-4">
				{#each suite.cases as testCase, index}
					{@const isExpanded = expandedCases.has(testCase.case_id)}
					<div class="bg-white rounded-lg border {testCase.passed ? 'border-green-200' : 'border-red-200'} overflow-hidden">
						<!-- Case Header -->
						<button
							onclick={() => toggleExpand(testCase.case_id)}
							class="w-full text-left p-4 hover:bg-zinc-50 transition-colors"
						>
							<div class="flex items-start justify-between">
								<div class="flex-1">
									<div class="flex items-center gap-3 mb-2">
										<span class="text-sm font-mono text-zinc-500">#{index + 1}</span>
										<span class="font-medium text-zinc-900">{testCase.case_id}</span>
										<span class={`text-xs px-2 py-1 rounded-full font-medium ${testCase.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
											{testCase.passed ? '✓ PASS' : '✗ FAIL'}
										</span>
										<span class="text-xs px-2 py-1 rounded bg-zinc-100 text-zinc-700">
											{testCase.score.toFixed(0)}%
										</span>
									</div>
									<p class="text-sm text-zinc-600">{testCase.description}</p>
								</div>
								<div class="ml-4 text-zinc-400">
									{isExpanded ? '▼' : '▶'}
								</div>
							</div>
						</button>

						<!-- Expanded Details -->
						{#if isExpanded}
							<div class="border-t border-zinc-200 p-4 bg-zinc-50 space-y-4">
								<!-- Input -->
								<div>
									<h4 class="text-sm font-semibold text-zinc-900 mb-2">Input</h4>
									<div class="bg-white rounded border border-zinc-200 p-3 space-y-2">
										{#each testCase.input as message}
											<div class="text-sm">
												<span class="font-medium text-zinc-700">{message.role}:</span>
												<span class="text-zinc-900 ml-2">{message.content}</span>
											</div>
										{/each}
									</div>
								</div>

								<!-- Classification Results -->
								<div class="grid md:grid-cols-2 gap-4">
									<!-- Expected -->
									<div>
										<h4 class="text-sm font-semibold text-zinc-900 mb-2">Expected</h4>
										<div class="bg-white rounded border border-zinc-200 p-3 space-y-2 text-sm">
											<div class="flex items-center gap-2">
												<span class="text-zinc-600">Severity:</span>
												{#if testCase.expected.acceptable_severities && testCase.expected.acceptable_severities.length > 1}
													<div class="flex gap-1">
														{#each testCase.expected.acceptable_severities as sev}
															<span class={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(sev)}`}>
																{sev}
															</span>
														{/each}
													</div>
												{:else}
													<span class={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(testCase.expected.overall_severity)}`}>
														{testCase.expected.overall_severity}
													</span>
												{/if}
											</div>
											<div class="flex items-center gap-2">
												<span class="text-zinc-600">Imminence:</span>
												{#if testCase.expected.acceptable_imminence && testCase.expected.acceptable_imminence.length > 1}
													<div class="flex gap-1">
														{#each testCase.expected.acceptable_imminence as imm}
															<span class={`px-2 py-1 rounded text-xs font-medium ${getImminenceColor(imm)}`}>
																{imm}
															</span>
														{/each}
													</div>
												{:else}
													<span class={`px-2 py-1 rounded text-xs font-medium ${getImminenceColor(testCase.expected.overall_imminence)}`}>
														{testCase.expected.overall_imminence}
													</span>
												{/if}
											</div>
											<div class="flex items-center gap-2">
												<span class="text-zinc-600">Min Confidence:</span>
												<span class="font-medium">{(testCase.expected.min_confidence * 100).toFixed(0)}%</span>
											</div>
											{#if testCase.expected.rationale}
												<div class="pt-2 border-t border-zinc-200">
													<div class="text-zinc-600 text-xs mb-1">Rationale:</div>
													<div class="text-xs text-zinc-700 italic">{testCase.expected.rationale}</div>
												</div>
											{/if}
											{#if testCase.expected.domains && testCase.expected.domains.length > 0}
												<div class="pt-2 border-t border-zinc-200">
													<div class="text-zinc-600 mb-1">Expected Domains:</div>
													{#each testCase.expected.domains as domain}
														<div class="text-xs text-zinc-700">
															• {domain.domain}
															{#if domain.min_severity}
																(≥{domain.min_severity})
															{/if}
														</div>
													{/each}
												</div>
											{/if}
										</div>
									</div>

									<!-- Actual -->
									<div>
										<h4 class="text-sm font-semibold text-zinc-900 mb-2">Actual</h4>
										<div class="bg-white rounded border border-zinc-200 p-3 space-y-2 text-sm">
											<div class="flex items-center gap-2">
												<span class="text-zinc-600">Severity:</span>
												<span class={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(testCase.actual.overall_severity)}`}>
													{testCase.actual.overall_severity}
												</span>
												{#if !testCase.checks.overall_severity}
													<span class="text-red-600 text-xs">✗</span>
												{/if}
											</div>
											<div class="flex items-center gap-2">
												<span class="text-zinc-600">Imminence:</span>
												<span class={`px-2 py-1 rounded text-xs font-medium ${getImminenceColor(testCase.actual.overall_imminence)}`}>
													{testCase.actual.overall_imminence}
												</span>
												{#if !testCase.checks.overall_imminence}
													<span class="text-red-600 text-xs">✗</span>
												{/if}
											</div>
											<div class="flex items-center gap-2">
												<span class="text-zinc-600">Confidence:</span>
												<span class="font-medium">{(testCase.actual.confidence * 100).toFixed(0)}%</span>
												{#if !testCase.checks.confidence}
													<span class="text-red-600 text-xs">✗</span>
												{/if}
											</div>
											{#if testCase.actual.domains && testCase.actual.domains.length > 0}
												<div class="pt-2 border-t border-zinc-200">
													<div class="text-zinc-600 mb-1">Detected Domains:</div>
													{#each testCase.actual.domains as domain}
														<div class="text-xs text-zinc-700 mb-1">
															• {domain.domain}: {domain.severity}/{domain.imminence} ({(domain.confidence * 100).toFixed(0)}%)
														</div>
														{#if domain.risk_features && domain.risk_features.length > 0}
															<div class="text-xs text-zinc-500 ml-4">
																Risk: {domain.risk_features.join(', ')}
															</div>
														{/if}
													{/each}
												</div>
											{/if}
										</div>
									</div>
								</div>

								<!-- Primary Concerns -->
								{#if testCase.actual.primary_concerns && testCase.actual.primary_concerns.length > 0}
									<div>
										<h4 class="text-sm font-semibold text-zinc-900 mb-2">Primary Concerns</h4>
										<div class="bg-white rounded border border-zinc-200 p-3">
											<div class="flex flex-wrap gap-2">
												{#each testCase.actual.primary_concerns as concern}
													<span class="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700">
														{concern}
													</span>
												{/each}
											</div>
										</div>
									</div>
								{/if}

								<!-- Legal Flags -->
								{#if testCase.actual.legal_flags}
									<div>
										<h4 class="text-sm font-semibold text-zinc-900 mb-2">Legal/Clinical Flags</h4>
										<div class="bg-white rounded border border-zinc-200 p-3 text-sm space-y-1">
											{#if testCase.actual.legal_flags.duty_to_warn?.present}
												<div class="text-red-700">⚠️ Duty to Warn (Tarasoff)</div>
											{/if}
											{#if testCase.actual.legal_flags.mash_rating}
												<div class="text-orange-700">
													MASH Rating: {testCase.actual.legal_flags.mash_rating.level}
												</div>
											{/if}
											{#if testCase.actual.legal_flags.dash_rating}
												<div class="text-orange-700">
													DASH Rating: {testCase.actual.legal_flags.dash_rating.level}
												</div>
											{/if}
										</div>
									</div>
								{/if}

								<!-- Debug/Trace Information -->
								{#if testCase.debug}
									<div>
										<h4 class="text-sm font-semibold text-zinc-900 mb-2">Debug & Trace</h4>
										<div class="bg-white rounded border border-zinc-200 p-3 space-y-3">
											{#if testCase.debug.filter_stage}
												<div class="text-sm">
													<div class="font-medium text-zinc-700 mb-1">Filter Stage</div>
													<div class="grid grid-cols-2 gap-2 text-xs text-zinc-600 bg-zinc-50 p-2 rounded">
														<div><span class="font-medium">Model:</span> <code class="text-blue-600">{testCase.debug.filter_stage.model}</code></div>
														<div><span class="font-medium">Temp:</span> {testCase.debug.filter_stage.temperature}</div>
														{#if testCase.debug.filter_stage.latency_ms}
															<div><span class="font-medium">Latency:</span> {testCase.debug.filter_stage.latency_ms.toFixed(0)}ms</div>
														{/if}
														{#if testCase.debug.filter_stage.tokens_per_second}
															<div><span class="font-medium">Speed:</span> {testCase.debug.filter_stage.tokens_per_second.toFixed(0)} tok/s</div>
														{/if}
													</div>
													<details class="mt-2">
														<summary class="text-xs text-zinc-500 cursor-pointer hover:text-zinc-700">View prompt preview</summary>
														<pre class="text-xs bg-zinc-100 p-2 rounded mt-1 overflow-x-auto text-zinc-700">{testCase.debug.filter_stage.prompt_preview}</pre>
													</details>
												</div>
											{/if}
											{#if testCase.debug.classification_stage}
												<div class="text-sm">
													<div class="font-medium text-zinc-700 mb-1">Classification Stage</div>
													<div class="grid grid-cols-2 gap-2 text-xs text-zinc-600 bg-zinc-50 p-2 rounded">
														<div><span class="font-medium">Model:</span> <code class="text-blue-600">{testCase.debug.classification_stage.model}</code></div>
														<div><span class="font-medium">Temp:</span> {testCase.debug.classification_stage.temperature}</div>
														{#if testCase.debug.classification_stage.latency_ms}
															<div><span class="font-medium">Latency:</span> {testCase.debug.classification_stage.latency_ms.toFixed(0)}ms</div>
														{/if}
														{#if testCase.debug.classification_stage.tokens_per_second}
															<div><span class="font-medium">Speed:</span> {testCase.debug.classification_stage.tokens_per_second.toFixed(0)} tok/s</div>
														{/if}
													</div>
													<details class="mt-2">
														<summary class="text-xs text-zinc-500 cursor-pointer hover:text-zinc-700">View prompt preview</summary>
														<pre class="text-xs bg-zinc-100 p-2 rounded mt-1 overflow-x-auto text-zinc-700">{testCase.debug.classification_stage.prompt_preview}</pre>
													</details>
												</div>
											{/if}
										</div>
									</div>
								{/if}
							</div>
						{/if}
					</div>
				{/each}
			</div>

			<!-- Legend -->
			<div class="mt-8 bg-blue-50 rounded-lg border border-blue-200 p-6">
				<h3 class="text-sm font-semibold text-blue-900 mb-3">Legend</h3>
				<div class="grid md:grid-cols-2 gap-4 text-sm text-blue-800">
					<div>
						<div class="font-medium mb-2">Severity Levels:</div>
						<div class="space-y-1">
							<div><span class={`px-2 py-1 rounded text-xs ${getSeverityColor('none')}`}>none</span> - No risk detected</div>
							<div><span class={`px-2 py-1 rounded text-xs ${getSeverityColor('mild')}`}>mild</span> - Low-level distress</div>
							<div><span class={`px-2 py-1 rounded text-xs ${getSeverityColor('moderate')}`}>moderate</span> - Moderate concern</div>
							<div><span class={`px-2 py-1 rounded text-xs ${getSeverityColor('high')}`}>high</span> - Serious risk</div>
							<div><span class={`px-2 py-1 rounded text-xs ${getSeverityColor('critical')}`}>critical</span> - Imminent danger</div>
						</div>
					</div>
					<div>
						<div class="font-medium mb-2">Imminence Levels:</div>
						<div class="space-y-1">
							<div><span class={`px-2 py-1 rounded text-xs ${getImminenceColor('not_applicable')}`}>not_applicable</span> - No timeframe</div>
							<div><span class={`px-2 py-1 rounded text-xs ${getImminenceColor('chronic')}`}>chronic</span> - Ongoing/long-term</div>
							<div><span class={`px-2 py-1 rounded text-xs ${getImminenceColor('subacute')}`}>subacute</span> - Days to weeks</div>
							<div><span class={`px-2 py-1 rounded text-xs ${getImminenceColor('urgent')}`}>urgent</span> - Hours to days</div>
							<div><span class={`px-2 py-1 rounded text-xs ${getImminenceColor('emergency')}`}>emergency</span> - Immediate action</div>
						</div>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>
