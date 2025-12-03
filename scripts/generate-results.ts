#!/usr/bin/env tsx
/**
 * Static Suite Results Generator for Suites Repo
 *
 * Generates static JSON files with test suite results for public transparency.
 * Calls the external NOPE API to evaluate test cases, then saves results.
 *
 * Usage:
 *   pnpm generate:results fixtures/core-transparency.json
 *   pnpm generate:results --all
 *
 * Environment:
 *   API_URL - NOPE API endpoint (default: http://localhost:8788)
 *   API_KEY - NOPE API key for authentication
 */

import fs from 'fs';
import path from 'path';

// Load .env file
try {
  const envPath = path.resolve(process.cwd(), '.env');
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
} catch (e) {
  // .env file not found - that's ok
}

type Severity = 'none' | 'mild' | 'moderate' | 'high' | 'critical';
type Imminence = 'not_applicable' | 'chronic' | 'subacute' | 'urgent' | 'emergency';
type RiskDomain = 'self' | 'others' | 'dependent_at_risk' | 'victimisation';

// Test Case format
interface TestCase {
  case_id: string;
  description: string;
  conversation: Array<{ role: string; content: string }>;
  expected_overall_severity: Severity;
  acceptable_severities?: Severity[];
  expected_overall_imminence: Imminence;
  acceptable_imminence?: Imminence[];
  expected_min_confidence: number;
  rationale?: string;
  expected_domains?: Array<{
    domain: RiskDomain;
    min_severity?: Severity;
    min_imminence?: Imminence;
    min_confidence?: number;
  }>;
  expected_legal_flags?: {
    duty_to_warn?: boolean;
    child_safeguarding_urgent?: boolean;
    vulnerable_adult_safeguarding?: boolean;
    mash_rating?: 'low' | 'medium' | 'high' | 'urgent';
    dash_rating?: 'low' | 'medium' | 'high';
    animal_cruelty?: boolean;
  };
}

interface TestSuite {
  test_set_id: string;
  version: string;
  description: string;
  cases: TestCase[];
}

// Result formats for static generation
interface TestCaseResult {
  case_id: string;
  description: string;
  input: Array<{ role: string; content: string }>;
  expected: {
    overall_severity: Severity;
    acceptable_severities?: Severity[];
    overall_imminence: Imminence;
    acceptable_imminence?: Imminence[];
    min_confidence: number;
    rationale?: string;
    domains?: Array<{
      domain: RiskDomain;
      min_severity?: Severity;
      min_imminence?: Imminence;
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
    overall_severity: Severity;
    overall_imminence: Imminence;
    confidence: number;
    domains: Array<{
      domain: RiskDomain;
      severity: Severity;
      imminence: Imminence;
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
  error?: string;
}

interface StaticSuiteResults {
  suite_id: string;
  suite_version: string;
  suite_description: string;
  generated_at: string;
  api_endpoint: string;
  total_cases: number;
  passed_cases: number;
  failed_cases: number;
  overall_score: number;
  cases: TestCaseResult[];
}

/**
 * Simple concurrency limiter
 */
async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  maxConcurrency: number
): Promise<T[]> {
  const results: T[] = [];
  let index = 0;

  async function runNext(): Promise<void> {
    if (index >= tasks.length) return;

    const currentIndex = index++;
    const task = tasks[currentIndex];

    try {
      const result = await task();
      results[currentIndex] = result;
    } catch (error) {
      results[currentIndex] = undefined as any;
    }

    await runNext();
  }

  const workers = Array(Math.min(maxConcurrency, tasks.length))
    .fill(null)
    .map(() => runNext());

  await Promise.all(workers);
  return results;
}

/**
 * Call external NOPE API to evaluate a conversation
 */
async function callNopeAPI(
  messages: Array<{ role: string; content: string }>,
  apiUrl: string,
  apiKey?: string
): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const response = await fetch(`${apiUrl}/v1/evaluate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      messages,
      config: {},
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error (${response.status}): ${error}`);
  }

  return response.json();
}

