const DATA_URL = "escolas-rurais.json";
const DEFAULT_PAGE_SIZE = 10;
const EMPTY_CELL = "&mdash;";
const IBGE_LOCALIDADES_API = "https://servicodados.ibge.gov.br/api/v1/localidades";
const SIDRA_API = "https://apisidra.ibge.gov.br/values";
const LITERACY_TABLE_ID = "9543";
const LITERACY_YEAR = "2022";
const LITERACY_SOURCE_LABEL = "IBGE • Censo Demográfico 2022";
const INCOME_TABLE_ID = "10295";
const INCOME_VARIABLE_ID = "13431";
const INCOME_YEAR = "2022";
const EDUCATION_ATTAINMENT_TABLE_ID = "10061";
const EDUCATION_ATTAINMENT_VARIABLE_ID = "2667";
const EDUCATION_STUDY_YEARS_TABLE_ID = "10062";
const EDUCATION_STUDY_YEARS_VARIABLE_ID = "13285";
const EDUCATION_YEAR = "2022";
const EDUCATION_SOURCE_LABEL = "IBGE - Censo Demográfico 2022 - Tabelas 10061 e 10062";
const EDUCATION_LEVEL_TOTAL_ID = "120704";
const EDUCATION_LEVEL_LOW_SCHOOLING_ID = "9493";
const EDUCATION_LEVEL_PRIMARY_COMPLETE_ID = "9494";
const EDUCATION_LEVEL_SECONDARY_COMPLETE_ID = "9495";
const EDUCATION_LEVEL_HIGHER_COMPLETE_ID = "99713";
const EDUCATION_AGE_GROUP_ID = "108866";
const EDUCATION_SEX_TOTAL_ID = "6794";
const EDUCATION_RACE_TOTAL_ID = "95251";
const EDUCATION_LOW_SCHOOLING_LABEL = "Fundamental incompleto";
const EDUCATION_PRIMARY_COMPLETE_LABEL = "Pelo menos fundamental completo";
const EDUCATION_SECONDARY_COMPLETE_LABEL = "Pelo menos ensino médio completo";
const INCOME_SOURCE_LABEL = "IBGE • Censo Demográfico 2022 • Tabela 10295";
const LOCAL_PROJECT_SOURCE_LABEL = "Base local do projeto (escolas-rurais.json)";
const MAP_SOURCE_LABEL = "Base local do projeto (escolas-rurais.json) + Google Maps";
const SCHOOL_ENRICHMENT_CACHE_DIR = "school-enrichment-cache";
const SCHOOL_ENRICHMENT_STATUS_DIR = "school-enrichment-status";
const SCHOOL_ENRICHMENT_BUNDLE_DIR = "school-enrichment-bundle";
const SCHOOL_ENRICHMENT_BUNDLE_MANIFEST_URL = `${SCHOOL_ENRICHMENT_BUNDLE_DIR}/manifest.json`;
const SCHOOL_ENRICHMENT_LEGACY_CACHE_URL = "school-enrichment-cache.json";
const SCHOOL_ENRICHMENT_SOURCE_LABEL = "Cultura Educa • Censo Escolar da Educação Básica 2020";

const FILTER_SELECTS = [
  { element: "regionFilter", key: "region", emptyLabel: "Todas" },
  { element: "ufFilter", key: "uf", emptyLabel: "Todas" },
  { element: "cityFilter", key: "city", emptyLabel: "Todos" },
  { element: "differentiatedFilter", key: "differentiatedLocation", emptyLabel: "Todas as localidades" },
  { element: "dependencyFilter", key: "dependency", emptyLabel: "Todas" },
  { element: "councilFilter", key: "councilRegulation", emptyLabel: "Todas" },
  { element: "schoolSizeFilter", key: "schoolSize", emptyLabel: "Todos" },
  { element: "stageFilter", key: "stages", emptyLabel: "Todas" }
];

const FILTER_VALUE_ORDER = {
  region: ["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"],
  differentiatedLocation: [
    "Rural",
    "Assentamento",
    "Terra Indígena",
    "Comunidades Tradicionais",
    "Remanescente de Quilombos"
  ]
};

const SEARCH_KEYS = ["school", "inep", "city", "uf", "address", "phone", "restriction", "stages"];

const TABLE_COLUMNS = [
  { key: "restriction", header: "Restrição", exportHeader: "Restrição de Atendimento" },
  {
    key: "school",
    header: "Escola",
    exportHeader: "Escola",
    render: row => renderSchoolTableCell(row)
  },
  { key: "inep", header: "Código INEP", exportHeader: "Código INEP" },
  { key: "uf", header: "UF", exportHeader: "UF" },
  { key: "city", header: "Município", exportHeader: "Município" },
  {
    key: "differentiatedLocation",
    header: "Localidade Diferenciada",
    headerHtml: "Área",
    exportHeader: "Localidade Diferenciada"
  },
  {
    key: "dependency",
    header: "Dependência Administrativa",
    headerHtml: "Categoria",
    exportHeader: "Dependência Administrativa",
    render: row => `<span class="pill">${renderValue(get(row, "dependency"))}</span>`
  },
  {
    key: "councilRegulation",
    header: "Regulamentação do Conselho",
    headerHtml: "Status",
    exportHeader: "Regulamentação pelo Conselho de Educação"
  },
  {
    key: "schoolSize",
    header: "Porte",
    exportHeader: "Porte da Escola",
    render: row => `<span class="school-size-text" title="${escapeHtml(text(get(row, "schoolSize")))}">${renderValue(get(row, "schoolSize"))}</span>`
  },
  {
    key: "stages",
    header: "Modalidade",
    exportHeader: "Etapas e Modalidade de Ensino Oferecidas",
    render: row => `<span class="muted">${renderValue(get(row, "stages"))}</span>`
  }
];

const app = {
  rawRows: [],
  filteredRows: [],
  columns: {},
  pageSize: DEFAULT_PAGE_SIZE,
  currentPage: 1,
  activeSchoolId: null,
  lastFocusedElement: null,
  lastSourcesFocusedElement: null,
  literacy: {
    brazilRate: null,
    regionRates: null,
    stateRates: null,
    ufMetadata: null,
    municipalityCatalogByUf: new Map(),
    municipalityRatesByUf: new Map(),
    pendingBasePromise: null,
    pendingUfMetadataPromise: null,
    pendingMunicipalityPromises: new Map(),
    panelRequestId: 0
  },
  income: {
    brazilValue: null,
    regionValues: null,
    stateValues: null,
    municipalityCatalogByUf: new Map(),
    municipalityValuesByUf: new Map(),
    pendingBasePromise: null,
    pendingMunicipalityPromises: new Map(),
    panelRequestId: 0
  },
  educationDashboard: {
    brazilProfile: null,
    regionProfiles: null,
    stateProfiles: null,
    pendingBasePromise: null,
    panelRequestId: 0
  },
  schoolEnrichment: {
    byInep: {},
    statusByInep: {},
    pendingByInep: new Map(),
    pendingStatusByInep: new Map(),
    manifest: null,
    pendingManifestPromise: null,
    loadedShardIds: new Set(),
    pendingShardById: new Map(),
    legacyLoaded: false,
    pendingLegacyPromise: null,
    retryTimerId: 0,
    retryCount: 0
  }
};

const regioesPorUF = {
  AC: "Norte",
  AL: "Nordeste",
  AP: "Norte",
  AM: "Norte",
  BA: "Nordeste",
  CE: "Nordeste",
  DF: "Centro-Oeste",
  ES: "Sudeste",
  GO: "Centro-Oeste",
  MA: "Nordeste",
  MT: "Centro-Oeste",
  MS: "Centro-Oeste",
  MG: "Sudeste",
  PA: "Norte",
  PB: "Nordeste",
  PR: "Sul",
  PE: "Nordeste",
  PI: "Nordeste",
  RJ: "Sudeste",
  RN: "Nordeste",
  RS: "Sul",
  RO: "Norte",
  RR: "Norte",
  SC: "Sul",
  SP: "Sudeste",
  SE: "Nordeste",
  TO: "Norte"
};

const escolasFechadasPorMacroregiao = {
  Norte: 475,
  Nordeste: 555,
  Sul: 240,
  "Centro-Oeste": 160,
  Sudeste: 155
};

const totalEscolasFechadas = Object.values(escolasFechadasPorMacroregiao)
  .reduce((total, quantidade) => total + quantidade, 0);

const CITY_FILTER_HINT_TEXT = "Escolha a UF para visualizar os municípios.";
let cityFilterHintTimeoutId = 0;
let deferredHomePanelsTimeoutId = 0;

const els = {
  searchInput: document.getElementById("searchInput"),
  pageSizeFilter: document.getElementById("pageSizeFilter"),
  regionFilter: document.getElementById("regionFilter"),
  ufFilter: document.getElementById("ufFilter"),
  cityFilter: document.getElementById("cityFilter"),
  differentiatedFilter: document.getElementById("differentiatedFilter"),
  dependencyFilter: document.getElementById("dependencyFilter"),
  councilFilter: document.getElementById("councilFilter"),
  schoolSizeFilter: document.getElementById("schoolSizeFilter"),
  stageFilter: document.getElementById("stageFilter"),
  clearBtn: document.getElementById("clearBtn"),
  statCount: document.getElementById("statCount"),
  statRegiao: document.getElementById("statRegiao"),
  statUFs: document.getElementById("statUFs"),
  statCities: document.getElementById("statCities"),
  escolaPorRegiao: document.getElementById("escolaPorRegiao"),
  cityFilterHint: document.getElementById("cityFilterHint"),
  literacyPanelStatus: document.getElementById("literacyPanelStatus"),
  literacyPanelContent: document.getElementById("literacyPanelContent"),
  incomeStatValue: document.getElementById("incomeStatValue"),
  incomeStatScope: document.getElementById("incomeStatScope"),
  educationDashboardStatus: document.getElementById("educationDashboardStatus"),
  educationDashboardPopulationNote: document.getElementById("educationDashboardPopulationNote"),
  educationDashboardSummary: document.getElementById("educationDashboardSummary"),
  educationDashboardChartTitle: document.getElementById("educationDashboardChartTitle"),
  educationDashboardChartNote: document.getElementById("educationDashboardChartNote"),
  educationDashboardChart: document.getElementById("educationDashboardChart"),
  educationDashboardSource: document.getElementById("educationDashboardSource"),
  resultSummary: document.getElementById("resultSummary"),
  tableWrap: document.getElementById("tableWrap"),
  paginationWrapBottom: document.getElementById("paginationWrapBottom"),
  paginationWrap: document.getElementById("paginationWrap"),
  openSourcesModal: document.getElementById("openSourcesModal"),
  schoolModal: document.getElementById("schoolModal"),
  schoolModalPanel: document.getElementById("schoolModalPanel"),
  schoolModalContent: document.getElementById("schoolModalContent"),
  sourcesModal: document.getElementById("sourcesModal"),
  sourcesModalPanel: document.getElementById("sourcesModalPanel"),
  sourcesModalContent: document.getElementById("sourcesModalContent")
};

els.pageSizeFilter.value = String(DEFAULT_PAGE_SIZE);

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const UTF8_TEXT_DECODER = typeof TextDecoder !== "undefined"
  ? new TextDecoder("utf-8")
  : null;
const LATIN1_TEXT_DECODER = typeof TextDecoder !== "undefined"
  ? new TextDecoder("windows-1252")
  : null;
const TEXT_REPAIR_CACHE = new Map();

function repairMojibake(value) {
  const resolvedValue = String(value ?? "");
  const cachedValue = TEXT_REPAIR_CACHE.get(resolvedValue);

  if (!/[ÃÂ]/.test(resolvedValue) || !UTF8_TEXT_DECODER) {
    return resolvedValue;
  }

  try {
    const bytes = Uint8Array.from(resolvedValue, character => character.charCodeAt(0));
    return UTF8_TEXT_DECODER.decode(bytes);
  } catch (error) {
    return resolvedValue;
  }
}

function repairMojibakeCached(value) {
  const resolvedValue = String(value ?? "");
  const cachedValue = TEXT_REPAIR_CACHE.get(resolvedValue);

  if (cachedValue !== undefined) {
    return cachedValue;
  }

  let finalValue = resolvedValue;

  if (
    UTF8_TEXT_DECODER &&
    (
      resolvedValue.includes("Ã") ||
      resolvedValue.includes("Â") ||
      resolvedValue.includes("â")
    )
  ) {
    try {
      const bytes = Uint8Array.from(resolvedValue, character => character.charCodeAt(0));
      finalValue = UTF8_TEXT_DECODER.decode(bytes);
    } catch (error) {
      finalValue = resolvedValue;
    }
  }

  if (TEXT_REPAIR_CACHE.size > 20000) {
    TEXT_REPAIR_CACHE.clear();
  }

  TEXT_REPAIR_CACHE.set(resolvedValue, finalValue);
  return finalValue;
}

function text(value) {
  return repairMojibakeCached(String(value ?? "").trim());
}

function normalizeText(value) {
  return text(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderValue(value, fallback = EMPTY_CELL) {
  const content = text(value);
  return content ? escapeHtml(content) : fallback;
}

function columnClassName(key) {
  return `col-${key.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`)}`;
}

function buildMapsEmbedUrl(row) {
  const coordinates = getSchoolCoordinates(row);

  if (coordinates) {
    const coordinateQuery = `${coordinates.lat},${coordinates.lng}`;
    return `https://maps.google.com/maps?hl=pt-BR&ll=${encodeURIComponent(coordinateQuery)}&q=${encodeURIComponent(coordinateQuery)}&z=16&t=k&output=embed`;
  }

  const query = [get(row, "school"), get(row, "address"), get(row, "city"), get(row, "uf")]
    .map(text)
    .filter(Boolean)
    .join(", ");

  if (!query) return "";

  return `https://maps.google.com/maps?hl=pt-BR&q=${encodeURIComponent(query)}&z=15&t=k&output=embed`;
}

function buildCultureEducaSchoolUrl(row) {
  const inepCode = text(get(row, "inep"));
  return inepCode ? `https://culturaeduca.cc/equipamento/escola_detalhe/${inepCode}/` : "";
}

function renderAddressLink(row) {
  const address = text(get(row, "address"));

  if (!address) {
    return EMPTY_CELL;
  }

  return `<span class="address-text" title="${escapeHtml(address)}">${escapeHtml(address)}</span>`;
}

function renderPhoneCell(row) {
  const phone = text(get(row, "phone"));

  if (!phone) {
    return EMPTY_CELL;
  }

  return `<span class="phone-text" title="${escapeHtml(phone)}">${escapeHtml(phone)}</span>`;
}

function renderSchoolTableCell(row) {
  const schoolName = text(get(row, "school")) || "Sem nome";
  const schoolLocation = buildSchoolLocationLabel(row) || "Localização não informada";

  return `
    <div class="school-cell">
      <strong class="school-name" title="${escapeHtml(schoolName)}">${escapeHtml(schoolName)}</strong>
      <span class="school-cell__meta">${escapeHtml(schoolLocation)}</span>
      <span class="school-cell__hint">Toque para abrir a ficha completa</span>
    </div>
  `;
}

function setTableMessage(message) {
  els.tableWrap.className = "empty";
  els.tableWrap.textContent = message;
}

function detectColumn(headers, possibilities) {
  const prepared = headers.map(header => ({
    original: header,
    normalized: normalize(header)
  }));

  for (const possible of possibilities) {
    const exact = prepared.find(item => item.normalized === normalize(possible));
    if (exact) return exact.original;
  }

  for (const possible of possibilities) {
    const partial = prepared.find(item => item.normalized.includes(normalize(possible)));
    if (partial) return partial.original;
  }

  return null;
}

function detectColumns(headers) {
  return {
    restriction: detectColumn(headers, ["Restrição de Atendimento", "Restricao de Atendimento"]),
    school: detectColumn(headers, ["Escola"]),
    inep: detectColumn(headers, ["Código INEP", "Codigo INEP"]),
    uf: detectColumn(headers, ["UF"]),
    city: detectColumn(headers, ["Município", "Municipio"]),
    differentiatedLocation: detectColumn(headers, ["Localidade Diferenciada"]),
    address: detectColumn(headers, ["Endereço", "Endereco"]),
    phone: detectColumn(headers, ["Telefone"]),
    dependency: detectColumn(headers, ["Dependência Administrativa", "Dependencia Administrativa"]),
    councilRegulation: detectColumn(headers, [
      "Regulamentação pelo Conselho de Educação",
      "Regulamentacao pelo Conselho de Educacao"
    ]),
    schoolSize: detectColumn(headers, ["Porte da Escola"]),
    otherModalities: detectColumn(headers, ["Outras Modalidades"]),
    latitude: detectColumn(headers, ["Latitude"]),
    longitude: detectColumn(headers, ["Longitude"]),
    stages: detectColumn(headers, [
      "Etapas e Modalidade de Ensino Oferecidas",
      "Etapas e Modalidades de Ensino Oferecidas"
    ])
  };
}

function get(row, key) {
  const column = app.columns[key];
  if (!column) return "";
  return text(row[column]);
}

