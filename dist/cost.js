import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Anthropic API pricing per 1M tokens (USD) — Claude 4 family, 2025
// Applies to Team Premium and API usage
const MODEL_PRICING = {
  'opus':   { input: 15.00, output: 75.00, cacheRead: 1.50,  cacheWrite: 18.75 },
  'sonnet': { input: 3.00,  output: 15.00, cacheRead: 0.30,  cacheWrite: 3.75  },
  'haiku':  { input: 0.80,  output: 4.00,  cacheRead: 0.08,  cacheWrite: 1.00  },
};

function detectModelTier(stdin) {
  const modelId = (stdin.model?.id ?? '').toLowerCase();
  const displayName = (stdin.model?.display_name ?? '').toLowerCase();
  const combined = `${modelId} ${displayName}`;

  if (combined.includes('opus')) return 'opus';
  if (combined.includes('haiku')) return 'haiku';
  return 'sonnet'; // default
}

function getCostCachePath(transcriptPath) {
  if (!transcriptPath) return null;
  // Transcript path layout: ~/.claude/projects/<project-slug>/<session-uuid>.jsonl
  // The session UUID is the file basename without extension — that's the per-session key.
  // (Previously this used the parent directory name, which is the project slug, so every
  // session in the same project shared one cache file and accumulated each other's cost.)
  const sessionId = path.basename(transcriptPath, '.jsonl') || 'unknown';
  const cacheDir = path.join(os.homedir(), '.claude', 'plugins', 'claude-hud');
  return path.join(cacheDir, `.cost-session-${sessionId}.json`);
}

function readCostCache(cachePath) {
  try {
    if (!cachePath || !fs.existsSync(cachePath)) return null;
    return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  } catch {
    return null;
  }
}

function writeCostCache(cachePath, data) {
  try {
    if (!cachePath) return;
    fs.writeFileSync(cachePath, JSON.stringify(data), 'utf8');
  } catch {
    // ignore
  }
}

export function estimateSessionCost(stdin) {
  const usage = stdin.context_window?.current_usage;
  if (!usage) return null;

  const tier = detectModelTier(stdin);
  const pricing = MODEL_PRICING[tier];

  const inputTokens = usage.input_tokens ?? 0;
  const outputTokens = usage.output_tokens ?? 0;
  const cacheReadTokens = usage.cache_read_input_tokens ?? 0;
  const cacheWriteTokens = usage.cache_creation_input_tokens ?? 0;

  const currentCost =
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output +
    (cacheReadTokens / 1_000_000) * pricing.cacheRead +
    (cacheWriteTokens / 1_000_000) * pricing.cacheWrite;

  // Track cumulative high-water mark per session to survive autocompact
  const cachePath = getCostCachePath(stdin.transcript_path);
  const cached = readCostCache(cachePath);

  let totalCost = currentCost;
  if (cached) {
    // If current tokens dropped (autocompact happened), accumulate previous peak
    if (currentCost < (cached.lastSeenCost ?? 0)) {
      totalCost = (cached.accumulated ?? 0) + currentCost;
    } else {
      totalCost = (cached.accumulated ?? 0) + currentCost;
      // Only accumulate when we detect a reset (drop)
      totalCost = Math.max(cached.totalCost ?? 0, totalCost);
    }
  }

  const newCache = {
    lastSeenCost: currentCost,
    accumulated: cached
      ? (currentCost < (cached.lastSeenCost ?? 0)
          ? (cached.accumulated ?? 0) + (cached.lastSeenCost ?? 0)
          : (cached.accumulated ?? 0))
      : 0,
    totalCost,
    tier,
    updatedAt: Date.now(),
  };
  writeCostCache(cachePath, newCache);

  return {
    currentCost,
    totalCost,
    tier,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
  };
}
//# sourceMappingURL=cost.js.map
