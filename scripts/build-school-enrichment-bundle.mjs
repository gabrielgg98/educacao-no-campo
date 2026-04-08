import fs from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const CACHE_DIR = path.join(projectRoot, "school-enrichment-cache");
const OUTPUT_DIR = path.join(projectRoot, "school-enrichment-bundle");
const MANIFEST_FILE = path.join(OUTPUT_DIR, "manifest.json");

function parseArgs(argv) {
  const options = {
    shardSize: 200
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--shard-size") {
      const nextValue = Number(argv[index + 1] ?? options.shardSize);

      if (Number.isFinite(nextValue) && nextValue > 0) {
        options.shardSize = Math.floor(nextValue);
      }

      index += 1;
    }
  }

  return options;
}

async function ensureOutputDir() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
}

async function clearPreviousBundle() {
  try {
    const entries = await fs.readdir(OUTPUT_DIR, { withFileTypes: true });

    await Promise.all(entries.map(async entry => {
      if (!entry.isFile()) {
        return;
      }

      if (entry.name === "manifest.json" || /^shard-\d{4}\.json$/i.test(entry.name)) {
        await fs.unlink(path.join(OUTPUT_DIR, entry.name));
      }
    }));
  } catch {
    // Sem bundle anterior.
  }
}

async function readCacheEntries() {
  const entries = await fs.readdir(CACHE_DIR, { withFileTypes: true });
  const files = entries
    .filter(entry => entry.isFile() && /\.json$/i.test(entry.name))
    .map(entry => entry.name)
    .sort((a, b) => a.localeCompare(b, "pt-BR"));

  return Promise.all(files.map(async fileName => {
    const inepCode = fileName.replace(/\.json$/i, "");
    const filePath = path.join(CACHE_DIR, fileName);
    const content = await fs.readFile(filePath, "utf8");

    return {
      inepCode,
      data: JSON.parse(content)
    };
  }));
}

function chunkArray(items, chunkSize) {
  const chunks = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
}

async function writeBundle(entries, shardSize) {
  const chunks = chunkArray(entries, shardSize);
  const manifest = {
    generatedAt: new Date().toISOString(),
    totalEntries: entries.length,
    shardSize,
    totalShards: chunks.length,
    entries: {}
  };

  for (let index = 0; index < chunks.length; index += 1) {
    const shardId = index + 1;
    const shardName = `shard-${String(shardId).padStart(4, "0")}.json`;
    const shardPath = path.join(OUTPUT_DIR, shardName);
    const shardPayload = {};

    for (const entry of chunks[index]) {
      shardPayload[entry.inepCode] = entry.data;
      manifest.entries[entry.inepCode] = shardId;
    }

    await fs.writeFile(shardPath, `${JSON.stringify(shardPayload, null, 2)}\n`, "utf8");
    console.log(`[${shardId}/${chunks.length}] ${shardName} gerado com ${chunks[index].length} escola(s).`);
  }

  await fs.writeFile(MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`Manifesto gerado em ${MANIFEST_FILE}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await ensureOutputDir();
  await clearPreviousBundle();

  const entries = await readCacheEntries();

  if (!entries.length) {
    throw new Error("Nenhum JSON encontrado em school-enrichment-cache.");
  }

  await writeBundle(entries, options.shardSize);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