function getRegionByUf(uf) {
  return regioesPorUF[text(uf)] || "";
}

function getFilterValue(row, key) {
  if (key === "region") {
    return getRegionByUf(get(row, "uf"));
  }

  return get(row, key);
}

function getSelectedRegion() {
  return text(els.regionFilter.value) || getRegionByUf(els.ufFilter.value);
}

function getClosedSchoolsLabel(region) {
  const quantidade = region
    ? escolasFechadasPorMacroregiao[region] ?? 0
    : totalEscolasFechadas;

  return quantidade.toLocaleString("pt-BR");
}

function normalizeLocationKey(value) {
  return normalize(value).replace(/[^a-z0-9 ]/g, "");
}

function parseCoordinateValue(value, axis) {
  const rawValue = text(value);

  if (!rawValue) {
    return null;
  }

  const sign = rawValue.startsWith("-") ? -1 : 1;
  const digits = rawValue.replace(/[^0-9]/g, "");

  if (!digits) {
    return null;
  }

  const candidateLengths = axis === "lat" ? [1, 2] : [1, 2, 3];
  const rangeMax = axis === "lat" ? 90 : 180;
  const preferredMin = axis === "lat" ? 0 : 30;
  const preferredMax = axis === "lat" ? 35 : 75;

  const candidates = candidateLengths
    .filter(length => digits.length > length)
    .map(length => sign * Number(`${digits.slice(0, length)}.${digits.slice(length)}`))
    .filter(candidate => Number.isFinite(candidate) && Math.abs(candidate) <= rangeMax);

  const preferredCandidate = candidates.find(candidate => {
    const absoluteValue = Math.abs(candidate);
    return absoluteValue >= preferredMin && absoluteValue <= preferredMax;
  });

  return preferredCandidate ?? candidates[0] ?? null;
}

function formatCoordinate(value) {
  if (typeof value !== "number") {
    return "Não disponível";
  }

  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 5,
    maximumFractionDigits: 5
  })}°`;
}

function getSchoolCoordinates(row) {
  const lat = parseCoordinateValue(get(row, "latitude"), "lat");
  const lng = parseCoordinateValue(get(row, "longitude"), "lng");

  if (typeof lat !== "number" || typeof lng !== "number") {
    return null;
  }

  return { lat, lng };
}

function buildCoordinateSummary(row) {
  const coordinates = getSchoolCoordinates(row);

  if (!coordinates) {
    return "Sem coordenadas válidas na base local.";
  }

  return `Lat ${formatCoordinate(coordinates.lat)} • Long ${formatCoordinate(coordinates.lng)}`;
}

function buildSchoolEnrichmentCacheUrl(inepCode) {
  return `${SCHOOL_ENRICHMENT_CACHE_DIR}/${encodeURIComponent(text(inepCode))}.json`;
}

function buildSchoolEnrichmentStatusUrl(inepCode) {
  return `${SCHOOL_ENRICHMENT_STATUS_DIR}/${encodeURIComponent(text(inepCode))}.json`;
}

function buildSchoolEnrichmentShardUrl(shardId) {
  const resolvedShardId = Number(shardId);

  if (!Number.isFinite(resolvedShardId) || resolvedShardId < 1) {
    return "";
  }

  return `${SCHOOL_ENRICHMENT_BUNDLE_DIR}/shard-${String(resolvedShardId).padStart(4, "0")}.json`;
}

async function ensureSchoolEnrichmentManifestLoaded() {
  if (app.schoolEnrichment.manifest) {
    return app.schoolEnrichment.manifest;
  }

  if (!app.schoolEnrichment.pendingManifestPromise) {
    app.schoolEnrichment.pendingManifestPromise = (async () => {
      try {
        let data;

        try {
          data = await loadJsonWithFetch(SCHOOL_ENRICHMENT_BUNDLE_MANIFEST_URL);
        } catch (fetchError) {
          data = await loadJsonWithXhr(SCHOOL_ENRICHMENT_BUNDLE_MANIFEST_URL);
        }

        if (data && typeof data === "object") {
          app.schoolEnrichment.manifest = data;
          return data;
        }
      } catch (error) {
        // Se a base fragmentada ainda não existir, seguimos com os fallbacks locais.
      } finally {
        app.schoolEnrichment.pendingManifestPromise = null;
      }

      app.schoolEnrichment.manifest = null;
      return null;
    })();
  }

  return app.schoolEnrichment.pendingManifestPromise;
}

async function ensureSchoolEnrichmentShardLoaded(shardId) {
  const resolvedShardId = Number(shardId);

  if (!Number.isFinite(resolvedShardId) || resolvedShardId < 1) {
    return null;
  }

  if (app.schoolEnrichment.loadedShardIds.has(resolvedShardId)) {
    return resolvedShardId;
  }

  if (!app.schoolEnrichment.pendingShardById.has(resolvedShardId)) {
    const request = (async () => {
      const shardUrl = buildSchoolEnrichmentShardUrl(resolvedShardId);

      if (!shardUrl) {
        return null;
      }

      try {
        let data;

        try {
          data = await loadJsonWithFetch(shardUrl);
        } catch (fetchError) {
          data = await loadJsonWithXhr(shardUrl);
        }

        if (data && typeof data === "object") {
          Object.assign(app.schoolEnrichment.byInep, data);
          app.schoolEnrichment.loadedShardIds.add(resolvedShardId);
          return resolvedShardId;
        }
      } catch (error) {
        // Se o shard ainda não existir, seguimos com os outros fallbacks.
      }

      return null;
    })().finally(() => {
      app.schoolEnrichment.pendingShardById.delete(resolvedShardId);
    });

    app.schoolEnrichment.pendingShardById.set(resolvedShardId, request);
  }

  return app.schoolEnrichment.pendingShardById.get(resolvedShardId);
}

async function ensureLegacySchoolEnrichmentLoaded() {
  if (app.schoolEnrichment.legacyLoaded) {
    return app.schoolEnrichment.byInep;
  }

  if (!app.schoolEnrichment.pendingLegacyPromise) {
    app.schoolEnrichment.pendingLegacyPromise = (async () => {
      try {
        let data;

        try {
          data = await loadJsonWithFetch(SCHOOL_ENRICHMENT_LEGACY_CACHE_URL);
        } catch (fetchError) {
          data = await loadJsonWithXhr(SCHOOL_ENRICHMENT_LEGACY_CACHE_URL);
        }

        if (data && typeof data === "object") {
          Object.assign(app.schoolEnrichment.byInep, data);
        }
      } catch (error) {
        // O cache legado continua apenas como fallback para registros antigos.
      } finally {
        app.schoolEnrichment.legacyLoaded = true;
      }

      return app.schoolEnrichment.byInep;
    })().finally(() => {
      app.schoolEnrichment.pendingLegacyPromise = null;
    });
  }

  return app.schoolEnrichment.pendingLegacyPromise;
}

async function ensureSchoolEnrichmentByInep(inepCode) {
  const resolvedInepCode = text(inepCode);

  if (!resolvedInepCode) {
    return null;
  }

  if (Object.prototype.hasOwnProperty.call(app.schoolEnrichment.byInep, resolvedInepCode)) {
    return app.schoolEnrichment.byInep[resolvedInepCode];
  }

  if (!app.schoolEnrichment.pendingByInep.has(resolvedInepCode)) {
    const request = (async () => {
      const manifest = await ensureSchoolEnrichmentManifestLoaded();
      const shardId = Number(manifest?.entries?.[resolvedInepCode]);

      if (Number.isFinite(shardId) && shardId > 0) {
        await ensureSchoolEnrichmentShardLoaded(shardId);

        if (Object.prototype.hasOwnProperty.call(app.schoolEnrichment.byInep, resolvedInepCode)) {
          delete app.schoolEnrichment.statusByInep[resolvedInepCode];
          return app.schoolEnrichment.byInep[resolvedInepCode];
        }
      }

      try {
        let data;
        const cacheUrl = buildSchoolEnrichmentCacheUrl(resolvedInepCode);

        try {
          data = await loadJsonWithFetch(cacheUrl);
        } catch (fetchError) {
          data = await loadJsonWithXhr(cacheUrl);
        }

        if (data && typeof data === "object") {
          app.schoolEnrichment.byInep[resolvedInepCode] = data;
          delete app.schoolEnrichment.statusByInep[resolvedInepCode];
          return data;
        }
      } catch (error) {
        // Se o arquivo individual ainda não existir, tentamos o cache legado.
      }

      await ensureLegacySchoolEnrichmentLoaded();

      if (Object.prototype.hasOwnProperty.call(app.schoolEnrichment.byInep, resolvedInepCode)) {
        delete app.schoolEnrichment.statusByInep[resolvedInepCode];
        return app.schoolEnrichment.byInep[resolvedInepCode];
      }

      return null;
    })().finally(() => {
      app.schoolEnrichment.pendingByInep.delete(resolvedInepCode);
    });

    app.schoolEnrichment.pendingByInep.set(resolvedInepCode, request);
  }

  return app.schoolEnrichment.pendingByInep.get(resolvedInepCode);
}

async function ensureSchoolEnrichmentStatusByInep(inepCode, { force = false } = {}) {
  const resolvedInepCode = text(inepCode);

  if (!resolvedInepCode) {
    return null;
  }

  if (!force && Object.prototype.hasOwnProperty.call(app.schoolEnrichment.statusByInep, resolvedInepCode)) {
    return app.schoolEnrichment.statusByInep[resolvedInepCode];
  }

  if (!force && app.schoolEnrichment.pendingStatusByInep.has(resolvedInepCode)) {
    return app.schoolEnrichment.pendingStatusByInep.get(resolvedInepCode);
  }

  const request = (async () => {
    const statusUrl = buildSchoolEnrichmentStatusUrl(resolvedInepCode);

    try {
      let data;

      try {
        data = await loadJsonWithFetch(statusUrl);
      } catch (fetchError) {
        data = await loadJsonWithXhr(statusUrl);
      }

      if (data && typeof data === "object") {
        app.schoolEnrichment.statusByInep[resolvedInepCode] = data;
        return data;
      }
    } catch (error) {
      // Se o status ainda não existir, mantemos o fallback de indisponibilidade genérica.
    }

    if (force) {
      delete app.schoolEnrichment.statusByInep[resolvedInepCode];
    }

    return app.schoolEnrichment.statusByInep[resolvedInepCode] ?? null;
  })().finally(() => {
    app.schoolEnrichment.pendingStatusByInep.delete(resolvedInepCode);
  });

  app.schoolEnrichment.pendingStatusByInep.set(resolvedInepCode, request);
  return request;
}

function getSchoolEnrichment(row) {
  const inepCode = text(get(row, "inep"));
  return inepCode ? app.schoolEnrichment.byInep[inepCode] ?? null : null;
}

function getSchoolEnrichmentStatus(row) {
  const inepCode = text(get(row, "inep"));
  return inepCode ? app.schoolEnrichment.statusByInep[inepCode] ?? null : null;
}

function getSchoolEnrichmentAvailability(row) {
  const entry = getSchoolEnrichment(row);

  if (entry) {
    return {
      state: "available",
      entry,
      status: null
    };
  }

  const status = getSchoolEnrichmentStatus(row);
  const resolvedState = text(status?.status);

  if (resolvedState === "not_found" || resolvedState === "error") {
    return {
      state: resolvedState,
      entry: null,
      status
    };
  }

  return {
    state: "pending",
    entry: null,
    status: null
  };
}

function formatSchoolEnrichmentCheckedAt(value) {
  const dateValue = value ? new Date(value) : null;

  if (!dateValue || Number.isNaN(dateValue.getTime())) {
    return "";
  }

  return dateValue.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function formatCount(value, fallback = "Não disponível") {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return value.toLocaleString("pt-BR");
}

function formatYesNo(value) {
  if (value === true) return "Sim";
  if (value === false) return "Não";
  return "Sem registro";
}

function parseCountFromText(value) {
  const match = String(value ?? "").match(/\d[\d.]*/);
  return match ? Number(match[0].replace(/\./g, "")) : null;
}

function buildSchoolEnrichmentRow(label, value) {
  const resolvedLabel = text(label);
  const resolvedValue = text(value);

  if (
    !resolvedLabel ||
    !resolvedValue ||
    resolvedValue === "Sem registro" ||
    resolvedValue === "Não disponível"
  ) {
    return null;
  }

  return {
    label: resolvedLabel,
    value: resolvedValue
  };
}

function isAllowedEnrichmentSectionValue(sectionId, value) {
  const resolvedSectionId = text(sectionId);
  const resolvedValue = text(value);

  if (!resolvedValue) {
    return false;
  }

  if (resolvedSectionId === "community" || resolvedSectionId === "facilities") {
    return resolvedValue === "Sim" || resolvedValue === "Não";
  }

  return true;
}

function getSchoolEnrollmentRows(entry) {
  const directRows = Array.isArray(entry?.enrollments) ? entry.enrollments : [];
  const sectionRows = Array.isArray(entry?.sections)
    ? entry.sections.find(section => text(section?.id) === "enrollments")?.rows ?? []
    : [];
  const sourceRows = directRows.length ? directRows : sectionRows;
  const seen = new Set();

  return sourceRows
    .map(row => ({
      label: text(row?.label),
      value: text(row?.value)
    }))
    .filter(row => row.label && row.value && row.value !== row.label && normalizeText(row.value).includes("matricula"))
    .filter(row => {
      const dedupeKey = `${row.label}::${row.value}`;

      if (seen.has(dedupeKey)) {
        return false;
      }

      seen.add(dedupeKey);
      return true;
    });
}

function createSchoolEnrollmentMetrics(entry) {
  return getSchoolEnrollmentRows(entry).map(row => {
    const [mainStage, ...detailParts] = row.label.split(" - ").map(text).filter(Boolean);
    const detail = detailParts.join(" - ");
    const count = parseCountFromText(row.value);

    return {
      label: mainStage || row.label,
      value: count !== null ? formatCount(count) : row.value,
      caption: detail || row.value
    };
  });
}

function createSchoolEnrichmentMetrics(entry) {
  const totalComputers = [
    entry?.digital?.desktopCount,
    entry?.digital?.laptopCount,
    entry?.digital?.tabletCount
  ].reduce((total, current) => total + (Number.isFinite(current) ? current : 0), 0);
  const projectorCount = entry?.digital?.projectorCount;

  return [
    {
      label: "Alunos",
      value: formatCount(entry?.overview?.studentsTotal),
      caption: "Total de alunos informado na ficha pública."
    },
    {
      label: "Computadores para alunos",
      value: totalComputers ? formatCount(totalComputers) : "Sem registro",
      caption: "Soma de desktops, portáteis e tablets em uso pelos alunos."
    },
    {
      label: "Internet na escola",
      value: formatYesNo(entry?.digital?.internet),
      caption: entry?.digital?.broadband === true
        ? "Com banda larga registrada."
        : "Sem confirmação de banda larga."
    },
    {
      label: "Projetores multimídia",
      value: Number.isFinite(projectorCount) ? formatCount(projectorCount) : "Sem registro",
      caption: "Quantidade registrada na ficha pública da escola."
    }
  ];
}

function getLegacySchoolEnrichmentSections(entry) {
  const digitalRows = [
    buildSchoolEnrichmentRow("Internet", formatYesNo(entry?.digital?.internet)),
    buildSchoolEnrichmentRow("Banda larga", formatYesNo(entry?.digital?.broadband)),
    buildSchoolEnrichmentRow("Rede local de interligação", text(entry?.digital?.localNetwork) || ""),
    buildSchoolEnrichmentRow("Uso da internet pelos alunos", formatYesNo(entry?.digital?.studentInternet)),
    buildSchoolEnrichmentRow("Uso administrativo da internet", formatYesNo(entry?.digital?.administrativeInternet)),
    buildSchoolEnrichmentRow("Uso da internet no ensino", formatYesNo(entry?.digital?.teachingInternet)),
    buildSchoolEnrichmentRow("Uso comunitário da internet", formatYesNo(entry?.digital?.communityInternet)),
    buildSchoolEnrichmentRow("Computador de mesa (desktop)", Number.isFinite(entry?.digital?.desktopCount) ? formatCount(entry?.digital?.desktopCount) : ""),
    buildSchoolEnrichmentRow("Computador portátil", Number.isFinite(entry?.digital?.laptopCount) ? formatCount(entry?.digital?.laptopCount) : ""),
    buildSchoolEnrichmentRow("Tablet", Number.isFinite(entry?.digital?.tabletCount) ? formatCount(entry?.digital?.tabletCount) : ""),
    buildSchoolEnrichmentRow("Projetor multimídia", Number.isFinite(entry?.digital?.projectorCount) ? formatCount(entry?.digital?.projectorCount) : ""),
    buildSchoolEnrichmentRow("Lousa digital", Number.isFinite(entry?.digital?.digitalBoardCount) ? formatCount(entry?.digital?.digitalBoardCount) : "")
  ].filter(Boolean);

  const facilitiesRows = [
    buildSchoolEnrichmentRow("Biblioteca", formatYesNo(entry?.facilities?.library)),
    buildSchoolEnrichmentRow("Biblioteca e/ou sala de leitura", formatYesNo(entry?.facilities?.libraryOrReadingRoom)),
    buildSchoolEnrichmentRow("Laboratório de informática", formatYesNo(entry?.facilities?.computerLab)),
    buildSchoolEnrichmentRow("Laboratório de ciências", formatYesNo(entry?.facilities?.scienceLab)),
    buildSchoolEnrichmentRow("Quadra de esportes coberta", formatYesNo(entry?.facilities?.coveredCourt)),
    buildSchoolEnrichmentRow("Sala para professores", formatYesNo(entry?.facilities?.teachersRoom)),
    buildSchoolEnrichmentRow("Sala de atendimento especial", formatYesNo(entry?.facilities?.specialAttendanceRoom)),
    buildSchoolEnrichmentRow("Cozinha", formatYesNo(entry?.facilities?.kitchen))
  ].filter(Boolean);

  const staffRows = [
    buildSchoolEnrichmentRow("Apoio e supervisão pedagógica", Number.isFinite(entry?.staff?.pedagogicalSupport) ? formatCount(entry?.staff?.pedagogicalSupport) : ""),
    buildSchoolEnrichmentRow("Secretaria escolar", Number.isFinite(entry?.staff?.secretary) ? formatCount(entry?.staff?.secretary) : ""),
    buildSchoolEnrichmentRow("Serviços gerais", Number.isFinite(entry?.staff?.generalServices) ? formatCount(entry?.staff?.generalServices) : ""),
    buildSchoolEnrichmentRow("Alimentação escolar", Number.isFinite(entry?.staff?.kitchen) ? formatCount(entry?.staff?.kitchen) : ""),
    buildSchoolEnrichmentRow("Laboratórios e apoio tecnológico", Number.isFinite(entry?.staff?.labSupport) ? formatCount(entry?.staff?.labSupport) : "")
  ].filter(Boolean);

  const communityRows = [
    buildSchoolEnrichmentRow("Abre no fim de semana", formatYesNo(entry?.overview?.weekendOpen)),
    buildSchoolEnrichmentRow("Projeto político-pedagógico atualizado", formatYesNo(entry?.overview?.pppUpdated)),
    buildSchoolEnrichmentRow("Compartilha espaços com a comunidade", formatYesNo(entry?.overview?.communitySpaceSharing)),
    buildSchoolEnrichmentRow("Usa espaços e equipamentos do entorno", formatYesNo(entry?.overview?.surroundingEquipmentUse))
  ].filter(Boolean);

  return [
    {
      id: "digital",
      title: "Internet, computadores e equipamentos multimídia",
      rows: digitalRows
    },
    {
      id: "facilities",
      title: "Infraestrutura e dependências",
      rows: facilitiesRows
    },
    {
      id: "staff",
      title: "Profissionais que atuam na escola",
      rows: staffRows
    },
    {
      id: "community",
      title: "Relação escola-comunidade",
      rows: communityRows
    }
  ].filter(section => section.rows.length > 0);
}

function getSchoolEnrichmentSections(entry) {
  const excludedLabels = new Set([
    "Utiliza transporte escolar público"
  ]);
  const excludedSectionIds = new Set([
    "enrollments"
  ]);

  const normalizedSections = Array.isArray(entry?.sections)
    ? entry.sections
        .map(section => ({
          id: text(section?.id),
          title: text(section?.title),
          rows: Array.isArray(section?.rows)
            ? section.rows
                .map(row => buildSchoolEnrichmentRow(row?.label, row?.value))
                .filter(Boolean)
                .filter(row => !excludedLabels.has(row.label))
                .filter(row => isAllowedEnrichmentSectionValue(section?.id, row.value))
            : []
        }))
        .filter(section => !excludedSectionIds.has(section.id) && section.title && section.rows.length > 0)
    : [];

  return normalizedSections.length
    ? normalizedSections
    : getLegacySchoolEnrichmentSections(entry);
}

function renderSchoolEnrichmentLoading() {
  return `
    <div class="school-enrichment__status">
      Carregando dados complementares da escola...
    </div>
    <p class="school-enrichment__source">Fonte prevista: ${escapeHtml(SCHOOL_ENRICHMENT_SOURCE_LABEL)}</p>
  `;
}

function renderSchoolEnrichmentUnavailableActions(row, { showSourceLink = true } = {}) {
  const cultureEducaUrl = showSourceLink ? buildCultureEducaSchoolUrl(row) : "";
  const rowId = getRowId(row);

  return `
    <div class="school-enrichment__actions">
      <button class="school-enrichment__retry" type="button" data-retry-school-enrichment="${rowId}">
        Recarregar esta escola
      </button>
      ${cultureEducaUrl
        ? `<a class="school-enrichment__link" href="${cultureEducaUrl}" target="_blank" rel="noopener noreferrer">Abrir ficha pública da escola</a>`
        : ""}
    </div>
    <p class="school-enrichment__source">
      Este painel não atualiza sozinho. Em um projeto estático, o navegador não consegue consultar o Cultura Educa diretamente no clique da ficha.
    </p>
  `;
}

function renderSchoolEnrichmentUnavailable(row) {

  return `
    <div class="school-enrichment__status">
      Dados complementares ainda não sincronizados localmente para esta escola.
    </div>
    <div class="school-enrichment__actions">
      ${cultureEducaUrl
        ? `<a class="school-enrichment__link" href="${cultureEducaUrl}" target="_blank" rel="noopener noreferrer">Abrir ficha pública da escola</a>`
        : ""}
    </div>
    <p class="school-enrichment__source">
      Fonte prevista: ${escapeHtml(SCHOOL_ENRICHMENT_SOURCE_LABEL)}.
    </p>
    <p class="school-enrichment__source">
      Dica: o projeto já está preparado para usar o cache local por escola em <code>${escapeHtml(SCHOOL_ENRICHMENT_CACHE_DIR)}/</code> quando a sincronização for concluída.
    </p>
  `;
}

function renderSchoolEnrollmentLoading() {
  return `
    <div class="school-sheet__literacy-status">
      Carregando matrículas por etapa...
    </div>
    <p class="school-sheet__literacy-source">Fonte prevista: ${escapeHtml(SCHOOL_ENRICHMENT_SOURCE_LABEL)}</p>
  `;
}

function renderSchoolEnrollmentUnavailable(row) {
  const cultureEducaUrl = buildCultureEducaSchoolUrl(row);

  return `
    <div class="school-sheet__literacy-status">
      Matrículas por etapa ainda não sincronizadas localmente para esta escola.
    </div>
    <p class="school-sheet__literacy-source">
      Fonte prevista: ${escapeHtml(SCHOOL_ENRICHMENT_SOURCE_LABEL)}
      ${cultureEducaUrl
        ? ` • <a href="${cultureEducaUrl}" target="_blank" rel="noopener noreferrer">ver ficha original</a>`
        : ""}
    </p>
  `;
}

function renderSchoolEnrollmentNotReported(row, entry) {
  const sourceLabel = text(entry?.source?.label) || SCHOOL_ENRICHMENT_SOURCE_LABEL;
  const sourceUrl = text(entry?.source?.url) || buildCultureEducaSchoolUrl(row);

  return `
    <div class="school-sheet__literacy-status">
      A ficha pública sincronizada não trouxe matrículas por etapa para esta escola.
    </div>
    <p class="school-sheet__literacy-source">
      Fonte: ${escapeHtml(sourceLabel)}
      ${sourceUrl
        ? ` • <a href="${sourceUrl}" target="_blank" rel="noopener noreferrer">ver ficha original</a>`
        : ""}
    </p>
  `;
}

function renderSchoolEnrichmentUnavailable(row) {
  const availability = getSchoolEnrichmentAvailability(row);
  const checkedAtLabel = formatSchoolEnrichmentCheckedAt(availability.status?.checkedAt);
  const errorMessage = text(availability.status?.message);

  if (availability.state === "not_found") {
    return `
      <div class="school-enrichment__status">
        Dados complementares não encontrados para esta escola na fonte Cultura Educa.
      </div>
      ${renderSchoolEnrichmentUnavailableActions(row, { showSourceLink: false })}
      <p class="school-enrichment__source">
        Fonte consultada: ${escapeHtml(SCHOOL_ENRICHMENT_SOURCE_LABEL)}.
      </p>
      <p class="school-enrichment__source">
        ${checkedAtLabel
          ? `Última verificação local: ${escapeHtml(checkedAtLabel)}.`
          : "A sincronização local marcou esta escola como não encontrada na ficha pública."}
      </p>
    `;
  }

  if (availability.state === "error") {
    return `
      <div class="school-enrichment__status">
        Não foi possível verificar os dados complementares desta escola na última sincronização local.
      </div>
      ${renderSchoolEnrichmentUnavailableActions(row)}
      <p class="school-enrichment__source">
        Fonte prevista: ${escapeHtml(SCHOOL_ENRICHMENT_SOURCE_LABEL)}.
      </p>
      <p class="school-enrichment__source">
        ${errorMessage
          ? `Último retorno registrado: ${escapeHtml(errorMessage)}.`
          : "Use o botão de recarregar para tentar novamente quando a base local for atualizada."}
      </p>
    `;
  }

  return `
    <div class="school-enrichment__status">
      Dados complementares ainda não disponíveis no cache local desta escola.
    </div>
    ${renderSchoolEnrichmentUnavailableActions(row)}
    <p class="school-enrichment__source">
      Fonte prevista: ${escapeHtml(SCHOOL_ENRICHMENT_SOURCE_LABEL)}.
    </p>
    <p class="school-enrichment__source">
      Dica: quando existir um arquivo em <code>${escapeHtml(SCHOOL_ENRICHMENT_CACHE_DIR)}/</code> para este INEP, use o botão de recarregar para tentar novamente.
    </p>
  `;
}

function renderSchoolEnrollmentUnavailable(row) {
  const availability = getSchoolEnrichmentAvailability(row);
  const checkedAtLabel = formatSchoolEnrichmentCheckedAt(availability.status?.checkedAt);
  const errorMessage = text(availability.status?.message);

  if (availability.state === "not_found") {
    return `
      <div class="school-sheet__literacy-status">
        Matrículas por etapa não encontradas para esta escola na fonte Cultura Educa.
      </div>
      ${renderSchoolEnrichmentUnavailableActions(row, { showSourceLink: false })}
      <p class="school-sheet__literacy-source">
        Fonte consultada: ${escapeHtml(SCHOOL_ENRICHMENT_SOURCE_LABEL)}.
      </p>
      <p class="school-sheet__literacy-source">
        ${checkedAtLabel
          ? `Última verificação local: ${escapeHtml(checkedAtLabel)}.`
          : "A sincronização local marcou esta escola como não encontrada na ficha pública."}
      </p>
    `;
  }

  if (availability.state === "error") {
    return `
      <div class="school-sheet__literacy-status">
        Não foi possível verificar as matrículas por etapa desta escola na última sincronização local.
      </div>
      ${renderSchoolEnrichmentUnavailableActions(row)}
      <p class="school-sheet__literacy-source">
        Fonte prevista: ${escapeHtml(SCHOOL_ENRICHMENT_SOURCE_LABEL)}.
      </p>
      <p class="school-sheet__literacy-source">
        ${errorMessage
          ? `Último retorno registrado: ${escapeHtml(errorMessage)}.`
          : "Use o botão de recarregar para tentar novamente quando a base local for atualizada."}
      </p>
    `;
  }

  return `
    <div class="school-sheet__literacy-status">
      Matrículas por etapa ainda não disponíveis no cache local desta escola.
    </div>
    ${renderSchoolEnrichmentUnavailableActions(row)}
    <p class="school-sheet__literacy-source">
      Fonte prevista: ${escapeHtml(SCHOOL_ENRICHMENT_SOURCE_LABEL)}.
    </p>
  `;
}

function renderSchoolEnrollmentPanel(row) {
  const entry = getSchoolEnrichment(row);

  if (!entry) {
    return renderSchoolEnrollmentUnavailable(row);
  }

  const metrics = createSchoolEnrollmentMetrics(entry);
  const sourceLabel = text(entry?.source?.label) || SCHOOL_ENRICHMENT_SOURCE_LABEL;
  const sourceUrl = text(entry?.source?.url) || buildCultureEducaSchoolUrl(row);

  if (!metrics.length) {
    return renderSchoolEnrollmentNotReported(row, entry);
  }

  return `
    ${renderLiteracyMetrics(metrics, {
      compact: true,
      single: metrics.length === 1
    })}
    <p class="school-sheet__literacy-source">
      Fonte: ${escapeHtml(sourceLabel)}
      ${sourceUrl
        ? ` • <a href="${sourceUrl}" target="_blank" rel="noopener noreferrer">ver ficha original</a>`
        : ""}
    </p>
  `;
}

function renderSchoolEnrichment(entry, row) {
  const metrics = createSchoolEnrichmentMetrics(entry);
  const sections = getSchoolEnrichmentSections(entry);
  const sourceLabel = text(entry?.source?.label) || SCHOOL_ENRICHMENT_SOURCE_LABEL;
  const sourceUrl = text(entry?.source?.url) || buildCultureEducaSchoolUrl(row);

  return `
    <div class="school-enrichment__grid">
      ${metrics.map(metric => `
        <article class="school-enrichment__card">
          <p class="school-enrichment__label">${escapeHtml(metric.label)}</p>
          <strong class="school-enrichment__value">${escapeHtml(metric.value)}</strong>
          <p class="school-enrichment__caption">${escapeHtml(metric.caption)}</p>
        </article>
      `).join("")}
    </div>

    ${sections.length
      ? `
        <div class="school-enrichment__details">
          ${sections.map(section => `
            <article class="school-enrichment__detail-card">
              <p class="school-enrichment__detail-title">${escapeHtml(section.title)}</p>
              <dl class="school-enrichment__detail-list">
                ${section.rows.map(rowItem => `
                  <div>
                    <dt>${escapeHtml(rowItem.label)}</dt>
                    <dd>${escapeHtml(rowItem.value)}</dd>
                  </div>
                `).join("")}
              </dl>
            </article>
          `).join("")}
        </div>
      `
      : ""}

    <p class="school-enrichment__source">
      Fonte: ${escapeHtml(sourceLabel)}
      ${sourceUrl
        ? ` • <a href="${sourceUrl}" target="_blank" rel="noopener noreferrer">ver ficha original</a>`
        : ""}
    </p>
  `;
}

async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Falha ao carregar ${url}: ${response.status}`);
  }

  return response.json();
}

