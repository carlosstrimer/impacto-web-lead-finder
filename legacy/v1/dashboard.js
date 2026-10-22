// FILE: dashboard.js
import { db } from './modules/db.js';
import { Exporter } from './modules/exporter.js';
import { Scoring } from './modules/scoring.js';

let allLeads = [];
let filteredLeads = [];

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
  await loadLeads();
  await loadHistory();
  setupFilters();
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
  
  filteredLeads.sort((a, b) => b.score - a.score); // Ordena por score

  filteredLeads.forEach(lead => {
    const tr = document.createElement('tr');
    
    // Classes de Score
    const scoreClass = lead.score >= 70 ? 'score-high' : (lead.score >= 40 ? 'score-med' : 'score-low');
    
    tr.innerHTML = `
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
  await loadLeads();
};

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

window.copyApproach = (id) => {
  const lead = allLeads.find(l => l.place_id === id);
  if (!lead) return;
  const copy = Scoring.generateCopy(lead);
  navigator.clipboard.writeText(copy).then(() => {
    alert("Abordagem copiada para a área de transferência!");
  });
};

async function loadHistory() {
  const history = await db.getHistory();
  const tbody = document.getElementById('history-body');
  tbody.innerHTML = '';
  history.forEach(h => {
    tr = document.createElement('tr');
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