async function generateStaticResults(suitePath: string, apiUrl: string, apiKey?: string) {
  console.log('📊 Generating Static Suite Results\n');

  // Load test suite
  const suiteFile = fs.readFileSync(suitePath, 'utf-8');
  const suite: TestSuite = JSON.parse(suiteFile);

  console.log(`📋 Suite: ${suite.test_set_id} (${suite.version})`);
  console.log(`📝 ${suite.description}`);
  console.log(`🔢 Running ${suite.cases.length} test cases...`);
  console.log(`🌐 API: ${apiUrl}\n`);

  let passed = 0;
  let failed = 0;
  const results: TestCaseResult[] = [];

  // Create test tasks
  const tasks = suite.cases.map((testCase, index) => async () => {
    console.log(`[${index + 1}/${suite.cases.length}] ${testCase.case_id}...`);

    try {
      // Call external API
      const result = await callNopeAPI(testCase.conversation, apiUrl, apiKey);

      // Check expectations (with support for acceptable ranges)
      const acceptableSeverities = testCase.acceptable_severities || [testCase.expected_overall_severity];
      const acceptableImminence = testCase.acceptable_imminence || [testCase.expected_overall_imminence];

      const checks: Record<string, boolean> = {
        overall_severity: acceptableSeverities.includes(result.global.overall_severity),
        overall_imminence: acceptableImminence.includes(result.global.overall_imminence),
        confidence: result.confidence >= testCase.expected_min_confidence,
      };

      // Check domain expectations if specified
      const domainChecks: Record<string, boolean> = {};
      if (testCase.expected_domains) {
        testCase.expected_domains.forEach(expectedDomain => {
          const actualDomain = result.domains.find((d: any) => d.domain === expectedDomain.domain);
          if (actualDomain) {
            if (expectedDomain.min_severity) {
              const severityLevels: Severity[] = ['none', 'mild', 'moderate', 'high', 'critical'];
              const actualLevel = severityLevels.indexOf(actualDomain.severity);
              const expectedLevel = severityLevels.indexOf(expectedDomain.min_severity);
              domainChecks[`${expectedDomain.domain}_severity`] = actualLevel >= expectedLevel;
            }
            if (expectedDomain.min_confidence) {
              domainChecks[`${expectedDomain.domain}_confidence`] = actualDomain.confidence >= expectedDomain.min_confidence;
            }
          }
        });
      }

      // Check legal flags if specified
      const legalFlagChecks: Record<string, boolean> = {};
      if (testCase.expected_legal_flags) {
        if (testCase.expected_legal_flags.duty_to_warn !== undefined) {
          legalFlagChecks['duty_to_warn'] = result.legal_flags?.duty_to_warn?.present === testCase.expected_legal_flags.duty_to_warn;
        }
        if (testCase.expected_legal_flags.mash_rating !== undefined) {
          legalFlagChecks['mash_rating'] = result.legal_flags?.mash_rating?.level === testCase.expected_legal_flags.mash_rating;
        }
        if (testCase.expected_legal_flags.dash_rating !== undefined) {
          legalFlagChecks['dash_rating'] = result.legal_flags?.dash_rating?.level === testCase.expected_legal_flags.dash_rating;
        }
      }

      const allChecks = { ...checks, ...domainChecks, ...legalFlagChecks };
      const allPassed = Object.values(allChecks).every(v => v);
      const totalChecks = Object.keys(allChecks).length;
      const passedChecks = Object.values(allChecks).filter(v => v).length;
      const score = (passedChecks / totalChecks) * 100;

      if (allPassed) {
        console.log(`  ✅ PASSED (${score.toFixed(0)}%)`);
      } else {
        console.log(`  ❌ FAILED (${score.toFixed(0)}%)`);
      }

      // Store result
      return {
        case_id: testCase.case_id,
        description: testCase.description,
        input: testCase.conversation,
        expected: {
          overall_severity: testCase.expected_overall_severity,
          acceptable_severities: testCase.acceptable_severities,
          overall_imminence: testCase.expected_overall_imminence,
          acceptable_imminence: testCase.acceptable_imminence,
          min_confidence: testCase.expected_min_confidence,
          rationale: testCase.rationale,
          domains: testCase.expected_domains,
          legal_flags: testCase.expected_legal_flags,
        },
        actual: {
          overall_severity: result.global.overall_severity,
          overall_imminence: result.global.overall_imminence,
          confidence: result.confidence,
          domains: result.domains.map((d: any) => ({
            domain: d.domain,
            severity: d.severity,
            imminence: d.imminence,
            confidence: d.confidence,
            risk_features: d.risk_features,
            protective_factors: d.protective_factors,
          })),
          legal_flags: result.legal_flags,
          primary_concerns: result.global.primary_concerns,
        },
        passed: allPassed,
        checks: {
          overall_severity: checks.overall_severity,
          overall_imminence: checks.overall_imminence,
          confidence: checks.confidence,
          domains: Object.keys(domainChecks).length > 0 ? domainChecks : undefined,
          legal_flags: Object.keys(legalFlagChecks).length > 0 ? legalFlagChecks : undefined,
        },
        score,
      } as TestCaseResult;

    } catch (error) {
      console.log(`  💥 ERROR: ${error instanceof Error ? error.message : String(error)}`);

      // Store error result
      return {
        case_id: testCase.case_id,
        description: testCase.description,
        input: testCase.conversation,
        expected: {
          overall_severity: testCase.expected_overall_severity,
          overall_imminence: testCase.expected_overall_imminence,
          min_confidence: testCase.expected_min_confidence,
        },
        actual: {
          overall_severity: 'none',
          overall_imminence: 'not_applicable',
          confidence: 0,
          domains: [],
        },
        passed: false,
        checks: {
          overall_severity: false,
          overall_imminence: false,
          confidence: false,
        },
        score: 0,
        error: error instanceof Error ? error.message : String(error),
      } as TestCaseResult;
    }
  });

  // Run tests with concurrency limit of 10 (to be nice to the API)
  const taskResults = await runWithConcurrency(tasks, 10);

  // Count passed/failed and collect results
  taskResults.forEach(result => {
    if (result.passed) passed++;
    else failed++;
    results.push(result);
  });

  // Calculate overall score
  const overallScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;

  // Create static results object
  const staticResults: StaticSuiteResults = {
    suite_id: suite.test_set_id,
    suite_version: suite.version,
    suite_description: suite.description,
    generated_at: new Date().toISOString(),
    api_endpoint: apiUrl,
    total_cases: suite.cases.length,
    passed_cases: passed,
    failed_cases: failed,
    overall_score: overallScore,
    cases: results,
  };

  // Ensure static/suites directory exists
  const outputDir = path.resolve(process.cwd(), 'static', 'suites');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write to static file
  const outputPath = path.join(outputDir, `${suite.test_set_id}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(staticResults, null, 2));

  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 GENERATION COMPLETE');
  console.log('='.repeat(80));
  console.log(`✅ Passed: ${passed}/${suite.cases.length}`);
  console.log(`❌ Failed: ${failed}/${suite.cases.length}`);
  console.log(`📈 Overall Score: ${overallScore.toFixed(1)}%`);
  console.log(`💾 Written to: ${outputPath}`);
  console.log('='.repeat(80) + '\n');

  return staticResults;
}

// Main execution
async function main() {
  const args = process.argv.slice(2);

  // Get API configuration from environment
  const apiUrl = process.env.API_URL || 'http://localhost:8788';
  const apiKey = process.env.API_KEY;

  // Check if we should run all suites
  if (args.includes('--all')) {
    console.log('🔄 Generating results for all fixtures...\n');

    const fixturesDir = path.resolve(process.cwd(), 'fixtures');
    const fixtures = fs.readdirSync(fixturesDir)
      .filter(f => f.endsWith('.json'))
      .map(f => path.join(fixturesDir, f));

    for (const fixture of fixtures) {
      await generateStaticResults(fixture, apiUrl, apiKey);
      console.log('');
    }

    console.log(`✅ Generated results for ${fixtures.length} suites\n`);
    return;
  }

  // Run single suite
  const suitePath = args[0] || 'fixtures/core-transparency.json';

  if (!fs.existsSync(suitePath)) {
    console.error(`❌ Test suite not found: ${suitePath}`);
    console.error(`\nUsage:`);
    console.error(`  pnpm generate:results fixtures/core-transparency.json`);
    console.error(`  pnpm generate:results --all`);
    process.exit(1);
  }

  await generateStaticResults(suitePath, apiUrl, apiKey);
}

main().catch(error => {
  console.error('❌ Generation failed:', error);
  process.exit(1);
});
