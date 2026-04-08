import fs from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const TMP_DIR = path.join(projectRoot, "tmp");
const STATUS_DIR = path.join(projectRoot, "school-enrichment-status");
const LOG_FILES = [
  "dados-complementares-sync.err.log",
  "school-enrichment-sync.err.log"
];
const SOURCE_LABEL = "Cultura Educa \u2022 Censo Escolar da Educa\u00e7\u00e3o B\u00e1sica 2020";
const CULTURA_EDUCA_BASE_URL = "https://culturaeduca.cc/equipamento/escola_detalhe";

function buildSchoolUrl(inepCode) {
  return `${CULTURA_EDUCA_BASE_URL}/${inepCode}/`;
}

async function main() {
  await fs.mkdir(STATUS_DIR, { recursive: true });
  let writtenCount = 0;

  for (const logFileName of LOG_FILES) {
    const logFilePath = path.join(TMP_DIR, logFileName);
    let content = "";

    try {
      content = await fs.readFile(logFilePath, "utf8");
    } catch {
      continue;
    }

    const matches = [...content.matchAll(/\]\s+(\d{8})\s+falhou:\s+HTTP\s+404/gi)];

    for (const match of matches) {
      const inepCode = String(match[1] ?? "").trim();

      if (!inepCode) {
        continue;
      }

      const payload = {
        inepCode,
        status: "not_found",
        message: "HTTP 404",
        checkedAt: new Date().toISOString(),
        source: {
          label: SOURCE_LABEL,
          url: buildSchoolUrl(inepCode)
        }
      };

      await fs.writeFile(
        path.join(STATUS_DIR, `${inepCode}.json`),
        `${JSON.stringify(payload, null, 2)}\n`,
        "utf8"
      );
      writtenCount += 1;
    }
  }

  console.log(`Status retroativos gravados: ${writtenCount}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
