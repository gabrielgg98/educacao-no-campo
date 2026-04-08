import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const SCHOOLS_FILE = path.join(projectRoot, "escolas-rurais.json");
const CACHE_DIR = path.join(projectRoot, "school-enrichment-cache");
const STATUS_DIR = path.join(projectRoot, "school-enrichment-status");
const OUTPUT_FILE = path.join(projectRoot, "dados-complementares.json");
const SOURCE_LABEL = "Cultura Educa \u2022 Censo Escolar da Educa\u00e7\u00e3o B\u00e1sica 2020";
const SOURCE_URL_PATTERN = "https://culturaeduca.cc/equipamento/escola_detalhe/{INEP}/";

const FIELD_CANDIDATES = {
  inepCode: ["Código INEP", "Codigo INEP", "INEP", "Código da Escola", "Codigo da Escola"],
  schoolName: ["Escola", "Nome da Escola", "Nome"],
  uf: ["UF", "Estado"],
  city: ["Município", "Municipio", "Cidade"]
};

function normalizeKey(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function repairMojibake(value) {
  const textValue = String(value ?? "");

  if (!/[ÃÂ]/.test(textValue)) {
    return textValue;
  }

  try {
    return Buffer.from(textValue, "latin1").toString("utf8");
  } catch {
    return textValue;
  }
}

function cleanOutputText(value) {
  return repairMojibake(String(value ?? "")).trim();
}

function findFieldKey(row, candidates) {
  const normalizedMap = new Map(
    Object.keys(row ?? {}).map(key => [normalizeKey(key), key])
  );

  for (const candidate of candidates) {
    const resolvedKey = normalizedMap.get(normalizeKey(candidate));

    if (resolvedKey) {
      return resolvedKey;
    }
  }

  return "";
}

function pickRelevantSections(entry) {
  const allowedSections = new Set(["digital", "facilities", "staff", "community", "students"]);
  const sections = Array.isArray(entry?.sections) ? entry.sections : [];

  return sections
    .filter(section => allowedSections.has(String(section?.id ?? "")))
    .map(section => ({
      id: section.id,
      title: cleanOutputText(section.title),
      rows: Array.isArray(section.rows)
        ? section.rows.map(row => ({
            label: cleanOutputText(row?.label),
            value: cleanOutputText(row?.value)
          }))
        : []
    }))
    .filter(section => section.rows.length > 0);
}

function buildRelevantComplementaryData(entry, inepCode) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  return {
    source: {
      label: SOURCE_LABEL,
      url: entry?.source?.url || SOURCE_URL_PATTERN.replace("{INEP}", String(inepCode ?? ""))
    },
    syncedAt: entry?.syncedAt ?? null,
    enrollments: Array.isArray(entry?.enrollments)
      ? entry.enrollments.map(item => ({
          label: cleanOutputText(item?.label),
          value: cleanOutputText(item?.value)
        }))
      : [],
    overview: {
      studentsTotal: entry?.overview?.studentsTotal ?? null
    },
    digital: {
      internet: entry?.digital?.internet ?? null,
      broadband: entry?.digital?.broadband ?? null,
      desktopCount: entry?.digital?.desktopCount ?? null,
      laptopCount: entry?.digital?.laptopCount ?? null,
      tabletCount: entry?.digital?.tabletCount ?? null,
      projectorCount: entry?.digital?.projectorCount ?? null,
      digitalBoardCount: entry?.digital?.digitalBoardCount ?? null
    },
    facilities: {
      library: entry?.facilities?.library ?? null,
      libraryOrReadingRoom: entry?.facilities?.libraryOrReadingRoom ?? null,
      computerLab: entry?.facilities?.computerLab ?? null,
      scienceLab: entry?.facilities?.scienceLab ?? null,
      coveredCourt: entry?.facilities?.coveredCourt ?? null,
      teachersRoom: entry?.facilities?.teachersRoom ?? null,
      specialAttendanceRoom: entry?.facilities?.specialAttendanceRoom ?? null,
      kitchen: entry?.facilities?.kitchen ?? null
    },
    staff: {
      pedagogicalSupport: entry?.staff?.pedagogicalSupport ?? null,
      secretary: entry?.staff?.secretary ?? null,
      generalServices: entry?.staff?.generalServices ?? null,
      kitchen: entry?.staff?.kitchen ?? null,
      labSupport: entry?.staff?.labSupport ?? null
    },
    sections: pickRelevantSections(entry)
  };
}

async function getCachedInepCodes() {
  try {
    const entries = await fsPromises.readdir(CACHE_DIR, { withFileTypes: true });

    return new Set(
      entries
        .filter(entry => entry.isFile() && /\.json$/i.test(entry.name))
        .map(entry => entry.name.replace(/\.json$/i, ""))
    );
  } catch {
    return new Set();
  }
}

async function getStatusEntriesByInep() {
  try {
    const entries = await fsPromises.readdir(STATUS_DIR, { withFileTypes: true });
    const statusMap = new Map();

    for (const entry of entries) {
      if (!entry.isFile() || !/\.json$/i.test(entry.name)) {
        continue;
      }

      const inepCode = entry.name.replace(/\.json$/i, "");
      const content = await fsPromises.readFile(path.join(STATUS_DIR, entry.name), "utf8");
      statusMap.set(inepCode, JSON.parse(content));
    }

    return statusMap;
  } catch {
    return new Map();
  }
}

