export const CODING_LABELS = [
  "backend",
  "frontend",
  "database",
  "security",
  "testing",
  "operations",
  "architecture",
] as const;

export type CodingLabel = (typeof CODING_LABELS)[number];

const KEYWORDS: Record<CodingLabel, string[]> = {
  backend: ["api", "server", "route", "endpoint", "handler", "node", "http", "middleware"],
  frontend: ["ui", "react", "component", "css", "tailwind", "browser", "client", "jsx", "tsx"],
  database: ["database", "sql", "query", "postgres", "drizzle", "table", "migration", "schema"],
  security: ["secret", "token", "auth", "security", "sanitize", "permission", "key", "env"],
  testing: ["test", "validate", "assert", "coverage", "typecheck", "build", "lint"],
  operations: ["deploy", "docker", "ci", "runtime", "logs", "monitor", "health", "production"],
  architecture: ["design", "pattern", "scalable", "maintainable", "modular", "clean", "layer"],
};

export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[`*_>#\-\[\](){}|]/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^\p{L}\p{N}\s.]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function splitToSamples(content: string): string[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => normalizeText(line))
    .filter((line) => line.length >= 24)
    .filter((line) => /\b(you|must|always|never|do not|should|system|tool|code|api|database|security)\b/i.test(line));

  return lines.slice(0, 200);
}

export function inferLabel(text: string): CodingLabel {
  const lowered = normalizeText(text);

  let bestLabel: CodingLabel = "architecture";
  let bestScore = -1;

  for (const label of CODING_LABELS) {
    const score = KEYWORDS[label].reduce((acc, keyword) => acc + (lowered.includes(keyword) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestLabel = label;
    }
  }

  return bestLabel;
}

export function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 2)
    .slice(0, 300);
}

export function buildVocabulary(samples: string[], maxSize = 900): Record<string, number> {
  const freq: Record<string, number> = {};

  for (const sample of samples) {
    for (const token of tokenize(sample)) {
      freq[token] = (freq[token] ?? 0) + 1;
    }
  }

  const vocab = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxSize)
    .map(([token]) => token);

  return Object.fromEntries(vocab.map((token, idx) => [token, idx]));
}

export function vectorize(text: string, vocabulary: Record<string, number>): number[] {
  const vec = new Array(Object.keys(vocabulary).length).fill(0);

  for (const token of tokenize(text)) {
    const idx = vocabulary[token];
    if (idx !== undefined) {
      vec[idx] += 1;
    }
  }

  const magnitude = Math.sqrt(vec.reduce((sum, value) => sum + value * value, 0));
  if (magnitude > 0) {
    for (let i = 0; i < vec.length; i += 1) {
      vec[i] = vec[i] / magnitude;
    }
  }

  return vec;
}
