import fs from "node:fs/promises";
import path from "node:path";
const projectRoot = process.cwd();

const SCHOOLS_FILE = path.join(projectRoot, "escolas-rurais.json");
const LEGACY_CACHE_FILE = path.join(projectRoot, "school-enrichment-cache.json");
const CACHE_DIR = path.join(projectRoot, "school-enrichment-cache");
const STATUS_DIR = path.join(projectRoot, "school-enrichment-status");
const CULTURA_EDUCA_BASE_URL = "https://culturaeduca.cc/equipamento/escola_detalhe";
const SOURCE_LABEL = "Cultura Educa \u2022 Censo Escolar da Educa\u00e7\u00e3o B\u00e1sica 2020";

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&ordm;/gi, "º")
    .replace(/&ordf;/gi, "ª")
    .replace(/&ccedil;/gi, "ç")
    .replace(/&atilde;/gi, "ã")
    .replace(/&otilde;/gi, "õ")
    .replace(/&aacute;/gi, "á")
    .replace(/&eacute;/gi, "é")
    .replace(/&iacute;/gi, "í")
    .replace(/&oacute;/gi, "ó")
    .replace(/&uacute;/gi, "ú");
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

function cleanText(value) {
  return repairMojibake(decodeHtmlEntities(
    String(value ?? "")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  ));
}