function parseSidraRows(data) {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.filter(row => row && row.V !== "Valor");
}

function parseLiteracyRate(value) {
  const numericValue = Number.parseFloat(String(value ?? "").replace(",", "."));
  return Number.isFinite(numericValue) ? numericValue : null;
}

function parseIncomeValue(value) {
  const numericValue = Number.parseFloat(String(value ?? "").replace(",", "."));
  return Number.isFinite(numericValue) ? numericValue : null;
}

function parseEducationValue(value) {
  const numericValue = Number.parseFloat(String(value ?? "").replace(",", "."));
  return Number.isFinite(numericValue) ? numericValue : null;
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function calculateShare(count, total) {
  if (!isFiniteNumber(count) || !isFiniteNumber(total) || total <= 0) {
    return null;
  }

  return (count / total) * 100;
}

function formatLiteracyRate(value) {
  if (typeof value !== "number") {
    return "Não disponível";
  }

  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  })}%`;
}

function formatCurrency(value) {
  if (typeof value !== "number") {
    return "Não disponível";
  }

  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function formatEducationShare(value) {
  if (!isFiniteNumber(value)) {
    return "Não disponível";
  }

  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  })}%`;
}

function formatEducationYears(value) {
  if (!isFiniteNumber(value)) {
    return "Não disponível";
  }

  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  })} anos`;
}

function formatEducationPeople(value) {
  if (!isFiniteNumber(value)) {
    return "Base indisponível";
  }

  try {
    return `${new Intl.NumberFormat("pt-BR", {
      notation: "compact",
      maximumFractionDigits: 1
    }).format(value)} pessoas`;
  } catch (error) {
    return `${Math.round(value).toLocaleString("pt-BR")} pessoas`;
  }
}

function formatEducationPeopleExact(value) {
  if (!isFiniteNumber(value)) {
    return "Base indisponível";
  }

  return `${Math.round(value).toLocaleString("pt-BR")} pessoas`;
}

function buildLiteracyMetricCard(metric) {
  return `
    <article class="literacy-metric ${metric.compact ? "literacy-metric--compact" : ""}">
      <p class="literacy-metric__label">${escapeHtml(metric.label)}</p>
      <strong class="literacy-metric__value">${escapeHtml(metric.value)}</strong>
      <p class="literacy-metric__caption">${escapeHtml(metric.caption)}</p>
    </article>
  `;
}

function renderLiteracyMetrics(metrics, options = {}) {
  const wrapperClass = [
    "literacy-metrics",
    options.compact ? "literacy-metrics--compact" : "",
    options.single ? "literacy-metrics--single" : ""
  ].filter(Boolean).join(" ");

  return `
    <div class="${wrapperClass}">
      ${metrics.map(metric => buildLiteracyMetricCard({
        ...metric,
        compact: Boolean(options.compact)
      })).join("")}
    </div>
  `;
}

function setCityFilterHint(message = "") {
  if (!els.cityFilterHint) return;

  els.cityFilterHint.textContent = message;
  els.cityFilterHint.classList.toggle("is-visible", Boolean(message));
}

function hideCityFilterHint() {
  window.clearTimeout(cityFilterHintTimeoutId);
  setCityFilterHint("");
}

function showCityFilterHint() {
  setCityFilterHint(CITY_FILTER_HINT_TEXT);
  window.clearTimeout(cityFilterHintTimeoutId);
  cityFilterHintTimeoutId = window.setTimeout(hideCityFilterHint, 2400);
}

function setCityFilterAvailabilityState(isBlocked) {
  els.cityFilter.classList.toggle("is-blocked", isBlocked);
  els.cityFilter.setAttribute("aria-disabled", String(isBlocked));
  els.cityFilter.title = isBlocked ? CITY_FILTER_HINT_TEXT : "";
}

function getRowsByUf(uf) {
  const selectedUf = text(uf);

  if (!selectedUf) {
    return [];
  }

  return app.rawRows.filter(row => get(row, "uf") === selectedUf);
}

function getRowsByRegion(region) {
  const selectedRegion = text(region);

  if (!selectedRegion) {
    return app.rawRows;
  }

  return app.rawRows.filter(row => getRegionByUf(get(row, "uf")) === selectedRegion);
}

function syncUfFilterOptions(options = {}) {
  const { preserveSelection = true } = options;
  const selectedRegion = text(els.regionFilter.value);
  const currentUf = preserveSelection ? text(els.ufFilter.value) : "";
  const availableUfs = uniqueSorted(getRowsByRegion(selectedRegion).map(row => get(row, "uf")));

  fillSelect(els.ufFilter, availableUfs, "Todas");

  if (availableUfs.includes(currentUf)) {
    els.ufFilter.value = currentUf;
    return;
  }

  els.ufFilter.value = "";
}

function syncCityFilterOptions(options = {}) {
  const { preserveSelection = true } = options;
  const selectedUf = text(els.ufFilter.value);
  const currentCity = preserveSelection ? text(els.cityFilter.value) : "";
  const availableCities = selectedUf
    ? uniqueSorted(getRowsByUf(selectedUf).map(row => get(row, "city")))
    : [];

  fillSelect(
    els.cityFilter,
    availableCities,
    selectedUf ? "Todos" : "Escolha a UF primeiro"
  );

  if (!availableCities.includes(currentCity)) {
    els.cityFilter.value = "";
  }

  setCityFilterAvailabilityState(!selectedUf);

  if (selectedUf) {
    hideCityFilterHint();
  }
}

async function ensureUfMetadataLoaded() {
  if (app.literacy.ufMetadata) {
    return app.literacy.ufMetadata;
  }

  if (!app.literacy.pendingUfMetadataPromise) {
    app.literacy.pendingUfMetadataPromise = fetchJson(`${IBGE_LOCALIDADES_API}/estados`)
      .then(states => {
        const metadata = new Map();

        states.forEach(state => {
          metadata.set(state.sigla, {
            id: String(state.id),
            sigla: state.sigla,
            nome: state.nome,
            regiaoId: String(state.regiao.id),
            regiaoNome: state.regiao.nome
          });
        });

        app.literacy.ufMetadata = metadata;
        return metadata;
      })
      .finally(() => {
        app.literacy.pendingUfMetadataPromise = null;
      });
  }

  return app.literacy.pendingUfMetadataPromise;
}

function buildEducationAttainmentUrl(territorySegment) {
  return `${SIDRA_API}/t/${EDUCATION_ATTAINMENT_TABLE_ID}/v/${EDUCATION_ATTAINMENT_VARIABLE_ID}/${territorySegment}` +
    `/p/${EDUCATION_YEAR}` +
    `/c1568/${EDUCATION_LEVEL_TOTAL_ID},${EDUCATION_LEVEL_LOW_SCHOOLING_ID},${EDUCATION_LEVEL_PRIMARY_COMPLETE_ID},${EDUCATION_LEVEL_SECONDARY_COMPLETE_ID},${EDUCATION_LEVEL_HIGHER_COMPLETE_ID}` +
    `/c58/${EDUCATION_AGE_GROUP_ID}` +
    `/c2/${EDUCATION_SEX_TOTAL_ID}` +
    `/c86/${EDUCATION_RACE_TOTAL_ID}?formato=json`;
}

function buildEducationStudyYearsUrl(territorySegment) {
  return `${SIDRA_API}/t/${EDUCATION_STUDY_YEARS_TABLE_ID}/v/${EDUCATION_STUDY_YEARS_VARIABLE_ID}/${territorySegment}` +
    `/p/${EDUCATION_YEAR}` +
    `/c58/${EDUCATION_AGE_GROUP_ID}` +
    `/c2/${EDUCATION_SEX_TOTAL_ID}` +
    `/c86/${EDUCATION_RACE_TOTAL_ID}?formato=json`;
}

function createEducationProfile(key, label) {
  return {
    key,
    label,
    totalCount: null,
    lowSchoolingCount: null,
    primaryCompleteCount: null,
    secondaryCompleteCount: null,
    higherEducationCount: null,
    atLeastPrimaryCompleteCount: null,
    atLeastHighSchoolCount: null,
    highSchoolOrMoreCount: null,
    lowSchoolingShare: null,
    atLeastPrimaryCompleteShare: null,
    primaryCompleteShare: null,
    secondaryCompleteShare: null,
    atLeastHighSchoolShare: null,
    highSchoolOrMoreShare: null,
    higherEducationShare: null,
    averageYears: null
  };
}

function finalizeEducationProfile(profile) {
  const completedPrimary = isFiniteNumber(profile.primaryCompleteCount) ? profile.primaryCompleteCount : 0;
  const completedSecondary = isFiniteNumber(profile.secondaryCompleteCount) ? profile.secondaryCompleteCount : 0;
  const completedHigher = isFiniteNumber(profile.higherEducationCount) ? profile.higherEducationCount : 0;
  const atLeastPrimaryCompleteCount =
    isFiniteNumber(profile.primaryCompleteCount) ||
    isFiniteNumber(profile.secondaryCompleteCount) ||
    isFiniteNumber(profile.higherEducationCount)
      ? completedPrimary + completedSecondary + completedHigher
      : null;
  const atLeastHighSchoolCount =
    isFiniteNumber(profile.secondaryCompleteCount) || isFiniteNumber(profile.higherEducationCount)
      ? completedSecondary + completedHigher
      : null;
  const highSchoolOrMoreCount =
    isFiniteNumber(profile.secondaryCompleteCount) || isFiniteNumber(profile.higherEducationCount)
      ? completedSecondary + completedHigher
      : null;

  return {
    ...profile,
    atLeastPrimaryCompleteCount,
    atLeastHighSchoolCount,
    highSchoolOrMoreCount,
    lowSchoolingShare: calculateShare(profile.lowSchoolingCount, profile.totalCount),
    atLeastPrimaryCompleteShare: calculateShare(atLeastPrimaryCompleteCount, profile.totalCount),
    primaryCompleteShare: calculateShare(profile.primaryCompleteCount, profile.totalCount),
    secondaryCompleteShare: calculateShare(profile.secondaryCompleteCount, profile.totalCount),
    atLeastHighSchoolShare: calculateShare(atLeastHighSchoolCount, profile.totalCount),
    highSchoolOrMoreShare: calculateShare(highSchoolOrMoreCount, profile.totalCount),
    higherEducationShare: calculateShare(profile.higherEducationCount, profile.totalCount)
  };
}

function buildEducationProfilesMap(rows, territoryResolver, levelCodeKey) {
  const profiles = new Map();

  rows.forEach(row => {
    const territory = territoryResolver(row);

    if (!territory) {
      return;
    }

    const currentProfile = profiles.get(territory.key) || createEducationProfile(territory.key, territory.label);
    const levelCode = text(row[levelCodeKey]);
    const numericValue = parseEducationValue(row.V);

    if (levelCode === EDUCATION_LEVEL_TOTAL_ID) {
      currentProfile.totalCount = numericValue;
    }

    if (levelCode === EDUCATION_LEVEL_LOW_SCHOOLING_ID) {
      currentProfile.lowSchoolingCount = numericValue;
    }

    if (levelCode === EDUCATION_LEVEL_PRIMARY_COMPLETE_ID) {
      currentProfile.primaryCompleteCount = numericValue;
    }

    if (levelCode === EDUCATION_LEVEL_SECONDARY_COMPLETE_ID) {
      currentProfile.secondaryCompleteCount = numericValue;
    }

    if (levelCode === EDUCATION_LEVEL_HIGHER_COMPLETE_ID) {
      currentProfile.higherEducationCount = numericValue;
    }

    profiles.set(territory.key, currentProfile);
  });

  return profiles;
}

function mergeEducationStudyYearsRows(rows, territoryResolver, profiles) {
  rows.forEach(row => {
    const territory = territoryResolver(row);

    if (!territory) {
      return;
    }

    const currentProfile = profiles.get(territory.key) || createEducationProfile(territory.key, territory.label);
    currentProfile.averageYears = parseEducationValue(row.V);
    profiles.set(territory.key, currentProfile);
  });

  return profiles;
}

function finalizeEducationProfilesMap(profiles) {
  const finalizedProfiles = new Map();

  profiles.forEach((profile, key) => {
    finalizedProfiles.set(key, finalizeEducationProfile(profile));
  });

  return finalizedProfiles;
}

function resolveBrazilEducationTerritory() {
  return { key: "Brasil", label: "Brasil" };
}

function resolveRegionEducationTerritory(row) {
  const label = text(row.D2N);
  return label ? { key: label, label } : null;
}

function resolveStateEducationTerritory(row, ufById) {
  const metadata = ufById.get(text(row.D2C));

  if (!metadata) {
    return null;
  }

  return {
    key: metadata.sigla,
    label: `${metadata.nome} (${metadata.sigla})`
  };
}

async function ensureEducationDashboardLoaded() {
  if (
    app.educationDashboard.brazilProfile &&
    app.educationDashboard.regionProfiles &&
    app.educationDashboard.stateProfiles
  ) {
    return;
  }

  if (!app.educationDashboard.pendingBasePromise) {
    app.educationDashboard.pendingBasePromise = Promise.all([
      ensureUfMetadataLoaded(),
      fetchJson(buildEducationAttainmentUrl("n1/1")),
      fetchJson(buildEducationAttainmentUrl("n2/all")),
      fetchJson(buildEducationAttainmentUrl("n3/all")),
      fetchJson(buildEducationStudyYearsUrl("n1/1")),
      fetchJson(buildEducationStudyYearsUrl("n2/all")),
      fetchJson(buildEducationStudyYearsUrl("n3/all"))
    ])
      .then(([
        ufMetadata,
        brazilAttainmentResponse,
        regionAttainmentResponse,
        stateAttainmentResponse,
        brazilStudyYearsResponse,
        regionStudyYearsResponse,
        stateStudyYearsResponse
      ]) => {
        const ufById = new Map(
          [...ufMetadata.values()].map(metadata => [metadata.id, metadata])
        );

        const brazilProfiles = buildEducationProfilesMap(
          parseSidraRows(brazilAttainmentResponse),
          resolveBrazilEducationTerritory,
          "D4C"
        );
        mergeEducationStudyYearsRows(
          parseSidraRows(brazilStudyYearsResponse),
          resolveBrazilEducationTerritory,
          brazilProfiles
        );

        const regionProfiles = buildEducationProfilesMap(
          parseSidraRows(regionAttainmentResponse),
          resolveRegionEducationTerritory,
          "D4C"
        );
        mergeEducationStudyYearsRows(
          parseSidraRows(regionStudyYearsResponse),
          resolveRegionEducationTerritory,
          regionProfiles
        );

        const stateProfiles = buildEducationProfilesMap(
          parseSidraRows(stateAttainmentResponse),
          row => resolveStateEducationTerritory(row, ufById),
          "D4C"
        );
        mergeEducationStudyYearsRows(
          parseSidraRows(stateStudyYearsResponse),
          row => resolveStateEducationTerritory(row, ufById),
          stateProfiles
        );

        app.educationDashboard.brazilProfile = finalizeEducationProfile(
          brazilProfiles.get("Brasil") || createEducationProfile("Brasil", "Brasil")
        );
        app.educationDashboard.regionProfiles = finalizeEducationProfilesMap(regionProfiles);
        app.educationDashboard.stateProfiles = finalizeEducationProfilesMap(stateProfiles);
      })
      .finally(() => {
        app.educationDashboard.pendingBasePromise = null;
      });
  }

  return app.educationDashboard.pendingBasePromise;
}

async function ensureBaseLiteracyLoaded() {
  if (app.literacy.brazilRate !== null && app.literacy.regionRates && app.literacy.stateRates) {
    return;
  }

  if (!app.literacy.pendingBasePromise) {
    app.literacy.pendingBasePromise = Promise.all([
      ensureUfMetadataLoaded(),
      fetchJson(`${SIDRA_API}/t/${LITERACY_TABLE_ID}/n1/1/p/${LITERACY_YEAR}?formato=json`),
      fetchJson(`${SIDRA_API}/t/${LITERACY_TABLE_ID}/n2/all/p/${LITERACY_YEAR}?formato=json`),
      fetchJson(`${SIDRA_API}/t/${LITERACY_TABLE_ID}/n3/all/p/${LITERACY_YEAR}?formato=json`)
    ])
      .then(([ufMetadata, brazilResponse, regionResponse, stateResponse]) => {
        const brazilRow = parseSidraRows(brazilResponse)[0];
        const regionRates = new Map();
        const stateRates = new Map();
        const ufById = new Map(
          [...ufMetadata.values()].map(meta => [meta.id, meta])
        );

        parseSidraRows(regionResponse).forEach(row => {
          regionRates.set(text(row.D1N), parseLiteracyRate(row.V));
        });

        parseSidraRows(stateResponse).forEach(row => {
          const meta = ufById.get(text(row.D1C));
          if (meta) {
            stateRates.set(meta.sigla, parseLiteracyRate(row.V));
          }
        });

        app.literacy.brazilRate = parseLiteracyRate(brazilRow?.V);
        app.literacy.regionRates = regionRates;
        app.literacy.stateRates = stateRates;
      })
      .finally(() => {
        app.literacy.pendingBasePromise = null;
      });
  }

  return app.literacy.pendingBasePromise;
}

async function ensureBaseIncomeLoaded() {
  if (app.income.brazilValue !== null && app.income.regionValues && app.income.stateValues) {
    return;
  }

  if (!app.income.pendingBasePromise) {
    app.income.pendingBasePromise = Promise.all([
      ensureUfMetadataLoaded(),
      fetchJson(`${SIDRA_API}/t/${INCOME_TABLE_ID}/v/${INCOME_VARIABLE_ID}/n1/1/p/${INCOME_YEAR}?formato=json`),
      fetchJson(`${SIDRA_API}/t/${INCOME_TABLE_ID}/v/${INCOME_VARIABLE_ID}/n2/all/p/${INCOME_YEAR}?formato=json`),
      fetchJson(`${SIDRA_API}/t/${INCOME_TABLE_ID}/v/${INCOME_VARIABLE_ID}/n3/all/p/${INCOME_YEAR}?formato=json`)
    ])
      .then(([ufMetadata, brazilResponse, regionResponse, stateResponse]) => {
        const incomeRowsByTotal = data =>
          parseSidraRows(data).filter(row =>
            text(row.D4N) === "Total" &&
            text(row.D5N) === "Total" &&
            text(row.D6N) === "Total"
          );
        const brazilRow = incomeRowsByTotal(brazilResponse)[0];
        const regionValues = new Map();
        const stateValues = new Map();
        const ufById = new Map(
          [...ufMetadata.values()].map(meta => [meta.id, meta])
        );

        incomeRowsByTotal(regionResponse).forEach(row => {
          regionValues.set(text(row.D2N), parseIncomeValue(row.V));
        });

        incomeRowsByTotal(stateResponse).forEach(row => {
          const meta = ufById.get(text(row.D2C));
          if (meta) {
            stateValues.set(meta.sigla, parseIncomeValue(row.V));
          }
        });

        app.income.brazilValue = parseIncomeValue(brazilRow?.V);
        app.income.regionValues = regionValues;
        app.income.stateValues = stateValues;
      })
      .finally(() => {
        app.income.pendingBasePromise = null;
      });
  }

  return app.income.pendingBasePromise;
}

async function ensureMunicipalityIncomeByUf(uf) {
  const ufSigla = text(uf);

  if (!ufSigla) {
    return;
  }

  if (
    app.income.municipalityCatalogByUf.has(ufSigla) &&
    app.income.municipalityValuesByUf.has(ufSigla)
  ) {
    return;
  }

  if (!app.income.pendingMunicipalityPromises.has(ufSigla)) {
    const request = Promise.all([
      ensureUfMetadataLoaded(),
      fetchJson(`${IBGE_LOCALIDADES_API}/estados/${ufSigla}/municipios`)
    ])
      .then(async ([ufMetadata, municipalities]) => {
        const ufMeta = ufMetadata.get(ufSigla);

        if (!ufMeta) {
          throw new Error(`UF não encontrada para ${ufSigla}.`);
        }

        const incomeResponse = await fetchJson(
          `${SIDRA_API}/t/${INCOME_TABLE_ID}/v/${INCOME_VARIABLE_ID}/n6/in%20n3%20${ufMeta.id}/p/${INCOME_YEAR}?formato=json`
        );

        const municipalityCatalog = new Map();
        const municipalityValues = new Map();

        municipalities.forEach(municipality => {
          municipalityCatalog.set(normalizeLocationKey(municipality.nome), {
            id: String(municipality.id),
            nome: municipality.nome
          });
        });

        parseSidraRows(incomeResponse)
          .filter(row =>
            text(row.D4N) === "Total" &&
            text(row.D5N) === "Total" &&
            text(row.D6N) === "Total"
          )
          .forEach(row => {
            municipalityValues.set(text(row.D2C), parseIncomeValue(row.V));
          });

        app.income.municipalityCatalogByUf.set(ufSigla, municipalityCatalog);
        app.income.municipalityValuesByUf.set(ufSigla, municipalityValues);
      })
      .finally(() => {
        app.income.pendingMunicipalityPromises.delete(ufSigla);
      });

    app.income.pendingMunicipalityPromises.set(ufSigla, request);
  }

  return app.income.pendingMunicipalityPromises.get(ufSigla);
}

async function ensureMunicipalityLiteracyByUf(uf) {
  const ufSigla = text(uf);

  if (!ufSigla) {
    return;
  }

  if (
    app.literacy.municipalityCatalogByUf.has(ufSigla) &&
    app.literacy.municipalityRatesByUf.has(ufSigla)
  ) {
    return;
  }

  if (!app.literacy.pendingMunicipalityPromises.has(ufSigla)) {
    const request = Promise.all([
      ensureUfMetadataLoaded(),
      fetchJson(`${IBGE_LOCALIDADES_API}/estados/${ufSigla}/municipios`)
    ])
      .then(async ([ufMetadata, municipalities]) => {
        const ufMeta = ufMetadata.get(ufSigla);

        if (!ufMeta) {
          throw new Error(`UF não encontrada para ${ufSigla}.`);
        }

        const literacyResponse = await fetchJson(
          `${SIDRA_API}/t/${LITERACY_TABLE_ID}/n6/in%20n3%20${ufMeta.id}/p/${LITERACY_YEAR}?formato=json`
        );

        const municipalityCatalog = new Map();
        const municipalityRates = new Map();

        municipalities.forEach(municipality => {
          municipalityCatalog.set(normalizeLocationKey(municipality.nome), {
            id: String(municipality.id),
            nome: municipality.nome
          });
        });

        parseSidraRows(literacyResponse).forEach(row => {
          municipalityRates.set(text(row.D1C), parseLiteracyRate(row.V));
        });

        app.literacy.municipalityCatalogByUf.set(ufSigla, municipalityCatalog);
        app.literacy.municipalityRatesByUf.set(ufSigla, municipalityRates);
      })
      .finally(() => {
        app.literacy.pendingMunicipalityPromises.delete(ufSigla);
      });

    app.literacy.pendingMunicipalityPromises.set(ufSigla, request);
  }

  return app.literacy.pendingMunicipalityPromises.get(ufSigla);
}

function getUfDisplayName(uf) {
  const sigla = text(uf);
  const metadata = app.literacy.ufMetadata?.get(sigla);
  return metadata ? `${metadata.nome} (${sigla})` : sigla || "UF não selecionada";
}

function buildLiteracySnapshot(context = {}) {
  const regionName = text(context.region) || getRegionByUf(context.uf);
  const ufSigla = text(context.uf);
  const cityName = text(context.city);
  const ufMeta = app.literacy.ufMetadata?.get(ufSigla);
  const municipalityEntry = ufSigla && cityName
    ? app.literacy.municipalityCatalogByUf.get(ufSigla)?.get(normalizeLocationKey(cityName))
    : null;
  const municipalityRate = municipalityEntry
    ? app.literacy.municipalityRatesByUf.get(ufSigla)?.get(municipalityEntry.id) ?? null
    : null;

  return {
    sourceLabel: LITERACY_SOURCE_LABEL,
    brazilRate: app.literacy.brazilRate,
    regionName,
    regionRate: regionName ? app.literacy.regionRates?.get(regionName) ?? null : null,
    ufSigla,
    ufLabel: getUfDisplayName(ufSigla),
    ufRate: ufSigla ? app.literacy.stateRates?.get(ufSigla) ?? null : null,
    cityName,
    municipalityRate,
    municipalityFound: Boolean(municipalityEntry)
  };
}

function createLiteracyMetrics(snapshot, options = {}) {
  const isSchoolContext = Boolean(options.forSchool);

  return [
    {
      label: isSchoolContext ? "Município da escola" : "Município",
      value: snapshot.cityName ? formatLiteracyRate(snapshot.municipalityRate) : "- -",
      caption: snapshot.cityName
        ? (
          snapshot.municipalityFound
            ? snapshot.cityName
            : `${snapshot.cityName} • sem correspondência automática no IBGE`
        )
        : "Selecione um município para ver a taxa local."
    },
    {
      label: isSchoolContext ? "UF da escola" : "UF",
      value: snapshot.ufSigla ? formatLiteracyRate(snapshot.ufRate) : "- -",
      caption: snapshot.ufSigla ? snapshot.ufLabel : "Selecione uma UF."
    },
    {
      label: isSchoolContext ? "Região da escola" : "Região",
      value: snapshot.regionName ? formatLiteracyRate(snapshot.regionRate) : "- -",
      caption: snapshot.regionName ? snapshot.regionName : "Selecione uma região."
    },
    {
      label: "Brasil",
      value: formatLiteracyRate(snapshot.brazilRate),
      caption: `Taxa de alfabetização das pessoas de 15 anos ou mais • ${LITERACY_YEAR}`
    }
  ];
}

function buildIncomeSnapshot(context = {}) {
  const regionName = text(context.region) || getRegionByUf(context.uf);
  const ufSigla = text(context.uf);

  if (ufSigla) {
    return {
      sourceLabel: INCOME_SOURCE_LABEL,
      scopeType: "UF",
      scopeLabel: getUfDisplayName(ufSigla),
      value: app.income.stateValues?.get(ufSigla) ?? null
    };
  }

  if (regionName) {
    return {
      sourceLabel: INCOME_SOURCE_LABEL,
      scopeType: "Região",
      scopeLabel: regionName,
      value: app.income.regionValues?.get(regionName) ?? null
    };
  }

  return {
    sourceLabel: INCOME_SOURCE_LABEL,
    scopeType: "Brasil",
    scopeLabel: "Brasil",
    value: app.income.brazilValue
  };
}

function getEducationBarWidth(value) {
  const safeValue = isFiniteNumber(value) ? Math.max(0, Math.min(value, 100)) : 0;
  return `${safeValue.toFixed(1)}%`;
}

function compareEducationProfiles(a, b) {
  const aHighSchool = a.profile?.atLeastHighSchoolShare ?? -1;
  const bHighSchool = b.profile?.atLeastHighSchoolShare ?? -1;

  if (aHighSchool !== bHighSchool) {
    return bHighSchool - aHighSchool;
  }

  const aHigher = a.profile?.higherEducationShare ?? -1;
  const bHigher = b.profile?.higherEducationShare ?? -1;

  if (aHigher !== bHigher) {
    return bHigher - aHigher;
  }

  return text(a.label).localeCompare(text(b.label), "pt-BR");
}

function buildEducationDashboardSnapshot(context = {}) {
  const regionName = text(context.region) || getRegionByUf(context.uf);
  const ufSigla = text(context.uf);
  const cityName = text(context.city);

  if (ufSigla) {
    const selectedUfProfile = app.educationDashboard.stateProfiles?.get(ufSigla) ?? null;
    const selectedRegionProfile = regionName
      ? app.educationDashboard.regionProfiles?.get(regionName) ?? null
      : null;

    return {
      sourceLabel: EDUCATION_SOURCE_LABEL,
      scopeType: "UF",
      scopeLabel: getUfDisplayName(ufSigla),
      currentProfile: selectedUfProfile,
      comparisonTitle: cityName
        ? `Comparativo territorial a partir de ${cityName}`
        : `Comparativo territorial de ${getUfDisplayName(ufSigla)}`,
      comparisonNote: cityName
        ? `Município selecionado: ${cityName}. Para desigualdade educacional, o painel compara Brasil, região e UF.`
        : "O painel compara Brasil, região e UF com base na população de 25 anos ou mais.",
      comparisonRows: [
        app.educationDashboard.brazilProfile
          ? { key: "Brasil", label: "Brasil", profile: app.educationDashboard.brazilProfile }
          : null,
        selectedRegionProfile
          ? { key: regionName, label: regionName, profile: selectedRegionProfile }
          : null,
        selectedUfProfile
          ? {
            key: ufSigla,
            label: getUfDisplayName(ufSigla),
            profile: selectedUfProfile,
            isActive: true
          }
          : null
      ].filter(Boolean)
    };
  }

  if (regionName) {
    const comparisonRows = [...(app.educationDashboard.stateProfiles?.entries() ?? [])]
      .filter(([uf]) => getRegionByUf(uf) === regionName)
      .map(([uf, profile]) => ({
        key: uf,
        label: getUfDisplayName(uf),
        profile
      }))
      .sort(compareEducationProfiles);

    return {
      sourceLabel: EDUCATION_SOURCE_LABEL,
      scopeType: "Região",
      scopeLabel: regionName,
      currentProfile: app.educationDashboard.regionProfiles?.get(regionName) ?? null,
      comparisonTitle: `Comparativo entre UFs da região ${regionName}`,
      comparisonNote: "Os percentuais mostram a distribuição educacional das pessoas de 25 anos ou mais em cada estado da região.",
      comparisonRows
    };
  }

  return {
    sourceLabel: EDUCATION_SOURCE_LABEL,
    scopeType: "Brasil",
    scopeLabel: "Brasil",
    currentProfile: app.educationDashboard.brazilProfile,
    comparisonTitle: "Comparativo entre macrorregiões do Brasil",
    comparisonNote: "Os percentuais mostram a distribuição educacional das pessoas de 25 anos ou mais em cada grande região.",
    comparisonRows: FILTER_VALUE_ORDER.region
      .map(region => ({
        key: region,
        label: region,
        profile: app.educationDashboard.regionProfiles?.get(region) ?? null
      }))
      .filter(row => row.profile)
  };
}

function createEducationSummaryMetrics(snapshot) {
  const profile = snapshot.currentProfile;

  if (!profile) {
    return [
      { label: EDUCATION_LOW_SCHOOLING_LABEL, value: "Indisponível", caption: "Sem base disponível para o recorte atual." },
      { label: EDUCATION_PRIMARY_COMPLETE_LABEL, value: "Indisponível", caption: "Sem base disponível para o recorte atual." },
      { label: EDUCATION_SECONDARY_COMPLETE_LABEL, value: "Indisponível", caption: "Sem base disponível para o recorte atual." },
      { label: "Superior completo", value: "Indisponível", caption: "Sem base disponível para o recorte atual." },
      { label: "Anos médios de estudo", value: "Indisponível", caption: "Sem base disponível para o recorte atual." }
    ];
  }

  return [
    {
      label: EDUCATION_LOW_SCHOOLING_LABEL,
      value: formatEducationShare(profile.lowSchoolingShare),
      caption: `${formatEducationPeople(profile.lowSchoolingCount)} na categoria "sem instrução e fundamental incompleto" do IBGE.`
    },
    {
      label: EDUCATION_PRIMARY_COMPLETE_LABEL,
      value: formatEducationShare(profile.atLeastPrimaryCompleteShare),
      caption: `${formatEducationPeople(profile.atLeastPrimaryCompleteCount)} com pelo menos o ensino fundamental completo.`
    },
    {
      label: EDUCATION_SECONDARY_COMPLETE_LABEL,
      value: formatEducationShare(profile.atLeastHighSchoolShare),
      caption: `${formatEducationPeople(profile.atLeastHighSchoolCount)} com pelo menos o ensino médio completo.`
    },
    {
      label: "Superior completo",
      value: formatEducationShare(profile.higherEducationShare),
      caption: `${formatEducationPeople(profile.higherEducationCount)} com diploma superior completo.`
    },
    {
      label: "Anos médios de estudo",
      value: formatEducationYears(profile.averageYears),
      caption: `${snapshot.scopeType}: ${snapshot.scopeLabel}`
    }
  ];
}

function buildEducationComparisonMetric(label, value, tone, title) {
  return `
    <div class="education-compare__metric">
      <div class="education-compare__metric-head">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(formatEducationShare(value))}</strong>
      </div>
      <div class="education-compare__track" title="${escapeHtml(title)}">
        <span class="education-compare__fill education-compare__fill--${tone}" style="width: ${getEducationBarWidth(value)};"></span>
      </div>
    </div>
  `;
}

function buildEducationComparisonRow(row) {
  const profile = row.profile;

  if (!profile) {
    return "";
  }

  return `
    <article class="education-compare__row${row.isActive ? " is-active" : ""}">
      <div class="education-compare__row-top">
        <div>
          <strong class="education-compare__territory">${escapeHtml(row.label)}</strong>
          <p class="education-compare__base">Base considerada: ${escapeHtml(formatEducationPeople(profile.totalCount))} com 25 anos ou mais.</p>
        </div>
        <span class="education-compare__years">${escapeHtml(formatEducationYears(profile.averageYears))}</span>
      </div>
      ${buildEducationComparisonMetric(
        EDUCATION_LOW_SCHOOLING_LABEL,
        profile.lowSchoolingShare,
        "low-schooling",
        `${formatEducationPeopleExact(profile.lowSchoolingCount)} na categoria sem instrução e fundamental incompleto`
      )}
      ${buildEducationComparisonMetric(
        EDUCATION_PRIMARY_COMPLETE_LABEL,
        profile.atLeastPrimaryCompleteShare,
        "primary-complete",
        `${formatEducationPeopleExact(profile.atLeastPrimaryCompleteCount)} com pelo menos o ensino fundamental completo`
      )}
      ${buildEducationComparisonMetric(
        EDUCATION_SECONDARY_COMPLETE_LABEL,
        profile.atLeastHighSchoolShare,
        "secondary",
        `${formatEducationPeopleExact(profile.atLeastHighSchoolCount)} com pelo menos o ensino médio completo`
      )}
      ${buildEducationComparisonMetric(
        "Superior completo",
        profile.higherEducationShare,
        "higher",
        `${formatEducationPeopleExact(profile.higherEducationCount)} com superior completo`
      )}
    </article>
  `;
}

function renderEducationDashboardStatus(message) {
  if (els.educationDashboardStatus) {
    els.educationDashboardStatus.textContent = message;
  }
}

function renderEducationDashboardPopulationNote(message) {
  if (els.educationDashboardPopulationNote) {
    els.educationDashboardPopulationNote.textContent = message;
  }
}

function renderEducationDashboardLoading() {
  if (!els.educationDashboardSummary || !els.educationDashboardChart) {
    return;
  }

  els.educationDashboardSummary.innerHTML = renderLiteracyMetrics([
    { label: EDUCATION_LOW_SCHOOLING_LABEL, value: "Carregando...", caption: "Consultando o IBGE." },
    { label: EDUCATION_PRIMARY_COMPLETE_LABEL, value: "Carregando...", caption: "Consultando o IBGE." },
    { label: EDUCATION_SECONDARY_COMPLETE_LABEL, value: "Carregando...", caption: "Consultando o IBGE." },
    { label: "Superior completo", value: "Carregando...", caption: "Consultando o IBGE." },
    { label: "Anos médios de estudo", value: "Carregando...", caption: "Consultando o IBGE." }
  ]);

  if (els.educationDashboardChartTitle) {
    els.educationDashboardChartTitle.textContent = "Carregando comparativo...";
  }

  if (els.educationDashboardChartNote) {
    els.educationDashboardChartNote.textContent = "Consultando os recortes territoriais do IBGE.";
  }

  els.educationDashboardChart.innerHTML = `
    <div class="education-dashboard__empty">
      Carregando comparativos territoriais do IBGE...
    </div>
  `;

  if (els.educationDashboardSource) {
    els.educationDashboardSource.textContent = `Fonte prevista: ${EDUCATION_SOURCE_LABEL}`;
  }

  renderEducationDashboardPopulationNote("Base considerada: carregando população de 25 anos ou mais...");
  renderEducationDashboardStatus("Carregando indicadores do IBGE...");
}

function renderEducationDashboardError() {
  if (!els.educationDashboardSummary || !els.educationDashboardChart) {
    return;
  }

  els.educationDashboardSummary.innerHTML = renderLiteracyMetrics([
    { label: EDUCATION_LOW_SCHOOLING_LABEL, value: "Indisponível", caption: "Não foi possível consultar o IBGE agora." },
    { label: EDUCATION_PRIMARY_COMPLETE_LABEL, value: "Indisponível", caption: "Tente novamente em instantes." },
    { label: EDUCATION_SECONDARY_COMPLETE_LABEL, value: "Indisponível", caption: "Os indicadores não foram carregados." },
    { label: "Superior completo", value: "Indisponível", caption: "Os indicadores não foram carregados." },
    { label: "Anos médios de estudo", value: "Indisponível", caption: "Os indicadores não foram carregados." }
  ]);

  if (els.educationDashboardChartTitle) {
    els.educationDashboardChartTitle.textContent = "Comparativo indisponível";
  }

  if (els.educationDashboardChartNote) {
    els.educationDashboardChartNote.textContent = "Não foi possível carregar os recortes territoriais agora.";
  }

  els.educationDashboardChart.innerHTML = `
    <div class="education-dashboard__empty">
      Não foi possível carregar o dashboard de desigualdade educacional agora.
    </div>
  `;

  if (els.educationDashboardSource) {
    els.educationDashboardSource.textContent = `Fonte prevista: ${EDUCATION_SOURCE_LABEL}`;
  }

  renderEducationDashboardPopulationNote("Base considerada: indisponível no momento.");
  renderEducationDashboardStatus("Não foi possível carregar os indicadores do IBGE.");
}

function renderEducationDashboardFromSnapshot(snapshot) {
  if (!els.educationDashboardSummary || !els.educationDashboardChart) {
    return;
  }

  els.educationDashboardSummary.innerHTML = renderLiteracyMetrics(createEducationSummaryMetrics(snapshot));
  els.educationDashboardChart.innerHTML = snapshot.comparisonRows.length
    ? snapshot.comparisonRows.map(buildEducationComparisonRow).join("")
    : `
      <div class="education-dashboard__empty">
        Nenhum comparativo disponível para o recorte atual.
      </div>
    `;

  if (els.educationDashboardChartTitle) {
    els.educationDashboardChartTitle.textContent = snapshot.comparisonTitle;
  }

  if (els.educationDashboardChartNote) {
    els.educationDashboardChartNote.textContent =
      `${snapshot.comparisonNote} "${EDUCATION_LOW_SCHOOLING_LABEL}" corresponde a "sem instrução e fundamental incompleto" no IBGE.`;
  }

  if (els.educationDashboardSource) {
    els.educationDashboardSource.textContent =
      `Fonte: ${snapshot.sourceLabel}. Universo: pessoas de 25 anos ou mais.`;
  }

  renderEducationDashboardPopulationNote(
    `Base considerada: ${formatEducationPeople(snapshot.currentProfile?.totalCount)} de pessoas com 25 anos ou mais no recorte atual.`
  );
  renderEducationDashboardStatus(`Recorte principal: ${snapshot.scopeType} - ${snapshot.scopeLabel}`);
}

function renderLiteracyPanelStatus(message) {
  if (els.literacyPanelStatus) {
    els.literacyPanelStatus.textContent = message;
  }
}

function renderLiteracyPanelLoading() {
  if (!els.literacyPanelContent) {
    return;
  }

  els.literacyPanelContent.innerHTML = renderLiteracyMetrics([
    { label: "Município", value: "Carregando...", caption: "Consultando o IBGE." },
    { label: "UF", value: "Carregando...", caption: "Consultando o IBGE." },
    { label: "Região", value: "Carregando...", caption: "Consultando o IBGE." },
    { label: "Brasil", value: "Carregando...", caption: "Consultando o IBGE." }
  ]);
}

function renderLiteracyPanelFromSnapshot(snapshot) {
  if (!els.literacyPanelContent) {
    return;
  }

  els.literacyPanelContent.innerHTML = renderLiteracyMetrics(createLiteracyMetrics(snapshot));
  renderLiteracyPanelStatus(`Fonte: ${snapshot.sourceLabel}`);
}

function renderIncomeStatFromSnapshot(snapshot) {
  if (!els.incomeStatValue || !els.incomeStatScope) {
    return;
  }

  els.incomeStatValue.textContent = formatCurrency(snapshot.value);
  els.incomeStatScope.textContent = `${snapshot.scopeType}: ${snapshot.scopeLabel}`;
  els.incomeStatScope.title = `Fonte: ${snapshot.sourceLabel}`;
}

function renderLiteracyPanelError() {
  if (!els.literacyPanelContent) {
    return;
  }

  els.literacyPanelContent.innerHTML = renderLiteracyMetrics([
    { label: "Município", value: "Indisponível", caption: "Não foi possível consultar o IBGE agora." },
    { label: "UF", value: "Indisponível", caption: "Tente novamente em instantes." },
    { label: "Região", value: "Indisponível", caption: "Os indicadores não foram carregados." },
    { label: "Brasil", value: "Indisponível", caption: "Os indicadores não foram carregados." }
  ]);
  renderLiteracyPanelStatus("Não foi possível carregar os indicadores do IBGE.");
}

function renderIncomeStatLoading() {
  if (!els.incomeStatValue || !els.incomeStatScope) {
    return;
  }

  els.incomeStatValue.textContent = "Carregando...";
  els.incomeStatScope.textContent = "Consultando o IBGE...";
  els.incomeStatScope.title = `Fonte prevista: ${INCOME_SOURCE_LABEL}`;
}

function renderIncomeStatError() {
  if (!els.incomeStatValue || !els.incomeStatScope) {
    return;
  }

  els.incomeStatValue.textContent = "Indisponível";
  els.incomeStatScope.textContent = "Não foi possível carregar o indicador.";
  els.incomeStatScope.title = `Fonte prevista: ${INCOME_SOURCE_LABEL}`;
}

function getCurrentLiteracyContext() {
  return {
    region: getSelectedRegion(),
    uf: text(els.ufFilter.value),
    city: text(els.cityFilter.value)
  };
}

function getCurrentIncomeContext() {
  return {
    region: getSelectedRegion(),
    uf: text(els.ufFilter.value)
  };
}

function getCurrentEducationContext() {
  return {
    region: getSelectedRegion(),
    uf: text(els.ufFilter.value),
    city: text(els.cityFilter.value)
  };
}

async function updateLiteracyPanel() {
  const requestId = ++app.literacy.panelRequestId;
  const context = getCurrentLiteracyContext();

  renderLiteracyPanelLoading();
  renderLiteracyPanelStatus("Carregando indicadores do IBGE...");

  try {
    await ensureBaseLiteracyLoaded();

    if (context.uf && context.city) {
      await ensureMunicipalityLiteracyByUf(context.uf);
    }

    if (requestId !== app.literacy.panelRequestId) {
      return;
    }

    renderLiteracyPanelFromSnapshot(buildLiteracySnapshot(context));
  } catch (error) {
    console.error(error);

    if (requestId !== app.literacy.panelRequestId) {
      return;
    }

    renderLiteracyPanelError();
  }
}

async function updateIncomePanel() {
  const requestId = ++app.income.panelRequestId;
  const context = getCurrentIncomeContext();

  renderIncomeStatLoading();

  try {
    await ensureBaseIncomeLoaded();

    if (requestId !== app.income.panelRequestId) {
      return;
    }

    renderIncomeStatFromSnapshot(buildIncomeSnapshot(context));
  } catch (error) {
    console.error(error);

    if (requestId !== app.income.panelRequestId) {
      return;
    }

    renderIncomeStatError();
  }
}

async function updateEducationDashboard() {
  const requestId = ++app.educationDashboard.panelRequestId;
  const context = getCurrentEducationContext();

  renderEducationDashboardLoading();

  try {
    await ensureEducationDashboardLoaded();

    if (requestId !== app.educationDashboard.panelRequestId) {
      return;
    }

    renderEducationDashboardFromSnapshot(buildEducationDashboardSnapshot(context));
  } catch (error) {
    console.error(error);

    if (requestId !== app.educationDashboard.panelRequestId) {
      return;
    }

    renderEducationDashboardError();
  }
}

function getRowId(row) {
  return app.rawRows.indexOf(row);
}

function buildSchoolLocationLabel(row) {
  return [get(row, "city"), get(row, "uf"), getRegionByUf(get(row, "uf"))]
    .map(text)
    .filter(Boolean)
    .join(" • ");
}

function renderProfileField(label, value, options = {}) {
  const modifiers = [
    options.fullWidth ? "school-sheet__item--full" : "",
    text(options.className)
  ].filter(Boolean).join(" ");
  const modifier = modifiers ? ` ${modifiers}` : "";

  return `
    <div class="school-sheet__item${modifier}">
      <dt>${escapeHtml(label)}</dt>
      <dd>${renderValue(value, "Não informado")}</dd>
    </div>
  `;
}

function renderSchoolTags(row) {
  const tags = [
    get(row, "dependency"),
    get(row, "differentiatedLocation"),
    get(row, "councilRegulation")
  ].map(text).filter(Boolean);

  if (!tags.length) {
    return "";
  }

  return tags
    .map(tag => `<span class="pill school-sheet__tag">${escapeHtml(tag)}</span>`)
    .join("");
}

function renderSchoolLiteracyPlaceholder() {
  return `
    <div class="school-sheet__literacy-status">
      Carregando indicadores do IBGE...
    </div>
    <p class="school-sheet__literacy-source">Fonte: ${escapeHtml(LITERACY_SOURCE_LABEL)}</p>
  `;
}

function renderSchoolIncomePlaceholder() {
  return `
    <div class="school-sheet__literacy-status">
      Carregando indicador de renda do IBGE...
    </div>
    <p class="school-sheet__literacy-source">Fonte: ${escapeHtml(INCOME_SOURCE_LABEL)}</p>
  `;
}

function renderSchoolLiteracyMetrics(row, snapshot) {
  return `
    ${renderLiteracyMetrics(createLiteracyMetrics({
      ...snapshot,
      region: getRegionByUf(get(row, "uf")),
      uf: get(row, "uf"),
      city: get(row, "city")
    }, { forSchool: true }), { compact: true })}
    <p class="school-sheet__literacy-source">Fonte: ${escapeHtml(snapshot.sourceLabel)}</p>
  `;
}

function buildSchoolIncomeSnapshot(row) {
  const ufSigla = text(get(row, "uf"));
  const cityName = text(get(row, "city"));
  const municipalityEntry = ufSigla && cityName
    ? app.income.municipalityCatalogByUf.get(ufSigla)?.get(normalizeLocationKey(cityName))
    : null;
  const municipalityValue = municipalityEntry
    ? app.income.municipalityValuesByUf.get(ufSigla)?.get(municipalityEntry.id) ?? null
    : null;
  const brazilValue = app.income.brazilValue ?? null;
  const comparisonPercent =
    isFiniteNumber(municipalityValue) && isFiniteNumber(brazilValue) && brazilValue > 0
      ? ((municipalityValue - brazilValue) / brazilValue) * 100
      : null;

  return {
    sourceLabel: INCOME_SOURCE_LABEL,
    cityName,
    ufSigla,
    municipalityValue,
    brazilValue,
    comparisonPercent,
    municipalityFound: Boolean(municipalityEntry)
  };
}

function formatSignedPercent(value) {
  if (!isFiniteNumber(value)) {
    return "Não disponível";
  }

  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  const absoluteValue = Math.abs(value);

  return `${prefix}${absoluteValue.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  })}%`;
}

function renderSchoolIncomeMetrics(row, snapshot) {
  const cityLabel = [snapshot.cityName, snapshot.ufSigla].map(text).filter(Boolean).join(" • ");
  const comparisonDirection = isFiniteNumber(snapshot.comparisonPercent)
    ? (
      snapshot.comparisonPercent > 0
        ? "acima"
        : snapshot.comparisonPercent < 0
          ? "abaixo"
          : "no mesmo nível"
    )
    : "";

  return `
    ${renderLiteracyMetrics([
      {
        label: "Renda per capita municipal",
        value: formatCurrency(snapshot.municipalityValue),
        caption: snapshot.cityName
          ? (
            snapshot.municipalityFound
              ? `${cityLabel} • rendimento nominal médio mensal • ${INCOME_YEAR}`
              : `${cityLabel} • sem correspondência automática no IBGE`
          )
          : "Município da escola não informado na base local."
      },
      {
        label: "Município x Brasil",
        value: formatSignedPercent(snapshot.comparisonPercent),
        caption: isFiniteNumber(snapshot.comparisonPercent)
          ? (
            comparisonDirection === "no mesmo nível"
              ? `${cityLabel || "Município da escola"} está no mesmo nível da renda per capita do Brasil (${formatCurrency(snapshot.brazilValue)}).`
              : `${cityLabel || "Município da escola"} está ${comparisonDirection} da renda per capita do Brasil (${formatCurrency(snapshot.brazilValue)}).`
          )
          : "Comparativo indisponível para esta escola."
      }
    ], { compact: true })}
    <p class="school-sheet__literacy-source">Fonte: ${escapeHtml(snapshot.sourceLabel)}</p>
  `;
}

function renderSchoolEnrichmentPanel(row) {
  const entry = getSchoolEnrichment(row);

  if (!entry) {
    return renderSchoolEnrichmentUnavailable(row);
  }

  return renderSchoolEnrichment(entry, row);
}

function renderSectionSource(label) {
  return `<p class="school-sheet__section-source">Fonte: ${escapeHtml(label)}</p>`;
}

function renderDataSourceCard({ title, description, bullets = [], source, fullWidth = false }) {
  const listMarkup = bullets.length
    ? `
      <ul class="sources-sheet__list">
        ${bullets.map(item => `
          <li>
            <strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(item.copy)}
          </li>
        `).join("")}
      </ul>
    `
    : "";
  const modifier = fullWidth ? " sources-sheet__card--full" : "";

  return `
    <article class="sources-sheet__card${modifier}">
      <h5 class="sources-sheet__card-title">${escapeHtml(title)}</h5>
      <p class="sources-sheet__card-description">${escapeHtml(description)}</p>
      ${listMarkup}
      <p class="sources-sheet__card-source">Fonte: ${escapeHtml(source)}</p>
    </article>
  `;
}

function renderDataSourcesSheet() {
  const cards = [
    {
      title: "Base local do projeto",
      description: "É a base que sustenta a home, os filtros, os resultados e os dados principais da ficha de cada escola.",
      bullets: [
        {
          label: "Arquivo central",
          copy: "O arquivo escolas-rurais.json é o resultado do trabalho que fizemos em cima da planilha escolas-rurais-atualizadas, fornecida pelo professor Átila Barros."
        },
        {
          label: "Usado em",
          copy: "Filtros, contadores da home, tabela de resultados, identificação da escola, oferta educacional, endereço, telefone, coordenadas e minimapa."
        }
      ],
      source: "Planilha escolas-rurais-atualizadas • professor Átila Barros • processamento e estruturação do projeto",
      fullWidth: true
    },
    {
      title: "Hierarquia territorial",
      description: "Organiza a relação entre região, UF e município e ajuda a resolver os códigos oficiais usados nos cruzamentos com o IBGE.",
      bullets: [
        {
          label: "Usado em",
          copy: "Filtro dependente de região, filtro de UF, filtro de município e preparação dos cruzamentos territoriais."
        }
      ],
      source: "IBGE • API de Localidades"
    },
    {
      title: "Painel de alfabetização",
      description: "Mostra as taxas de alfabetização do Brasil, da região, da UF e do município selecionado.",
      bullets: [
        {
          label: "Usado em",
          copy: "Painel de alfabetização da home e bloco de alfabetização dentro da ficha da escola."
        }
      ],
      source: "IBGE • Censo Demográfico 2022 • Tabela 9543"
    },
    {
      title: "Renda per capita",
      description: "Apresenta o rendimento nominal médio mensal domiciliar per capita por território.",
      bullets: [
        {
          label: "Usado em",
          copy: "Card de renda per capita da home e contexto de renda dentro da ficha da escola."
        }
      ],
      source: "IBGE • Censo Demográfico 2022 • Tabela 10295"
    },
    {
      title: "Desigualdade educacional",
      description: "Compara escolaridade atingida e anos médios de estudo entre Brasil, macrorregiões e estados.",
      bullets: [
        {
          label: "Usado em",
          copy: "Dashboard Escolaridade por território, no fim da página."
        }
      ],
      source: "IBGE • Censo Demográfico 2022 • Tabelas 10061 e 10062"
    },
    {
      title: "Dados complementares por escola",
      description: "Amplia a ficha com matrículas por etapa e outros indicadores públicos de cada unidade escolar.",
      bullets: [
        {
          label: "Usado em",
          copy: "Matrículas por etapa e bloco de dados complementares dentro da ficha da escola."
        },
        {
          label: "Como entra no projeto",
          copy: "Os dados são sincronizados para um cache local que o projeto consome ao abrir a ficha da escola."
        }
      ],
      source: "Cultura Educa • Censo Escolar da Educação Básica 2020 • cache local por escola em school-enrichment-cache/"
    },
    {
      title: "Mapa e localização",
      description: "A posição mostrada no minimapa parte das coordenadas e do endereço cadastrados na base local do projeto.",
      bullets: [
        {
          label: "Usado em",
          copy: "Minimapa da ficha da escola e legenda de localização exibida abaixo do mapa."
        }
      ],
      source: "Base local do projeto + Google Maps"
    }
  ];

  return `
    <article class="school-sheet school-sheet--sources">
      <header class="school-sheet__header school-sheet__header--sources">
        <div class="school-sheet__intro">
          <p class="school-sheet__eyebrow">Fontes da base</p>
          <h3 class="school-sheet__title" id="sourcesModalTitle">Origem dos dados exibidos no projeto</h3>
          <p class="school-sheet__subtitle">
            Este painel resume de onde vem cada conjunto de dados usado nos filtros, nos indicadores da home e na ficha de cada escola.
          </p>
        </div>
      </header>

      <section class="school-sheet__section">
        <div class="school-sheet__section-head">
          <h4>Como a base foi montada</h4>
          <p>O projeto combina uma base local tratada por nós com dados oficiais do IBGE e com informações públicas complementares de cada escola.</p>
        </div>

        <div class="sources-sheet__callout">
          <strong>escolas-rurais.json</strong> é o resultado do trabalho que fizemos em cima da planilha
          <strong>escolas-rurais-atualizadas</strong>, fornecida pelo professor <strong>Átila Barros</strong>.
          Foi a partir dessa planilha que organizamos os campos, padronizamos filtros e estruturamos os dados que aparecem na home e na ficha das escolas.
        </div>
      </section>

      <section class="school-sheet__section">
        <div class="school-sheet__section-head">
          <h4>Mapa das fontes</h4>
          <p>Cada bloco abaixo mostra qual base alimenta cada parte da experiência.</p>
        </div>

        <div class="sources-sheet__grid">
          ${cards.map(renderDataSourceCard).join("")}
        </div>
      </section>
    </article>
  `;
}

function renderSchoolSheet(row) {
  const schoolName = text(get(row, "school")) || "Escola sem nome";
  const schoolLocation = buildSchoolLocationLabel(row) || "Localização não informada";
  const mapsEmbedUrl = buildMapsEmbedUrl(row);
  const mapCaption = text(get(row, "address")) || "Endereço não informado.";

  const identificationFields = [
    renderProfileField("Código INEP", get(row, "inep"), { className: "school-sheet__item--metric" }),
    renderProfileField("Região", getRegionByUf(get(row, "uf")), { className: "school-sheet__item--metric" }),
    renderProfileField("Município", get(row, "city"), { className: "school-sheet__item--metric" }),
    renderProfileField("UF", get(row, "uf"), { className: "school-sheet__item--metric" }),
    renderProfileField("Dependência administrativa", get(row, "dependency"), { className: "school-sheet__item--span-2" }),
    renderProfileField("Situação no conselho", get(row, "councilRegulation"), { className: "school-sheet__item--span-2" }),
    renderProfileField("Telefone", get(row, "phone"), { className: "school-sheet__item--span-2" }),
    renderProfileField("Coordenadas", buildCoordinateSummary(row), { className: "school-sheet__item--span-2" }),
    renderProfileField("Endereço", get(row, "address"), { fullWidth: true })
  ].join("");

  const educationFields = [
    renderProfileField("Restrição de atendimento", get(row, "restriction")),
    renderProfileField("Área", get(row, "differentiatedLocation")),
    renderProfileField("Porte", get(row, "schoolSize"), { fullWidth: true }),
    renderProfileField("Etapas e modalidades", get(row, "stages"), { fullWidth: true }),
    renderProfileField("Outras modalidades", get(row, "otherModalities"), { fullWidth: true })
  ].join("");

  return `
    <article class="school-sheet">
      <header class="school-sheet__header">
        <div class="school-sheet__intro">
          <p class="school-sheet__eyebrow">Ficha da escola</p>
          <div class="school-sheet__tags">${renderSchoolTags(row)}</div>
          <h3 class="school-sheet__title" id="schoolModalTitle">${escapeHtml(schoolName)}</h3>
          <p class="school-sheet__subtitle">${escapeHtml(schoolLocation)}</p>
        </div>
      </header>

      <div class="school-sheet__layout">
        <div class="school-sheet__content">
          <section class="school-sheet__section school-sheet__section--map">
            <div class="school-sheet__section-head">
              <h4>Localização</h4>
              <p>Minimapa gerado a partir das coordenadas e do endereço cadastrados na base.</p>
            </div>

            <div class="school-sheet__map-shell">
              ${mapsEmbedUrl
                ? `
                  <div class="school-sheet__map-frame">
                    <iframe
                      title="Mapa da escola ${escapeHtml(schoolName)}"
                      src="${mapsEmbedUrl}"
                      loading="eager"
                      allowfullscreen
                      referrerpolicy="no-referrer-when-downgrade"
                    ></iframe>
                  </div>
                `
                : `
                  <div class="school-sheet__map-empty">
                    Localização indisponível para esta escola.
                  </div>
                `}

              <div class="school-sheet__map-footer">
                <p class="school-sheet__map-caption">${escapeHtml(mapCaption)}</p>
                ${renderSectionSource(MAP_SOURCE_LABEL)}
              </div>
            </div>
          </section>

          <section class="school-sheet__section">
            <div class="school-sheet__section-head">
              <h4>Identificação</h4>
              <p>Dados principais para contato e localização da unidade.</p>
            </div>
            <dl class="school-sheet__grid school-sheet__grid--identification">${identificationFields}</dl>
            ${renderSectionSource(LOCAL_PROJECT_SOURCE_LABEL)}
          </section>

          <section class="school-sheet__section">
            <div class="school-sheet__section-head">
              <h4>Oferta educacional</h4>
              <p>Panorama da modalidade, porte e condições de atendimento.</p>
            </div>
            <dl class="school-sheet__grid school-sheet__grid--education">${educationFields}</dl>
            ${renderSectionSource(LOCAL_PROJECT_SOURCE_LABEL)}
          </section>

          <section class="school-sheet__section">
            <div class="school-sheet__section-head">
              <h4>Matrículas por etapa</h4>
              <p>Distribuição de alunos por etapa registrada na ficha pública da escola.</p>
            </div>
            <div data-school-enrollment-panel="${getRowId(row)}">
              ${renderSchoolEnrollmentLoading()}
            </div>
          </section>

          <section class="school-sheet__section">
            <div class="school-sheet__section-head">
              <h4>Contexto de renda</h4>
              <p>Renda per capita do município da escola, segundo o IBGE.</p>
            </div>
            <div data-school-income-panel="${getRowId(row)}">
              ${renderSchoolIncomePlaceholder()}
            </div>
          </section>

          <section class="school-sheet__section">
            <div class="school-sheet__section-head">
              <h4>Dados complementares da escola</h4>
              <p>Camada adicional preparada para sincronização local a partir de uma ficha pública com base no Censo Escolar.</p>
            </div>
            <div data-school-enrichment-panel="${getRowId(row)}">
              ${renderSchoolEnrichmentLoading()}
            </div>
          </section>

          <section class="school-sheet__section">
            <div class="school-sheet__section-head">
              <h4>Contexto de alfabetização</h4>
              <p>Taxas oficiais do município, da UF, da região e do Brasil.</p>
            </div>
            <div data-school-literacy-panel="${getRowId(row)}">
              ${renderSchoolLiteracyPlaceholder()}
            </div>
          </section>
        </div>
      </div>
    </article>
  `;
}

async function updateOpenSchoolModalEnrichment(rowId) {
  if (app.activeSchoolId !== rowId) {
    return;
  }

  const row = app.rawRows[rowId];
  const enrollmentContainer = els.schoolModalContent?.querySelector("[data-school-enrollment-panel]");
  const enrichmentContainer = els.schoolModalContent?.querySelector("[data-school-enrichment-panel]");

  if (!row || (!enrollmentContainer && !enrichmentContainer)) {
    return;
  }

  if (enrollmentContainer) {
    enrollmentContainer.innerHTML = renderSchoolEnrollmentLoading();
  }

  if (enrichmentContainer) {
    enrichmentContainer.innerHTML = renderSchoolEnrichmentLoading();
  }

  try {
    const inepCode = get(row, "inep");
    const entry = await ensureSchoolEnrichmentByInep(inepCode);

    if (!entry) {
      await ensureSchoolEnrichmentStatusByInep(inepCode, { force: true });
    }

    if (app.activeSchoolId !== rowId) {
      return;
    }

    const refreshedEnrollmentContainer = els.schoolModalContent?.querySelector("[data-school-enrollment-panel]");
    const refreshedContainer = els.schoolModalContent?.querySelector("[data-school-enrichment-panel]");

    if (refreshedEnrollmentContainer) {
      refreshedEnrollmentContainer.innerHTML = renderSchoolEnrollmentPanel(row);
    }

    if (!refreshedContainer) {
      return;
    }

    refreshedContainer.innerHTML = renderSchoolEnrichmentPanel(row);
  } catch (error) {
    console.error(error);

    if (app.activeSchoolId !== rowId) {
      return;
    }

    const refreshedEnrollmentContainer = els.schoolModalContent?.querySelector("[data-school-enrollment-panel]");
    const refreshedContainer = els.schoolModalContent?.querySelector("[data-school-enrichment-panel]");

    if (refreshedEnrollmentContainer) {
      refreshedEnrollmentContainer.innerHTML = renderSchoolEnrollmentUnavailable(row);
    }

    if (refreshedContainer) {
      refreshedContainer.innerHTML = renderSchoolEnrichmentUnavailable(row);
    }
  }

  // Se ainda não houver dados, tentamos novamente por alguns segundos enquanto o modal estiver aberto.
  const availability = getSchoolEnrichmentAvailability(row);

  if (availability.state === "pending") {
    const maxRetries = 20;
    const retryDelayMs = 1000;

    if (app.schoolEnrichment.retryCount < maxRetries && app.activeSchoolId === rowId) {
      app.schoolEnrichment.retryCount += 1;

      if (app.schoolEnrichment.retryTimerId) {
        window.clearTimeout(app.schoolEnrichment.retryTimerId);
      }

      app.schoolEnrichment.retryTimerId = window.setTimeout(() => {
        void updateOpenSchoolModalEnrichment(rowId);
      }, retryDelayMs);
    }
  }
}

async function updateOpenSchoolModalLiteracy(rowId) {
  if (app.activeSchoolId !== rowId) {
    return;
  }

  const row = app.rawRows[rowId];
  const literacyContainer = els.schoolModalContent?.querySelector("[data-school-literacy-panel]");

  if (!row || !literacyContainer) {
    return;
  }

  literacyContainer.innerHTML = renderSchoolLiteracyPlaceholder();

  try {
    await ensureBaseLiteracyLoaded();
    await ensureMunicipalityLiteracyByUf(get(row, "uf"));

    if (app.activeSchoolId !== rowId) {
      return;
    }

    const refreshedContainer = els.schoolModalContent?.querySelector("[data-school-literacy-panel]");

    if (!refreshedContainer) {
      return;
    }

    refreshedContainer.innerHTML = renderSchoolLiteracyMetrics(row, buildLiteracySnapshot({
      region: getRegionByUf(get(row, "uf")),
      uf: get(row, "uf"),
      city: get(row, "city")
    }));
  } catch (error) {
    console.error(error);

    if (app.activeSchoolId !== rowId) {
      return;
    }

    const refreshedContainer = els.schoolModalContent?.querySelector("[data-school-literacy-panel]");

    if (refreshedContainer) {
      refreshedContainer.innerHTML = `
        <div class="school-sheet__literacy-status">
          Não foi possível carregar os indicadores do IBGE agora.
        </div>
      `;
    }
  }
}

async function updateOpenSchoolModalIncome(rowId) {
  if (app.activeSchoolId !== rowId) {
    return;
  }

  const row = app.rawRows[rowId];
  const incomeContainer = els.schoolModalContent?.querySelector("[data-school-income-panel]");

  if (!row || !incomeContainer) {
    return;
  }

  incomeContainer.innerHTML = renderSchoolIncomePlaceholder();

  try {
    await ensureBaseIncomeLoaded();
    await ensureMunicipalityIncomeByUf(get(row, "uf"));

    if (app.activeSchoolId !== rowId) {
      return;
    }

    const refreshedContainer = els.schoolModalContent?.querySelector("[data-school-income-panel]");

    if (!refreshedContainer) {
      return;
    }

    refreshedContainer.innerHTML = renderSchoolIncomeMetrics(row, buildSchoolIncomeSnapshot(row));
  } catch (error) {
    console.error(error);

    if (app.activeSchoolId !== rowId) {
      return;
    }

    const refreshedContainer = els.schoolModalContent?.querySelector("[data-school-income-panel]");

    if (refreshedContainer) {
      refreshedContainer.innerHTML = `
        <div class="school-sheet__literacy-status">
          Não foi possível carregar o indicador de renda do IBGE agora.
        </div>
        <p class="school-sheet__literacy-source">Fonte: ${escapeHtml(INCOME_SOURCE_LABEL)}</p>
      `;
    }
  }
}

function syncModalBodyState() {
  const hasVisibleModal = [els.schoolModal, els.sourcesModal]
    .some(modal => modal?.classList.contains("is-visible"));

  document.body.classList.toggle("modal-open", hasVisibleModal);
}

function openSchoolModalById(rowId) {
  const row = app.rawRows[rowId];

  if (!row || !els.schoolModal || !els.schoolModalContent || !els.schoolModalPanel) {
    return;
  }

  if (!els.schoolModal.classList.contains("is-visible")) {
    app.lastFocusedElement = document.activeElement;
  }

  app.activeSchoolId = rowId;
  app.schoolEnrichment.retryCount = 0;
  if (app.schoolEnrichment.retryTimerId) {
    window.clearTimeout(app.schoolEnrichment.retryTimerId);
    app.schoolEnrichment.retryTimerId = 0;
  }
  els.schoolModalContent.innerHTML = renderSchoolSheet(row);
  els.schoolModal.classList.add("is-visible");
  els.schoolModal.setAttribute("aria-hidden", "false");
  syncModalBodyState();
  els.schoolModalPanel.focus();
  void updateOpenSchoolModalEnrichment(rowId);
  void updateOpenSchoolModalIncome(rowId);
  void updateOpenSchoolModalLiteracy(rowId);
}

function closeSchoolModal() {
  if (!els.schoolModal || !els.schoolModalContent) {
    return;
  }

  els.schoolModal.classList.remove("is-visible");
  els.schoolModal.setAttribute("aria-hidden", "true");
  els.schoolModalContent.innerHTML = "";
  syncModalBodyState();
  app.activeSchoolId = null;
  app.schoolEnrichment.retryCount = 0;
  if (app.schoolEnrichment.retryTimerId) {
    window.clearTimeout(app.schoolEnrichment.retryTimerId);
    app.schoolEnrichment.retryTimerId = 0;
  }

  if (app.lastFocusedElement && typeof app.lastFocusedElement.focus === "function") {
    app.lastFocusedElement.focus();
  }
}

function openSourcesModal() {
  if (!els.sourcesModal || !els.sourcesModalContent || !els.sourcesModalPanel) {
    return;
  }

  if (!els.sourcesModal.classList.contains("is-visible")) {
    app.lastSourcesFocusedElement = document.activeElement;
  }

  els.sourcesModalContent.innerHTML = renderDataSourcesSheet();
  els.sourcesModal.classList.add("is-visible");
  els.sourcesModal.setAttribute("aria-hidden", "false");
  syncModalBodyState();
  els.sourcesModalPanel.focus();
}

function closeSourcesModal() {
  if (!els.sourcesModal || !els.sourcesModalContent) {
    return;
  }

  els.sourcesModal.classList.remove("is-visible");
  els.sourcesModal.setAttribute("aria-hidden", "true");
  els.sourcesModalContent.innerHTML = "";
  syncModalBodyState();

  if (app.lastSourcesFocusedElement && typeof app.lastSourcesFocusedElement.focus === "function") {
    app.lastSourcesFocusedElement.focus();
  }
}

function handleTableInteractions(event) {
  const schoolRow = event.target.closest("tr[data-school-id]");

  if (!schoolRow) {
    return;
  }

  openSchoolModalById(Number(schoolRow.dataset.schoolId));
}

function handleSchoolModalClick(event) {
  const retryButton = event.target.closest("[data-retry-school-enrichment]");

  if (retryButton) {
    event.preventDefault();
    const rowId = Number(retryButton.dataset.retrySchoolEnrichment);

    if (Number.isInteger(rowId) && rowId >= 0) {
      void updateOpenSchoolModalEnrichment(rowId);
    }

    return;
  }

  if (!event.target.closest("[data-close-school-modal]")) {
    return;
  }

  closeSchoolModal();
}

function handleSourcesModalClick(event) {
  if (!event.target.closest("[data-close-sources-modal]")) {
    return;
  }

  closeSourcesModal();
}

function handleSourcesModalTrigger(event) {
  event.preventDefault();
  openSourcesModal();
}

function handleGlobalKeydown(event) {
  if (event.key !== "Escape") {
    return;
  }

  if (els.sourcesModal?.classList.contains("is-visible")) {
    closeSourcesModal();
    return;
  }

  if (els.schoolModal?.classList.contains("is-visible")) {
    closeSchoolModal();
  }
}

function uniqueSorted(values, preferredOrder = []) {
  const uniqueValues = [...new Set(values.map(text).filter(Boolean))];
  const orderIndex = new Map(
    preferredOrder.map((value, index) => [normalize(value), index])
  );

  return uniqueValues.sort((a, b) => {
    const aOrder = orderIndex.get(normalize(a));
    const bOrder = orderIndex.get(normalize(b));

    if (aOrder !== undefined && bOrder !== undefined) {
      return aOrder - bOrder;
    }

    if (aOrder !== undefined) {
      return -1;
    }

    if (bOrder !== undefined) {
      return 1;
    }

    return a.localeCompare(b, "pt-BR");
  });
}

function fillSelect(select, values, firstLabel) {
  const current = select.value;

  select.innerHTML =
    `<option value="">${escapeHtml(firstLabel)}</option>` +
    values.map(value => {
      const safeValue = text(value);
      return `<option value="${escapeHtml(safeValue)}">${escapeHtml(safeValue)}</option>`;
    }).join("");

  if (values.includes(current)) {
    select.value = current;
  }
}

function buildFilters() {
  FILTER_SELECTS.forEach(({ element, key, emptyLabel }) => {
    if (key === "uf" || key === "city") {
      return;
    }

    const values = uniqueSorted(
      app.rawRows.map(row => getFilterValue(row, key)),
      FILTER_VALUE_ORDER[key]
    );
    fillSelect(els[element], values, emptyLabel);
  });

  syncUfFilterOptions({ preserveSelection: false });
  syncCityFilterOptions({ preserveSelection: false });
}

function collectSelectedFilters() {
  return FILTER_SELECTS.reduce((filters, { element, key }) => {
    filters[key] = els[element].value;
    return filters;
  }, {});
}

function getPageCount() {
  return Math.max(1, Math.ceil(app.filteredRows.length / app.pageSize));
}

function clampPage(page) {
  return Math.min(Math.max(page, 1), getPageCount());
}

function getVisibleRows() {
  app.currentPage = clampPage(app.currentPage);

  const startIndex = (app.currentPage - 1) * app.pageSize;
  const endIndex = Math.min(startIndex + app.pageSize, app.filteredRows.length);

  return {
    startIndex,
    endIndex,
    rows: app.filteredRows.slice(startIndex, endIndex)
  };
}

function renderStats() {
  const selectedRegion = getSelectedRegion();

  els.statCount.textContent = app.filteredRows.length.toLocaleString("pt-BR");
  els.statRegiao.textContent = selectedRegion || "Todas";
  els.statUFs.textContent = uniqueSorted(app.filteredRows.map(row => get(row, "uf"))).length.toLocaleString("pt-BR");
  els.statCities.textContent = uniqueSorted(app.filteredRows.map(row => get(row, "city"))).length.toLocaleString("pt-BR");
  els.escolaPorRegiao.textContent = getClosedSchoolsLabel(selectedRegion);

  if (!app.rawRows.length) {
    els.resultSummary.textContent = "Carregando base local...";
    return;
  }

  if (!app.filteredRows.length) {
    els.resultSummary.textContent = "Nenhum registro encontrado com os filtros atuais.";
    return;
  }

  const { startIndex, endIndex } = getVisibleRows();
  const pageCount = getPageCount();
  const startLabel = (startIndex + 1).toLocaleString("pt-BR");
  const endLabel = endIndex.toLocaleString("pt-BR");

  els.resultSummary.textContent =
    `${app.filteredRows.length.toLocaleString("pt-BR")} registros encontrados. ` +
    `Exibindo ${startLabel}-${endLabel} na página ${app.currentPage} de ${pageCount}.`;
}

function renderPagination() {
  if (!app.filteredRows.length) {
    els.paginationWrap.innerHTML = "";
    if (els.paginationWrapBottom) {
      els.paginationWrapBottom.innerHTML = "";
    }
    return;
  }

  const pageCount = getPageCount();

  if (pageCount === 1) {
    els.paginationWrap.innerHTML = `<span class="page-chip">Página 1 de 1</span>`;
    if (els.paginationWrapBottom) {
      els.paginationWrapBottom.innerHTML = `<span class="page-chip">Página 1 de 1</span>`;
    }
    return;
  }

  const paginationHtml = `
    <button class="secondary" type="button" data-page="${app.currentPage - 1}" ${app.currentPage === 1 ? "disabled" : ""}>Anterior</button>
    <span class="page-chip">Página ${app.currentPage} de ${pageCount}</span>
    <button class="secondary" type="button" data-page="${app.currentPage + 1}" ${app.currentPage === pageCount ? "disabled" : ""}>Próxima</button>
  `;

  els.paginationWrap.innerHTML = paginationHtml;
  if (els.paginationWrapBottom) {
    els.paginationWrapBottom.innerHTML = paginationHtml;
  }
}

function renderTable() {
  if (!app.filteredRows.length) {
    setTableMessage("Nenhum registro encontrado com os filtros atuais.");
    renderPagination();
    return;
  }

  const { startIndex, endIndex, rows } = getVisibleRows();
  const startLabel = (startIndex + 1).toLocaleString("pt-BR");
  const endLabel = endIndex.toLocaleString("pt-BR");

  const tableHead = TABLE_COLUMNS
    .map(column => `<th class="${columnClassName(column.key)}">${column.headerHtml ?? escapeHtml(column.header)}</th>`)
    .join("");

  const tableBody = rows
    .map(row => `
      <tr class="school-row" data-school-id="${getRowId(row)}">
        ${TABLE_COLUMNS.map(column => {
          const cellHtml = column.render ? column.render(row) : renderValue(get(row, column.key));
          return `<td class="${columnClassName(column.key)}">${cellHtml}</td>`;
        }).join("")}
      </tr>
    `)
    .join("");

  els.tableWrap.className = "";
  els.tableWrap.innerHTML = `
    <div class="table-scroll">
      <table>
        <thead>
          <tr>${tableHead}</tr>
        </thead>
        <tbody>${tableBody}</tbody>
      </table>
    </div>
    <p class="footer-note">
      Mostrando ${rows.length.toLocaleString("pt-BR")} registros nesta página, do
      ${startLabel} ao ${endLabel} de ${app.filteredRows.length.toLocaleString("pt-BR")} filtrados.
    </p>
  `;

  renderPagination();
}

function refreshResults(options = {}) {
  const { resetPage = false } = options;

  if (resetPage) {
    app.currentPage = 1;
  }

  app.currentPage = clampPage(app.currentPage);
  renderStats();
  renderTable();
}

function matchesSearch(row, searchTerm) {
  if (!searchTerm) return true;

  return SEARCH_KEYS.some(key => normalize(get(row, key)).includes(searchTerm));
}

function matchesSelectFilters(row, selectedFilters) {
  return FILTER_SELECTS.every(({ key }) => {
    const selectedValue = selectedFilters[key];
    return !selectedValue || getFilterValue(row, key) === selectedValue;
  });
}

function updateHomePanelsDeferred(options = {}) {
  const delay = Number.isFinite(options.delay) ? Math.max(0, options.delay) : 0;

  if (deferredHomePanelsTimeoutId) {
    window.clearTimeout(deferredHomePanelsTimeoutId);
    deferredHomePanelsTimeoutId = 0;
  }

  const scheduleUpdate = () => {
    deferredHomePanelsTimeoutId = window.setTimeout(() => {
      deferredHomePanelsTimeoutId = 0;
      void updateLiteracyPanel();
      void updateIncomePanel();
      void updateEducationDashboard();
    }, delay);
  };

  if (typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(scheduleUpdate);
    return;
  }

  scheduleUpdate();
}

function applyFilters(options = {}) {
  const searchTerm = normalize(els.searchInput.value);
  const selectedFilters = collectSelectedFilters();

  app.filteredRows = app.rawRows.filter(row =>
    matchesSearch(row, searchTerm) && matchesSelectFilters(row, selectedFilters)
  );

  refreshResults(options);

  if (options.skipPanelUpdates) {
    return;
  }

  updateHomePanelsDeferred({
    delay: options.deferPanelUpdates ? 120 : 0
  });
}

function clearFilters() {
  els.searchInput.value = "";

  FILTER_SELECTS.forEach(({ element }) => {
    els[element].value = "";
  });

  hideCityFilterHint();
  syncUfFilterOptions({ preserveSelection: false });
  syncCityFilterOptions({ preserveSelection: false });
  applyFilters({ resetPage: true });
}

function countReplacementCharacters(value) {
  return (String(value ?? "").match(/\uFFFD/g) ?? []).length;
}

function parseJsonWithFallback(buffer) {
  if (!UTF8_TEXT_DECODER || !buffer) {
    return JSON.parse(String(buffer ?? ""));
  }

  const utf8Text = UTF8_TEXT_DECODER.decode(new Uint8Array(buffer));
  const utf8ReplacementCount = countReplacementCharacters(utf8Text);
  let utf8Parsed = null;

  try {
    utf8Parsed = JSON.parse(utf8Text);
  } catch (error) {
    utf8Parsed = null;
  }

  if (!utf8ReplacementCount && utf8Parsed) {
    return utf8Parsed;
  }

  if (!LATIN1_TEXT_DECODER) {
    if (utf8Parsed) {
      return utf8Parsed;
    }
    throw new Error("Não foi possível decodificar JSON.");
  }

  const latin1Text = LATIN1_TEXT_DECODER.decode(new Uint8Array(buffer));
  const latin1ReplacementCount = countReplacementCharacters(latin1Text);
  let latin1Parsed = null;

  try {
    latin1Parsed = JSON.parse(latin1Text);
  } catch (error) {
    latin1Parsed = null;
  }

  if (latin1Parsed && (latin1ReplacementCount < utf8ReplacementCount || !utf8Parsed)) {
    return latin1Parsed;
  }

  if (utf8Parsed) {
    return utf8Parsed;
  }

  if (latin1Parsed) {
    return latin1Parsed;
  }

  throw new Error("Não foi possível decodificar JSON.");
}

async function loadJsonWithFetch(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Falha HTTP ao carregar a base local: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  return parseJsonWithFallback(buffer);
}

function loadJsonWithXhr(url) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("GET", url, true);
    request.responseType = "arraybuffer";

    request.onload = function onLoad() {
      const isHttpSuccess = request.status >= 200 && request.status < 300;
      const isFileSuccess = request.status === 0 && request.responseText;

      if (!isHttpSuccess && !isFileSuccess) {
        reject(new Error(`Falha ao carregar a base local: ${request.status}`));
        return;
      }

      try {
        resolve(parseJsonWithFallback(request.response));
      } catch (error) {
        reject(error);
      }
    };

    request.onerror = function onError() {
      reject(new Error("Falha de rede ao carregar a base local."));
    };

    request.send();
  });
}

async function loadLocalData() {
  els.resultSummary.textContent = "Carregando base local...";
  setTableMessage("Carregando base local...");

  try {
    let rows;

    try {
      rows = await loadJsonWithFetch(DATA_URL);
    } catch (fetchError) {
      rows = await loadJsonWithXhr(DATA_URL);
    }

    if (!Array.isArray(rows) || !rows.length) {
      throw new Error("A base local está vazia.");
    }

    app.columns = detectColumns(Object.keys(rows[0]));
    app.rawRows = rows;
    buildFilters();
    applyFilters({ resetPage: true });
  } catch (error) {
    const fileHint = location.protocol === "file:"
      ? " Se você abriu o arquivo diretamente, tente servir a pasta com um servidor local simples."
      : "";
    const message = `Não foi possível carregar a base local.${fileHint}`;

    console.error(error);
    els.resultSummary.textContent = "Falha ao carregar a base local.";
    setTableMessage(message);
  els.paginationWrap.innerHTML = "";
  if (els.paginationWrapBottom) {
    els.paginationWrapBottom.innerHTML = "";
  }
  }
}

function debounce(callback, delay = 150) {
  let timeoutId = 0;

  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => callback(...args), delay);
  };
}

function handlePageNavigation(event) {
  const button = event.target.closest("button[data-page]");
  if (!button || button.disabled) return;

  app.currentPage = clampPage(Number(button.dataset.page));
  refreshResults();
}

function handleRegionFilterChange() {
  els.ufFilter.value = "";
  els.cityFilter.value = "";
  hideCityFilterHint();
  syncUfFilterOptions({ preserveSelection: false });
  syncCityFilterOptions({ preserveSelection: false });
  applyFilters({ resetPage: true });
}

function handleUfFilterChange() {
  const selectedUf = text(els.ufFilter.value);

  if (selectedUf) {
    els.regionFilter.value = getRegionByUf(selectedUf);
  }

  syncUfFilterOptions();
  syncCityFilterOptions({ preserveSelection: false });
  applyFilters({ resetPage: true });
}

function handleBlockedCityFilterInteraction(event) {
  if (text(els.ufFilter.value)) {
    return;
  }

  if (event.type === "keydown" && !["Enter", " ", "Spacebar", "ArrowDown", "ArrowUp"].includes(event.key)) {
    return;
  }

  event.preventDefault();
  showCityFilterHint();
}

function bindEvents() {
  const debouncedSearch = debounce(() => applyFilters({ resetPage: true }));

  els.clearBtn.addEventListener("click", clearFilters);
  els.searchInput.addEventListener("input", debouncedSearch);
  els.pageSizeFilter.addEventListener("change", () => {
    app.pageSize = Number(els.pageSizeFilter.value) || DEFAULT_PAGE_SIZE;
    applyFilters({ resetPage: true });
  });
els.paginationWrap.addEventListener("click", handlePageNavigation);
if (els.paginationWrapBottom) {
  els.paginationWrapBottom.addEventListener("click", handlePageNavigation);
}

  els.regionFilter.addEventListener("change", handleRegionFilterChange);
  els.ufFilter.addEventListener("change", handleUfFilterChange);
  els.cityFilter.addEventListener("change", () => applyFilters({ resetPage: true }));
  els.cityFilter.addEventListener("pointerdown", handleBlockedCityFilterInteraction);
  els.cityFilter.addEventListener("keydown", handleBlockedCityFilterInteraction);

  FILTER_SELECTS.filter(({ element }) => !["regionFilter", "ufFilter", "cityFilter"].includes(element)).forEach(({ element }) => {
    els[element].addEventListener("change", () => applyFilters({ resetPage: true }));
  });

  els.tableWrap.addEventListener("click", handleTableInteractions);
  els.openSourcesModal?.addEventListener("click", handleSourcesModalTrigger);
  els.schoolModal?.addEventListener("click", handleSchoolModalClick);
  els.sourcesModal?.addEventListener("click", handleSourcesModalClick);
  document.addEventListener("keydown", handleGlobalKeydown);
  syncCityFilterOptions({ preserveSelection: false });
}

bindEvents();
loadLocalData();

// Declara os estados e suas macrorregiões
const regioesPorUFLegacyBottom = {
    AC: "Norte",
    AL: "Nordeste",
    AP: "Norte",
    AM: "Norte",
    BA: "Nordeste",
    CE: "Nordeste",
    DF: "Centro-Oeste",
    ES: "Sudeste",
    GO: "Centro-Oeste",
    MA: "Nordeste",
    MT: "Centro-Oeste",
    MS: "Centro-Oeste",
    MG: "Sudeste",
    PA: "Norte",
    PB: "Nordeste",
    PR: "Sul",
    PE: "Nordeste",
    PI: "Nordeste",
    RJ: "Sudeste",
    RN: "Nordeste",
    RS: "Sul",
    RO: "Norte",
    RR: "Norte",
    SC: "Sul",
    SP: "Sudeste",
    SE: "Nordeste",
    TO: "Norte"
};

// Filtro macroregião
function exibirMacroregiaoLegacy() {
  const estadoSelecionado = ufFilter.value;
  
  if (!estadoSelecionado) {
    statRegiao.textContent = "Todas";
    return;
  }

  const regiao = regioesPorUF[estadoSelecionado];

  if (regiao) {
    statRegiao.textContent = `${regiao}`;
  } else {
    statRegiao.textContent = "Região não encontrada.";
  }
}

// dispara a função quando o usuário troca o estado
// Lógica legada substituída pelo fluxo principal de filtros.

const escolasFechadasLegacy = {
  Norte:	"475",
  Nordeste:	"555",
  Sul:	"240",
  "Centro-Oeste":	"160",
  Sudeste:	"155"

};

const escolaPorRegiaoLegacy = document.getElementById("escolaPorRegiao");

function escolasFechadasPorRegiaoLegacy() {
  const estadoSelecionado = ufFilter.value;

  if (!estadoSelecionado) {
    escolaPorRegiao.textContent = "1.585";
    return;
  }

  const regiao = regioesPorUF[estadoSelecionado];

  if (regiao) {
    const quantidade = escolasFechadas[regiao];
    escolaPorRegiao.textContent = quantidade;
  } else {
    escolaPorRegiao.textContent = "Região não encontrada.";
  }
};

// Lógica legada substituída pelo fluxo principal de filtros.
