const DATA_URL = "escolas-rurais.json";
const DEFAULT_PAGE_SIZE = 10;
const EMPTY_CELL = "&mdash;";

const FILTER_SELECTS = [
  { element: "ufFilter", key: "uf", emptyLabel: "Todas" },
  { element: "cityFilter", key: "city", emptyLabel: "Todos" },
  { element: "differentiatedFilter", key: "differentiatedLocation", emptyLabel: "Todas as localidades" },
  { element: "dependencyFilter", key: "dependency", emptyLabel: "Todas" },
  { element: "councilFilter", key: "councilRegulation", emptyLabel: "Todas" },
  { element: "schoolSizeFilter", key: "schoolSize", emptyLabel: "Todos" },
  { element: "stageFilter", key: "stages", emptyLabel: "Todas" }
];

const FILTER_VALUE_ORDER = {
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
    render: row => `<strong class="school-name" title="${escapeHtml(text(get(row, "school")) || "Sem nome")}">${renderValue(get(row, "school"), "Sem nome")}</strong>`
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
    key: "address",
    header: "Endereço",
    exportHeader: "Endereço",
    render: row => renderAddressLink(row)
  },
  { key: "phone", header: "Telefone", exportHeader: "Telefone" },
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
  currentPage: 1
};

const els = {
  searchInput: document.getElementById("searchInput"),
  pageSizeFilter: document.getElementById("pageSizeFilter"),
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
  resultSummary: document.getElementById("resultSummary"),
  tableWrap: document.getElementById("tableWrap"),
  paginationWrap: document.getElementById("paginationWrap")
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

function text(value) {
  return String(value ?? "").trim();
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

function buildMapsSearchUrl(row) {
  const query = [get(row, "address"), get(row, "city"), get(row, "uf")]
    .map(text)
    .filter(Boolean)
    .join(", ");

  if (!query) return "";

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function renderAddressLink(row) {
  const address = text(get(row, "address"));
  const mapsUrl = buildMapsSearchUrl(row);

  if (!address || !mapsUrl) {
    return EMPTY_CELL;
  }

  return `<a class="address-link" href="${mapsUrl}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(address)}">${escapeHtml(address)}</a>`;
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
    const values = uniqueSorted(
      app.rawRows.map(row => get(row, key)),
      FILTER_VALUE_ORDER[key]
    );
    fillSelect(els[element], values, emptyLabel);
  });
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
  els.statCount.textContent = app.filteredRows.length.toLocaleString("pt-BR");
  els.statUFs.textContent = uniqueSorted(app.filteredRows.map(row => get(row, "uf"))).length.toLocaleString("pt-BR");
  els.statCities.textContent = uniqueSorted(app.filteredRows.map(row => get(row, "city"))).length.toLocaleString("pt-BR");

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
    return;
  }

  const pageCount = getPageCount();

  if (pageCount === 1) {
    els.paginationWrap.innerHTML = `<span class="page-chip">Página 1 de 1</span>`;
    return;
  }

  els.paginationWrap.innerHTML = `
    <button class="secondary" type="button" data-page="${app.currentPage - 1}" ${app.currentPage === 1 ? "disabled" : ""}>Anterior</button>
    <span class="page-chip">Página ${app.currentPage} de ${pageCount}</span>
    <button class="secondary" type="button" data-page="${app.currentPage + 1}" ${app.currentPage === pageCount ? "disabled" : ""}>Próxima</button>
  `;
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
      <tr>
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
    return !selectedValue || get(row, key) === selectedValue;
  });
}

function applyFilters(options = {}) {
  const searchTerm = normalize(els.searchInput.value);
  const selectedFilters = collectSelectedFilters();

  app.filteredRows = app.rawRows.filter(row =>
    matchesSearch(row, searchTerm) && matchesSelectFilters(row, selectedFilters)
  );

  refreshResults(options);
}

function clearFilters() {
  els.searchInput.value = "";

  FILTER_SELECTS.forEach(({ element }) => {
    els[element].value = "";
  });

  applyFilters({ resetPage: true });
}

async function loadJsonWithFetch(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Falha HTTP ao carregar a base local: ${response.status}`);
  }

  return response.json();
}

function loadJsonWithXhr(url) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("GET", url, true);

    request.onload = function onLoad() {
      const isHttpSuccess = request.status >= 200 && request.status < 300;
      const isFileSuccess = request.status === 0 && request.responseText;

      if (!isHttpSuccess && !isFileSuccess) {
        reject(new Error(`Falha ao carregar a base local: ${request.status}`));
        return;
      }

      try {
        resolve(JSON.parse(request.responseText));
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

function bindEvents() {
  const debouncedSearch = debounce(() => applyFilters({ resetPage: true }));

  els.clearBtn.addEventListener("click", clearFilters);
  els.searchInput.addEventListener("input", debouncedSearch);
  els.pageSizeFilter.addEventListener("change", () => {
    app.pageSize = Number(els.pageSizeFilter.value) || DEFAULT_PAGE_SIZE;
    applyFilters({ resetPage: true });
  });
  els.paginationWrap.addEventListener("click", handlePageNavigation);

  FILTER_SELECTS.forEach(({ element }) => {
    els[element].addEventListener("change", () => applyFilters({ resetPage: true }));
  });
}

bindEvents();
loadLocalData();

// Declara os estados e suas macrorregiões
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
    PI: "Nodeste",
    RJ: "Sudeste",
    RN: "Nordeste",
    RS: "Sul",
    RO: "Norte",
    RR: "Norte",
    SC: "Sul",
    SP: "São Paulo",
    SE: "Nordeste",
    TO: "Norte"
};

// Filtro macroregião
function exibirMacroregiao() {
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
ufFilter.addEventListener("change", exibirMacroregiao);

const escolasFechadas = {
  Norte:	"475",
  Nordeste:	"555",
  Sul:	"240",
  "Centro-Oeste":	"160",
  Sudeste:	"155"

};

const escolaPorRegiao = document.getElementById("escolaPorRegiao");

function escolasFechadasPorRegiao() {
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

ufFilter.addEventListener("change", escolasFechadasPorRegiao);