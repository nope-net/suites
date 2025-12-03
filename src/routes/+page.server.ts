import { readdirSync } from 'fs';
import { join } from 'path';

export function load() {
	try {
		// Read all JSON files from static/suites/
		const suitesDir = join(process.cwd(), 'static', 'suites');
		const files = readdirSync(suitesDir);

		// Extract suite IDs from filenames (remove .json extension)
		const suiteIds = files
			.filter(file => file.endsWith('.json'))
			.map(file => file.replace('.json', ''));

		return {
			suiteIds
		};
	} catch (error) {
		console.error('Error loading suite list:', error);
		return {
			suiteIds: []
		};
	}
}