function normalizeLookupText(value) {
  return cleanText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseIconBooleanCell(cellHtml) {
  const rawHtml = String(cellHtml ?? "");

  if (!/fi-check/i.test(rawHtml)) {
    return "";
  }

  return /\bdiscreet\b/i.test(rawHtml) ? "Não" : "Sim";
}

function parseCellValue(cellHtml) {
  const textValue = cleanText(cellHtml);

  if (textValue) {
    return textValue;
  }

  return parseIconBooleanCell(cellHtml);
}

function extractTableByHeading(html, heading) {
  const tables = [...html.matchAll(/<table[\s\S]*?<\/table>/gi)].map(match => match[0]);
  const normalizedHeading = normalizeLookupText(heading);

  return tables.find(tableHtml => {
    const tableHeading = tableHtml.match(/<h5>\s*([\s\S]*?)\s*<\/h5>/i)?.[1] ?? "";
    return normalizeLookupText(tableHeading) === normalizedHeading;
  }) ?? "";
}

function parseTableRows(tableHtml) {
  return [...tableHtml.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map(match => {
    const cells = [...match[0].matchAll(/<(th|td)[^>]*>([\s\S]*?)<\/\1>/gi)]
      .map(cellMatch => parseCellValue(cellMatch[2]))
      .filter(Boolean);

    return cells;
  }).filter(cells => cells.length > 0);
}

function getRowValue(rows, label) {
  const normalizedLabel = normalizeLookupText(label);
  const row = rows.find(cells => normalizeLookupText(cells[0]) === normalizedLabel);

  if (!row || row.length < 2) {
    return "";
  }

  return row[row.length - 1];
}

function hasRow(rows, label) {
  const normalizedLabel = normalizeLookupText(label);
  return rows.some(cells => cells.some(cell => normalizeLookupText(cell) === normalizedLabel));
}

function buildSectionRows(rows, {
  sectionTitle = "",
  excludeLabels = [],
  defaultSingleValue = "Sim",
  allowedValues = null
} = {}) {
  const ignoredLabels = new Set(
    [sectionTitle, ...excludeLabels]
      .map(label => cleanText(label))
      .filter(Boolean)
  );
  const seen = new Set();

  return rows.flatMap(cells => {
    const label = cleanText(cells[0]);

    if (!label || ignoredLabels.has(label) || /^Fonte:/i.test(label)) {
      return [];
    }

    const value = cleanText(cells.length > 1 ? cells[cells.length - 1] : defaultSingleValue);

    if (!value || value === label) {
      return [];
    }

    if (Array.isArray(allowedValues) && allowedValues.length > 0 && !allowedValues.includes(value)) {
      return [];
    }

    const dedupeKey = `${label}::${value}`;

    if (seen.has(dedupeKey)) {
      return [];
    }

    seen.add(dedupeKey);
    return [{ label, value }];
  });
}

function buildEnrollmentRows(rows) {
  const seen = new Set();

  return rows.flatMap(cells => {
    const label = cleanText(cells[0]);
    const value = cleanText(cells[cells.length - 1]);

    if (
      !label ||
      !value ||
      value === label ||
      /^Fonte:/i.test(label) ||
      !normalizeLookupText(value).includes("matricula")
    ) {
      return [];
    }

    const dedupeKey = `${label}::${value}`;

    if (seen.has(dedupeKey)) {
      return [];
    }

    seen.add(dedupeKey);
    return [{ label, value }];
  });
}

function toCount(value) {
  const match = String(value ?? "").match(/\d[\d.]*/);
  return match ? Number(match[0].replace(/\./g, "")) : null;
}

function toBoolean(value) {
  const normalizedValue = cleanText(value).toLowerCase();

  if (!normalizedValue) {
    return null;
  }

  if (
    normalizedValue === "sim" ||
    normalizedValue.startsWith("sim ") ||
    normalizedValue.includes(" wireless") ||
    normalizedValue.includes(" a cabo")
  ) {
    return true;
  }

  if (
    normalizedValue === "não" ||
    normalizedValue.startsWith("não ") ||
    normalizedValue.includes("nenhum") ||
    normalizedValue.includes("nenhuma")
  ) {
    return false;
  }

  return null;
}

function pickBoolean(rows, label, { presenceMeansTrue = false } = {}) {
  const rowValue = getRowValue(rows, label);

  if (rowValue) {
    return toBoolean(rowValue);
  }

  if (presenceMeansTrue && hasRow(rows, label)) {
    return true;
  }

  return null;
}

function buildSchoolUrl(inepCode) {
  return `${CULTURA_EDUCA_BASE_URL}/${inepCode}/`;
}

function extractSchoolEnrichment(html, inepCode) {
  const enrollmentTitle = "Matriculas";
  const communityTitle = "Relacao escola-comunidade";
  const facilitiesTitle = "Infraestrutura (Dependencias)";
  const digitalTitle = "Internet, Computadores e Equipamentos Multimidia";
  const staffTitle = "Profissionais que atuam na escola";
  const studentTitle = "Alunos";
  const transportLabel = "Utiliza transporte escolar publico";
  const totalStudentsLabel = "Total de Alunos";
  const enrollmentRows = parseTableRows(extractTableByHeading(html, enrollmentTitle));
  const enrollments = buildEnrollmentRows(enrollmentRows);
  const communityRows = parseTableRows(extractTableByHeading(html, communityTitle));
  const facilitiesRows = parseTableRows(extractTableByHeading(html, facilitiesTitle));
  const digitalRows = parseTableRows(extractTableByHeading(html, digitalTitle));
  const staffRows = parseTableRows(extractTableByHeading(html, staffTitle));
  const studentRows = parseTableRows(extractTableByHeading(html, studentTitle));
  const sections = [
    {
      id: "enrollments",
      title: "Matrículas por etapa",
      rows: enrollments
    },
    {
      id: "digital",
      title: "Internet, computadores e equipamentos multimídia",
      rows: buildSectionRows(digitalRows, {
        sectionTitle: digitalTitle
      })
    },
    {
      id: "facilities",
      title: "Infraestrutura e dependências",
      rows: buildSectionRows(facilitiesRows, {
        sectionTitle: facilitiesTitle,
        defaultSingleValue: "",
        allowedValues: ["Sim", "Não"]
      })
    },
    {
      id: "staff",
      title: "Profissionais que atuam na escola",
      rows: buildSectionRows(staffRows, {
        sectionTitle: staffTitle
      })
    },
    {
      id: "community",
      title: "Relação escola-comunidade",
      rows: buildSectionRows(communityRows, {
        sectionTitle: communityTitle,
        defaultSingleValue: "",
        allowedValues: ["Sim", "Não"]
      })
    },
    {
      id: "students",
      title: "Alunos",
      rows: buildSectionRows(studentRows, {
        sectionTitle: studentTitle,
        excludeLabels: [transportLabel, totalStudentsLabel]
      })
    }
  ].filter(section => section.rows.length > 0);

  return {
    source: {
      label: SOURCE_LABEL,
      url: buildSchoolUrl(inepCode)
    },
    syncedAt: new Date().toISOString(),
    enrollments,
    overview: {
      studentsTotal: toCount(getRowValue(studentRows, totalStudentsLabel)),
      weekendOpen: pickBoolean(communityRows, "Abre no fim de semana"),
      pppUpdated: pickBoolean(
        communityRows,
        "Projeto político pedagógico atualizado nos últimos 12 meses (até a data de referência)"
      ),
      communitySpaceSharing: pickBoolean(
        communityRows,
        "A escola compartilha espaços para atividades de integração escola-comunidade"
      ),
      surroundingEquipmentUse: pickBoolean(
        communityRows,
        "A escola usa espaços e equipamentos do entorno escolar para atividades regulares com os alunos"
      )
    },
    digital: {
      internet: pickBoolean(digitalRows, "Internet", { presenceMeansTrue: true }),
      broadband: pickBoolean(digitalRows, "Banda Larga", { presenceMeansTrue: true }),
      localNetwork: getRowValue(digitalRows, "Rede local de interligação de computadores") || "",
      studentInternet: pickBoolean(digitalRows, "Acesso à Internet - Para uso dos alunos", { presenceMeansTrue: true }),
      administrativeInternet: pickBoolean(digitalRows, "Acesso à Internet - Para uso administrativo", { presenceMeansTrue: true }),
      teachingInternet: pickBoolean(digitalRows, "Acesso à Internet - Para uso nos processos de ensino e aprendizagem", { presenceMeansTrue: true }),
      communityInternet: pickBoolean(digitalRows, "Acesso à Internet - Para uso da comunidade", { presenceMeansTrue: true }),
      desktopCount: toCount(getRowValue(digitalRows, "Quantidade de computadores em uso pelos alunos (as) - Computador de mesa (desktop)")),
      laptopCount: toCount(getRowValue(digitalRows, "Quantidade de computadores em uso pelos alunos (as) - Computador portátil")),
      tabletCount: toCount(getRowValue(digitalRows, "Quantidade de computadores em uso pelos alunos (as) - Tablet")),
      projectorCount: toCount(getRowValue(digitalRows, "Projetor Multimídia (Datashow)")),
      digitalBoardCount: toCount(getRowValue(digitalRows, "Lousa Digital"))
    },
    facilities: {
      library: hasRow(facilitiesRows, "Biblioteca"),
      libraryOrReadingRoom: hasRow(facilitiesRows, "Biblioteca e/ou Sala de Leitura"),
      computerLab: hasRow(facilitiesRows, "Laboratório de Informática"),
      scienceLab: hasRow(facilitiesRows, "Laboratório de Ciências"),
      coveredCourt: hasRow(facilitiesRows, "Quadra de esportes coberta"),
      teachersRoom: hasRow(facilitiesRows, "Sala para os professores"),
      specialAttendanceRoom: hasRow(facilitiesRows, "Sala de atendimento especial"),
      kitchen: hasRow(facilitiesRows, "Cozinha")
    },
    staff: {
      pedagogicalSupport: toCount(getRowValue(
        staffRows,
        "Profissionais de apoio e supervisão pedagógica: pedagogo(a), coordenador(a) pedagógico(a), orientador(a) educacional, supervisor(a) escolar e coordenador(a) de área de ensino"
      )),
      secretary: toCount(getRowValue(staffRows, "Secretário(a) escolar")),
      generalServices: toCount(getRowValue(
        staffRows,
        "Auxiliar de serviços gerais, porteiro(a), zelador(a), faxineiro(a), horticultor(a), jardineiro(a)"
      )),
      kitchen: toCount(getRowValue(
        staffRows,
        "Profissionais de preparação e segurança alimentar, cozinheiro(a), merendeira e auxiliar de cozinha"
      )),
      labSupport: toCount(getRowValue(
        staffRows,
        "Técnicos(as), monitores(as), supervisores(as) ou auxiliares de laboratório(s), de apoio a tecnologias educacionais ou em multimeios/multimídias eletrônico/digitais"
      ))
    },
    sections
  };
}

function parseArgs(argv) {
  const options = {
    ineps: [],
    limit: 20,
    start: 0,
    force: false,
    delayMs: 200,
    dryRun: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--inep") {
      const nextValue = argv[index + 1] ?? "";
      options.ineps.push(
        ...nextValue.split(",").map(value => value.trim()).filter(Boolean)
      );
      index += 1;
      continue;
    }

    if (arg === "--limit") {
      const nextValue = Number(argv[index + 1] ?? options.limit);
      if (Number.isFinite(nextValue) && nextValue >= 0) {
        options.limit = nextValue;
      }
      index += 1;
      continue;
    }

    if (arg === "--start") {
      const nextValue = Number(argv[index + 1] ?? options.start);
      if (Number.isFinite(nextValue) && nextValue >= 0) {
        options.start = nextValue;
      }
      index += 1;
      continue;
    }

    if (arg === "--delay") {
      const nextValue = Number(argv[index + 1] ?? options.delayMs);
      if (Number.isFinite(nextValue) && nextValue >= 0) {
        options.delayMs = nextValue;
      }
      index += 1;
      continue;
    }

    if (arg === "--force") {
      options.force = true;
      continue;
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
    }
  }

  return options;
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function getCacheFilePath(inepCode) {
  return path.join(CACHE_DIR, `${inepCode}.json`);
}

function getStatusFilePath(inepCode) {
  return path.join(STATUS_DIR, `${inepCode}.json`);
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readStatusEntry(inepCode) {
  return readJson(getStatusFilePath(inepCode), null);
}

async function writeStatusEntry(inepCode, payload) {
  await fs.writeFile(getStatusFilePath(inepCode), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function clearStatusEntry(inepCode) {
  try {
    await fs.unlink(getStatusFilePath(inepCode));
  } catch {
    // Sem status anterior para remover.
  }
}

async function migrateLegacyCacheToPerSchoolFiles() {
  const legacyCache = await readJson(LEGACY_CACHE_FILE, {});
  const entries = Object.entries(legacyCache).filter(([inepCode, value]) => inepCode && value && typeof value === "object");

  if (!entries.length) {
    return 0;
  }

  let migratedCount = 0;

  for (const [inepCode, value] of entries) {
    const targetFilePath = getCacheFilePath(inepCode);

    if (await fileExists(targetFilePath)) {
      continue;
    }

    await fs.writeFile(targetFilePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    migratedCount += 1;
  }

  return migratedCount;
}

function getInepCodeFromRowLegacy(row) {
  return String(
    row?.["Código INEP"] ??
    row?.["Codigo INEP"] ??
    row?.["CÃ³digo INEP"] ??
    ""
  ).trim();
}

function getInepCodeFromRow(row) {
  if (!row || typeof row !== "object") {
    return "";
  }

  const matchingEntry = Object.entries(row).find(([key]) => /inep/i.test(String(key ?? "")));
  return String(matchingEntry?.[1] ?? "").trim();
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const schools = await readJson(SCHOOLS_FILE, []);
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.mkdir(STATUS_DIR, { recursive: true });
  const migratedCount = await migrateLegacyCacheToPerSchoolFiles();
  const allInepCodes = [...new Set(
    schools
      .map(row => getInepCodeFromRow(row))
      .filter(Boolean)
  )];

  const requestedCodes = options.ineps.length
    ? options.ineps
    : (
      options.limit === 0
        ? allInepCodes.slice(options.start)
        : allInepCodes.slice(options.start, options.start + options.limit)
    );

  const targetCodes = [];

  for (const code of requestedCodes) {
    const hasCacheFile = await fileExists(getCacheFilePath(code));
    const statusEntry = await readStatusEntry(code);
    const wasNotFound = String(statusEntry?.status ?? "").trim().toLowerCase() === "not_found";

    if (options.force || (!hasCacheFile && !wasNotFound)) {
      targetCodes.push(code);
    }
  }

  if (migratedCount > 0) {
    console.log(`Cache legado migrado: ${migratedCount} escola(s) convertidas para ${CACHE_DIR}.`);
  }

  if (!targetCodes.length) {
    console.log("Nenhum Código INEP pendente para sincronização.");
    return;
  }

  if (options.dryRun) {
    console.log(`Dry run: ${targetCodes.length} escola(s) pendente(s) para sincronização.`);
    console.log(`Primeiro Código INEP: ${targetCodes[0]}`);
    console.log(`Último Código INEP: ${targetCodes[targetCodes.length - 1]}`);
    return;
  }

  console.log(`Sincronizando ${targetCodes.length} escola(s)...`);

  for (let index = 0; index < targetCodes.length; index += 1) {
    const inepCode = targetCodes[index];
    const url = buildSchoolUrl(inepCode);

    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36",
          "accept-language": "pt-BR,pt;q=0.9,en;q=0.8"
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const enrichmentEntry = extractSchoolEnrichment(html, inepCode);
      await fs.writeFile(
        getCacheFilePath(inepCode),
        `${JSON.stringify(enrichmentEntry, null, 2)}\n`,
        "utf8"
      );
      await clearStatusEntry(inepCode);
      console.log(`[${index + 1}/${targetCodes.length}] ${inepCode} sincronizado.`);
    } catch (error) {
      const normalizedMessage = String(error?.message ?? "Erro desconhecido");
      const status = normalizedMessage === "HTTP 404" ? "not_found" : "error";

      await writeStatusEntry(inepCode, {
        inepCode,
        status,
        message: normalizedMessage,
        checkedAt: new Date().toISOString(),
        source: {
          label: SOURCE_LABEL,
          url
        }
      });
      console.error(`[${index + 1}/${targetCodes.length}] ${inepCode} falhou: ${error.message}`);
    }

    if (options.delayMs > 0 && index < targetCodes.length - 1) {
      await wait(options.delayMs);
    }
  }

  console.log(`Cache atualizado em ${CACHE_DIR}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
