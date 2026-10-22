// FILE: dashboard.js
import { db } from './modules/db.js';
import { Exporter } from './modules/exporter.js';
import { Scoring } from './modules/scoring.js';
import { XLSXExporter } from './modules/xlsx-exporter.js';

let allLeads = [];
let filteredLeads = [];
let selectedIds = new Set();

document.addEventListener('DOMContentLoaded', async () => {
  await loadLeads();
  await loadHistory();
  setupFilters();
  setupCheckboxes();
});

window.switchTab = (tabId) => {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  document.getElementById(`tab-${tabId}`).classList.add('active');
  document.querySelector(`nav button[onclick="switchTab('${tabId}')"]`).classList.add('active');
};

async function loadLeads() {
  allLeads = await db.getAllLeads();
  filteredLeads = [...allLeads];
  renderTable();
}

function renderTable() {
  const tbody = document.getElementById('leads-body');
  tbody.innerHTML = '';
  
  filteredLeads.sort((a, b) => b.score - a.score);

  filteredLeads.forEach(lead => {
    const tr = document.createElement('tr');
    const scoreClass = lead.score >= 70 ? 'score-high' : (lead.score >= 40 ? 'score-med' : 'score-low');
    const isChecked = selectedIds.has(lead.place_id) ? 'checked' : '';
    
    tr.innerHTML = `
      <td style="text-align: center;">
        <input type="checkbox" class="lead-checkbox" data-id="${lead.place_id}" ${isChecked}>
      </td>
      <td><strong>${lead.nome}</strong><br><small>${lead.endereco}</small></td>
      <td>${lead.categoria}</td>
      <td>${lead.telefone}</td>
      <td><span class="badge ${lead.presenca}">${lead.presenca.replace('_', ' ')}</span></td>
      <td>${lead.nota || '-'}</td>
      <td>${lead.avaliacoes || 0}</td>
      <td><span class="badge ${scoreClass}">${lead.score}</span></td>
      <td>${lead.status || 'Novo'}</td>
      <td class="actions-cell">
        <button onclick="window.open('${lead.linkGoogleMaps}', '_blank')">Maps</button>
        ${lead.whatsapp ? `<button onclick="window.open('https://wa.me/${lead.whatsapp.replace(/\D/g,'')}', '_blank')">WhatsApp</button>` : ''}
        <button onclick="copyApproach('${lead.place_id}')">Copy</button>
        <button onclick="openEditModal('${lead.place_id}')">Editar</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  updateSelectionCounts();
}

function setupFilters() {
  const search = document.getElementById('search');
  const fPresenca = document.getElementById('filter-presenca');
  const fScore = document.getElementById('filter-score');
  const fStatus = document.getElementById('filter-status');

  const apply = () => {
    const term = search.value.toLowerCase();
    const presenca = fPresenca.value;
    const score = parseInt(fScore.value) || 0;
    const status = fStatus.value;

    filteredLeads = allLeads.filter(l => {
      const matchTerm = l.nome.toLowerCase().includes(term) || l.categoria.toLowerCase().includes(term);
      const matchPresenca = presenca ? l.presenca === presenca : true;
      const matchScore = score ? l.score >= score : true;
      const matchStatus = status ? l.status === status : true;
      return matchTerm && matchPresenca && matchScore && matchStatus;
    });
    renderTable();
  };

  search.addEventListener('input', apply);
  fPresenca.addEventListener('change', apply);
  fScore.addEventListener('change', apply);
  fStatus.addEventListener('change', apply);
}

function setupCheckboxes() {
  document.getElementById('select-all').addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    document.querySelectorAll('.lead-checkbox').forEach(cb => {
      cb.checked = isChecked;
      const id = cb.getAttribute('data-id');
      if (isChecked) selectedIds.add(id);
      else selectedIds.delete(id);
    });
    updateSelectionCounts();
  });

  document.getElementById('leads-body').addEventListener('change', (e) => {
    if (e.target.classList.contains('lead-checkbox')) {
      const id = e.target.getAttribute('data-id');
      if (e.target.checked) selectedIds.add(id);
      else selectedIds.delete(id);
      updateSelectionCounts();
    }
  });
}

function updateSelectionCounts() {
  document.getElementById('count-all').textContent = allLeads.length;
  document.getElementById('count-filtered').textContent = filteredLeads.length;
  document.getElementById('count-selected').textContent = selectedIds.size;
}

window.openEditModal = (id) => {
  const lead = allLeads.find(l => l.place_id === id);
  if (!lead) return;
  document.getElementById('edit-id').value = id;
  document.getElementById('edit-status').value = lead.status || 'Novo';
  document.getElementById('edit-obs').value = lead.obs || '';
  document.getElementById('modal-lead').showModal();
};

window.saveLead = async () => {
  const id = document.getElementById('edit-id').value;
  const status = document.getElementById('edit-status').value;
  const obs = document.getElementById('edit-obs').value;
  
  await db.updateLead(id, { status, obs });
  await loadLeads(); // Recarrega e re-renderiza
};

window.openExportModal = () => {
  if (allLeads.length === 0) return alert("Nenhum lead para exportar.");
  updateSelectionCounts();
  document.getElementById('modal-export').showModal();
};

window.generateXLSX = async () => {
  const scope = document.querySelector('input[name="export-scope"]:checked').value;
  let leadsToExport = [];

  if (scope === 'all') leadsToExport = allLeads;
  else if (scope === 'filtered') leadsToExport = filteredLeads;
  else if (scope === 'selected') leadsToExport = allLeads.filter(l => selectedIds.has(l.place_id));

  if (leadsToExport.length === 0) {
    alert("Nenhum lead selecionado para exportar.");
    return;
  }

  const btn = document.getElementById('btn-generate-xlsx');
  const progressDiv = document.getElementById('export-progress');
  const progressText = document.getElementById('export-progress-text');
  
  btn.disabled = true;
  progressDiv.classList.remove('hidden');
  progressText.textContent = `Gerando planilha... 0 / ${leadsToExport.length} leads`;

  // Pequeno delay para permitir que a UI renderize o estado de carregamento
  setTimeout(async () => {
    try {
      // Simula progresso para grandes volumes (a biblioteca é síncrona)
      progressText.textContent = `Processando dados e aplicando estilos...`;
      
      const history = await db.getHistory(); // Pega o histórico para a terceira aba
      
      // Pega a query principal (se exportando todos, pega a do contexto ou genérica)
      const mainQuery = scope === 'all' ? "Varias Pesquisas" : (leadsToExport[0]?.queryOrigem || "Pesquisa Específica");

      await XLSXExporter.export(leadsToExport, {
        includeSummary: document.getElementById('chk-summary').checked,
        includeHistory: document.getElementById('chk-history').checked,
        includeLinks: document.getElementById('chk-links').checked
      }, {
        query: mainQuery,
        history: history
      });

      progressText.textContent = "Planilha gerada com sucesso!";
      setTimeout(() => {
        document.getElementById('modal-export').close();
        progressDiv.classList.add('hidden');
        btn.disabled = false;
      }, 1500);

    } catch (err) {
      console.error(err);
      alert("Erro ao gerar planilha: " + err.message);
      progressDiv.classList.add('hidden');
      btn.disabled = false;
    }
  }, 500);
};

window.copyApproach = (id) => {
  const lead = allLeads.find(l => l.place_id === id);
  if (!lead) return;
  const copy = Scoring.generateCopy(lead);
  navigator.clipboard.writeText(copy).then(() => {
    alert("Abordagem copiada para a área de transferência!");
  });
};

// Funções de exportação antigas (Mantidas como "Mais opções")
window.exportData = (type) => {
  if (filteredLeads.length === 0) return alert("Nenhum lead para exportar.");
  const date = new Date().toISOString().split('T')[0];
  const filename = `impacto-web-leads-${date}.${type}`;
  
  if (type === 'csv') {
    Exporter.download(Exporter.toCSV(filteredLeads), filename, "text/csv;charset=utf-8;");
  } else {
    Exporter.download(Exporter.toJSON(filteredLeads), filename, "application/json;charset=utf-8;");
  }
};

async function loadHistory() {
  const history = await db.getHistory();
  const tbody = document.getElementById('history-body');
  tbody.innerHTML = '';
  history.forEach(h => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${new Date(h.date).toLocaleString('pt-BR')}</td><td>${h.query}</td><td>${h.count}</td>`;
    tbody.appendChild(tr);
  });
}

window.clearDatabase = async () => {
  if(confirm("Tem certeza? Todos os leads serão apagados permanentemente.")) {
    const database = await db.init();
    const tx = database.transaction(['leads', 'history'], 'readwrite');
    tx.objectStore('leads').clear();
    tx.objectStore('history').clear();
    tx.oncomplete = () => {
      alert("Banco limpo.");
      loadLeads();
      loadHistory();
    };
  }
};