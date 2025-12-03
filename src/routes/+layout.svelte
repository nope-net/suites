<script>
	import '../app.css';

	let { children } = $props();
</script>

<div class="min-h-screen bg-zinc-50">
	<!-- Header -->
	<header class="bg-white border-b border-zinc-200 sticky top-0 z-10">
		<div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
			<div class="flex items-center justify-between h-14">
				<a href="/" class="flex items-center gap-2">
					<div class="w-8 h-8 bg-zinc-900 rounded flex items-center justify-center text-white font-bold text-sm">
						N
					</div>
					<span class="font-semibold text-zinc-900">NOPE</span>
					<span class="text-zinc-400">/</span>
					<span class="text-zinc-600">Test Suites</span>
				</a>

				<nav class="flex items-center gap-4 text-sm">
					<a href="https://nope.net/docs" class="text-zinc-600 hover:text-zinc-900">Docs</a>
					<a href="https://nope.net" class="text-zinc-600 hover:text-zinc-900">Home</a>
				</nav>
			</div>
		</div>
	</header>

	{@render children()}

	<!-- Footer -->
	<footer class="bg-white border-t border-zinc-200 py-6 px-4 mt-12">
		<div class="max-w-6xl mx-auto text-center text-sm text-zinc-500">
			<p>Test suite results for <a href="https://nope.net" class="text-zinc-700 hover:underline">NOPE Safety API</a></p>
			<p class="mt-1">These results demonstrate our classification expectations and help you understand what we consider accurate risk assessment.</p>
		</div>
	</footer>
</div>
