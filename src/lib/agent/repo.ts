type RepoFile = {
  path: string;
  size: number;
  type: "blob" | "tree";
};

export type IngestedDocument = {
  sourcePath: string;
  content: string;
};

const OWNER = "x1xhlol";
const REPO = "system-prompts-and-models-of-ai-tools";
const MAX_FILE_SIZE = 120_000;

const ACCEPTED_EXTENSIONS = [".md", ".txt", ".json", ".yaml", ".yml", ".prompt", ".xml"];

function isAcceptedPath(filePath: string) {
  const lowered = filePath.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => lowered.endsWith(ext));
}

async function fetchTree(branch: string): Promise<RepoFile[]> {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/git/trees/${branch}?recursive=1`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "coding-agent-builder",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch tree for branch ${branch}: ${response.status}`);
  }

  const data = (await response.json()) as { tree?: RepoFile[] };
  return data.tree ?? [];
}

async function fetchRawFile(branch: string, path: string): Promise<string> {
  const url = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${branch}/${path}`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch file ${path}: ${response.status}`);
  }

  return response.text();
}

export async function fetchSystemPromptDocuments(limit = 120): Promise<IngestedDocument[]> {
  const branchesToTry = ["main", "master"];

  let files: RepoFile[] = [];
  let resolvedBranch = "main";

  for (const branch of branchesToTry) {
    try {
      files = await fetchTree(branch);
      resolvedBranch = branch;
      break;
    } catch {
      continue;
    }
  }

  if (!files.length) {
    throw new Error("Unable to read repository tree from GitHub");
  }

  const candidateFiles = files
    .filter((file) => file.type === "blob")
    .filter((file) => file.size <= MAX_FILE_SIZE)
    .filter((file) => isAcceptedPath(file.path))
    .slice(0, limit);

  const documents: IngestedDocument[] = [];

  for (const file of candidateFiles) {
    try {
      const content = await fetchRawFile(resolvedBranch, file.path);
      if (content.trim().length < 40) {
        continue;
      }

      documents.push({
        sourcePath: file.path,
        content,
      });
    } catch {
      continue;
    }
  }

  return documents;
}