async function loadCacheEntry(inepCode) {
  const filePath = path.join(CACHE_DIR, `${inepCode}.json`);
  const content = await fsPromises.readFile(filePath, "utf8");
  return JSON.parse(content);
}

function createWriteStream(filePath) {
  return fs.createWriteStream(filePath, { encoding: "utf8" });
}

function writeChunk(stream, chunk) {
  return new Promise((resolve, reject) => {
    stream.write(chunk, error => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function closeStream(stream) {
  return new Promise((resolve, reject) => {
    stream.end(error => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function main() {
  const rawSchools = await fsPromises.readFile(SCHOOLS_FILE, "utf8");
  const schools = JSON.parse(rawSchools);

  if (!Array.isArray(schools) || schools.length === 0) {
    throw new Error("A base escolas-rurais.json está vazia ou inválida.");
  }

  const sampleRow = schools[0];
  const resolvedKeys = {
    inepCode: findFieldKey(sampleRow, FIELD_CANDIDATES.inepCode),
    schoolName: findFieldKey(sampleRow, FIELD_CANDIDATES.schoolName),
    uf: findFieldKey(sampleRow, FIELD_CANDIDATES.uf),
    city: findFieldKey(sampleRow, FIELD_CANDIDATES.city)
  };

  if (!resolvedKeys.inepCode || !resolvedKeys.schoolName) {
    throw new Error("Não foi possível localizar os campos principais da base escolas-rurais.json.");
  }

  const cachedInepCodes = await getCachedInepCodes();
  const statusEntriesByInep = await getStatusEntriesByInep();
  const totalSchools = schools.length;
  const coverage = schools.reduce((accumulator, row) => {
    const inepCode = String(row?.[resolvedKeys.inepCode] ?? "").trim();
    const statusEntry = statusEntriesByInep.get(inepCode);

    if (cachedInepCodes.has(inepCode)) {
      accumulator.synced += 1;
    } else if (statusEntry?.status === "not_found") {
      accumulator.notFound += 1;
    } else if (statusEntry?.status === "error") {
      accumulator.error += 1;
    } else {
      accumulator.pending += 1;
    }

    return accumulator;
  }, {
    synced: 0,
    notFound: 0,
    error: 0,
    pending: 0
  });

  const stream = createWriteStream(OUTPUT_FILE);

  await writeChunk(
    stream,
    `{\n  "meta": ${JSON.stringify({
      generatedAt: new Date().toISOString(),
      source: {
        label: SOURCE_LABEL,
        urlPattern: SOURCE_URL_PATTERN
      },
      coverage: {
        totalSchoolsInBase: totalSchools,
        syncedSchools: coverage.synced,
        notFoundSchools: coverage.notFound,
        errorSchools: coverage.error,
        pendingSchools: coverage.pending
      },
      origin: {
        schoolsFile: "escolas-rurais.json",
        complementaryCacheDir: "school-enrichment-cache",
        note: "Consolidado local gerado a partir das fichas sincronizadas do Cultura Educa para as escolas da base principal."
      }
    }, null, 2).replace(/\n/g, "\n  ")},\n  "schools": [\n`
  );

  let firstEntry = true;

  for (const row of schools) {
    const inepCode = String(row?.[resolvedKeys.inepCode] ?? "").trim();

    if (!inepCode) {
      continue;
    }

    let complementaryData = null;
    let syncStatus = "pendente";
    const statusEntry = statusEntriesByInep.get(inepCode) ?? null;

    if (cachedInepCodes.has(inepCode)) {
      try {
        const cacheEntry = await loadCacheEntry(inepCode);
        complementaryData = buildRelevantComplementaryData(cacheEntry, inepCode);
        syncStatus = complementaryData ? "sincronizado" : "pendente";
      } catch {
        syncStatus = "erro";
      }
    } else if (statusEntry?.status === "not_found") {
      syncStatus = "não_encontrado";
    } else if (statusEntry?.status === "error") {
      syncStatus = "erro";
    }

    const payload = {
      inepCode,
      schoolName: cleanOutputText(row?.[resolvedKeys.schoolName]),
      uf: cleanOutputText(row?.[resolvedKeys.uf]),
      city: cleanOutputText(row?.[resolvedKeys.city]),
      syncStatus,
      status: statusEntry
        ? {
            status: cleanOutputText(statusEntry?.status),
            message: cleanOutputText(statusEntry?.message),
            checkedAt: statusEntry?.checkedAt ?? null
          }
        : null,
      complementaryData
    };

    const serializedEntry = JSON.stringify(payload, null, 2).replace(/\n/g, "\n    ");
    const prefix = firstEntry ? "" : ",\n";

    await writeChunk(stream, `${prefix}    ${serializedEntry}`);
    firstEntry = false;
  }

  await writeChunk(stream, "\n  ]\n}\n");
  await closeStream(stream);

  console.log(`Arquivo gerado em ${OUTPUT_FILE}`);
  console.log(`Cobertura atual: ${coverage.synced}/${totalSchools} escola(s) com dados complementares sincronizados.`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
