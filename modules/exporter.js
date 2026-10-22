// FILE: modules/exporter.js
export const Exporter = {
  download(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  },

  toCSV(leads) {
    const headers = [
      "Nome", "Telefone", "WhatsApp", "Instagram", "Facebook", "Site",
      "Presença", "Categoria", "Endereço", "Nota", "Avaliações", "Score",
      "Status", "Observação", "Maps", "Pesquisa de origem", "Data"
    ];
    
    const escape = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
    const lines = [headers.map(escape).join(";")];
    
    for (const l of leads) {
      lines.push([
        l.nome, l.telefone, l.whatsapp, l.instagram, l.facebook, l.siteInformado,
        l.presenca, l.categoria, l.endereco, l.nota, l.avaliacoes, l.score,
        l.status || "Novo", l.obs || "", l.linkGoogleMaps, l.queryOrigem, new Date(l.dataColeta).toLocaleDateString('pt-BR')
      ].map(escape).join(";"));
    }
    return "\uFEFF" + lines.join("\r\n");
  },

  toJSON(leads) {
    return JSON.stringify(leads, null, 2);
  }
};