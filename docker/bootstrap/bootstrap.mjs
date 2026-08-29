import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const {
  MCPUP_PROJECT_ID,
  MCPUP_REVISION,
  MCPUP_API_URL,
  MCPUP_API_TOKEN,
  MCPUP_APP_DIR,
  MCPUP_FETCH_RETRIES,
  MCPUP_FETCH_TIMEOUT,
} = process.env;

const log = (message) => console.log(`[mcpup-bootstrap] ${message}`);

function fail(message) {
  console.error(`[mcpup-bootstrap] error: ${message}`);
  process.exit(1);
}

function usage() {
  console.error(`
mcpup-bootstrap — downloads an mcpup project revision and writes it to disk.

Required:
  MCPUP_PROJECT_ID     Project UUID.
  MCPUP_REVISION       Revision number (integer).

Optional:
  MCPUP_API_URL        Base URL of the mcpup app. Default: http://host.docker.internal:3000
  MCPUP_API_TOKEN      Bearer token for the archive request.
  MCPUP_APP_DIR        Where the project is unpacked. Default: /home/node/app
  MCPUP_FETCH_RETRIES  Download retry attempts. Default: 5
  MCPUP_FETCH_TIMEOUT  Download timeout in seconds. Default: 300

Example:
  docker run --rm -p 8080:8080 \\
    -e MCPUP_PROJECT_ID=<uuid> -e MCPUP_REVISION=1 \\
    osamanj93/mcpup-bootstrap
`);
  process.exit(1);
}

if (!MCPUP_PROJECT_ID) {
  console.error("[mcpup-bootstrap] error: MCPUP_PROJECT_ID is required.");
  usage();
}
if (!MCPUP_REVISION) {
  console.error("[mcpup-bootstrap] error: MCPUP_REVISION is required.");
  usage();
}
if (!/^\d+$/.test(MCPUP_REVISION)) {
  fail(
    `MCPUP_REVISION must be an integer, got '${MCPUP_REVISION}'. Use the version's "revision" field, not its "id".`,
  );
}

const retries = Number(MCPUP_FETCH_RETRIES);
const timeoutMs = Number(MCPUP_FETCH_TIMEOUT) * 1000;
const archiveUrl = `${MCPUP_API_URL.replace(/\/$/, "")}/api/projects/${MCPUP_PROJECT_ID}/versions/${MCPUP_REVISION}/archive`;

async function download() {
  const headers = MCPUP_API_TOKEN
    ? { Authorization: `Bearer ${MCPUP_API_TOKEN}` }
    : undefined;

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (attempt > 0) {
      log(`Retrying download (${attempt}/${retries})`);
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
    try {
      const response = await fetch(archiveUrl, {
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        // 4xx will not fix itself on retry.
        if (response.status < 500) {
          fail(
            `Server returned ${response.status} for ${archiveUrl}. ${body.slice(0, 300)}`,
          );
        }
        throw new Error(`HTTP ${response.status}. ${body.slice(0, 300)}`);
      }
      return await response.text();
    } catch (error) {
      lastError = error;
    }
  }
  fail(`Could not download the project archive. ${lastError?.message ?? ""}`);
}

function toTree(archive) {
  if (archive.length === 0) fail("Downloaded archive is empty.");

  let tree;
  try {
    tree = JSON.parse(archive);
  } catch (error) {
    fail(
      `Archive is not a JSON file tree: ${error.message} First bytes: ${archive.slice(0, 200)}`,
    );
  }

  if (!tree || typeof tree !== "object") {
    fail("Archive did not contain a file tree object.");
  }
  return tree;
}

let fileCount = 0;
let skippedSymlinks = 0;

async function writeTree(node, targetDir) {
  await mkdir(targetDir, { recursive: true });

  for (const [name, entry] of Object.entries(node)) {
    const destination = path.join(targetDir, name);
    // Guards against tree entries escaping the app dir via "../".
    if (!destination.startsWith(targetDir + path.sep)) {
      fail(`Refusing to write outside the app directory: ${name}`);
    }

    if (entry?.directory !== undefined) {
      await writeTree(entry.directory, destination);
      continue;
    }

    const file = entry?.file;
    if (file === undefined) {
      log(`Skipping unrecognized entry: ${name}`);
      continue;
    }

    if (file.symlink !== undefined) {
      log(`Skipping symlink (not supported): ${name} -> ${file.symlink}`);
      skippedSymlinks += 1;
      continue;
    }

    await writeFile(destination, file.contents ?? "");
    fileCount += 1;
  }
}

log(`Fetching revision ${MCPUP_REVISION} from ${archiveUrl}`);
const archive = await download();

log(`Unpacking into ${MCPUP_APP_DIR}`);
await writeTree(toTree(archive), MCPUP_APP_DIR);
log(
  `Wrote ${fileCount} file(s)${skippedSymlinks > 0 ? `, skipped ${skippedSymlinks} symlink(s)` : ""}`,
);

if (!existsSync(path.join(MCPUP_APP_DIR, "package.json"))) {
  fail("Archive did not contain a package.json at its root.");
}
