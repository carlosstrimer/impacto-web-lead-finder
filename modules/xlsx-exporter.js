// FILE: modules/xlsx-exporter.js
// Utiliza a biblioteca global XLSX (carregada via lib/xlsx.bundle.js)

export const XLSXExporter = {
  /**
   * Gera e faz o download do arquivo XLSX.
   * @param {Array} leads - Lista de leads para exportar.
   * @param {Object} options - Opções de exportação (incluir resumo, histórico, etc).
   * @param {Object} context - Contexto da exportação (query, date).
   */
  async export(leads, options, context) {
    if (!window.XLSX) {
      throw new Error("Biblioteca XLSX não carregada. Verifique a pasta lib/.");
    }

    const wb = XLSX.utils.book_new();
    
    // 1. Aba de Leads
    const wsLeads = this.buildLeadSheet(leads, options.includeLinks);
    XLSX.utils.book_append_sheet(wb, wsLeads, "Leads");

    // 2. Aba de Resumo
    if (options.includeSummary) {
      const wsSummary = this.buildSummarySheet(leads, context);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Resumo");
    }

    // 3. Aba de Pesquisas (Histórico)
    if (options.includeHistory) {
      const wsHistory = this.buildSearchHistorySheet(context.history || []);
      XLSX.utils.book_append_sheet(wb, wsHistory, "Pesquisas");
    }

    // Gerar nome do arquivo sanitizado
    const cleanQuery = (context.query || "geral").replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `impacto-web-leads-${cleanQuery}-${dateStr}.xlsx`;

    // Download
    XLSX.writeFile(wb, filename);
  },

  buildLeadSheet(leads, includeLinks) {
    const headers = [
      "Empresa", "Categoria", "Telefone", "WhatsApp", "Instagram", "Facebook", "TikTok",
      "Site", "Presença Digital", "Endereço", "Cidade", "Estado/Região", "País",
      "Nota", "Avaliações", "Lead Score", "Potencial", "Status", "Responsável",
      "Tags", "Observação", "Data do Contato", "Próximo Follow-up", "Pesquisa de Origem",
      "Data da Coleta", "Google Maps"
    ];

    const rows = [headers];

    leads.forEach(l => {
      // Formatação de links
      const cellLink = (url, label) => {
        if (!includeLinks || !url) return url || "";
        return { v: label, l: { Target: url }, t: 's' };
      };

      const wppLink = l.whatsapp ? `https://wa.me/${l.whatsapp.replace(/\D/g, '')}` : "";
      
      // Definindo Potencial
      let potencial = "Baixo";
      if (l.score >= 70) potencial = "Alto";
      else if (l.score >= 40) potencial = "Médio";

      rows.push([
        l.nome || "",
        l.categoria || "",
        { v: l.telefone || "", t: 's' }, // Força texto para não perder zeros
        l.whatsapp ? cellLink(wppLink, "Abrir WhatsApp") : "",
        l.instagram ? cellLink(l.instagram, "Abrir Instagram") : "",
        l.facebook ? cellLink(l.facebook, "Abrir Facebook") : "",
        "", // TikTok (não extraído no scraper atual)
        l.siteInformado ? cellLink(l.siteInformado, "Abrir Site") : "",
        l.presenca || "",
        l.endereco || "",
        "", // Cidade (não parseada diretamente ainda)
        "", // Estado
        "", // País
        { v: l.nota || 0, t: 'n' },
        { v: l.avaliacoes || 0, t: 'n' },
        { v: l.score || 0, t: 'n' },
        potencial,
        l.status || "Novo",
        l.responsavel || "",
        "", // Tags
        l.obs || "",
        l.dataContato ? new Date(l.dataContato) : "",
        l.proximoFollowUp ? new Date(l.proximoFollowUp) : "",
        l.queryOrigem || "",
        l.dataColeta ? new Date(l.dataColeta) : new Date(),
        cellLink(l.linkGoogleMaps, "Abrir Maps")
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Estilos e Configurações da Planilha
    const range = XLSX.utils.decode_range(ws['!ref']);
    
    // Largura das colunas
    ws['!cols'] = headers.map((_, i) => {
      if (i === 0 || i === 9 || i === 20) return { wch: 35 }; // Empresa, Endereço, Obs
      if (i === 24) return { wch: 20 }; // Data
      return { wch: 15 };
    });

    // Congelar primeira linha e Filtro Automático
    ws['!freeze'] = "A2";
    ws['!autofilter'] = { ref: `A1:Z1` };

    // Aplicar Estilos
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        let cell = ws[cellAddress];
        if (!cell) continue;

        // Estilo Cabeçalho
        if (R === 0) {
          cell.s = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "2563EB" } },
            alignment: { horizontal: "center", vertical: "center" }
          };
          continue;
        }

        // Estilos Específicos por Coluna
        if (C === 15) { // Score
          if (cell.v >= 70) cell.s = { fill: { fgColor: { rgb: "D1FAE5" } }, font: { bold: true, color: { rgb: "065F46" } } }; // Verde
          else if (cell.v >= 40) cell.s = { fill: { fgColor: { rgb: "FEF3C7" } }, font: { bold: true, color: { rgb: "92400E" } } }; // Amarelo
          else cell.s = { fill: { fgColor: { rgb: "F3F4F6" } }, color: { rgb: "4B5563" } }; // Cinza
        }
        
        if (C === 16) { // Potencial
          if (cell.v === "Alto") cell.s = { fill: { fgColor: { rgb: "D1FAE5" } }, font: { bold: true, color: { rgb: "065F46" } } };
          else if (cell.v === "Médio") cell.s = { fill: { fgColor: { rgb: "FEF3C7" } }, font: { bold: true, color: { rgb: "92400E" } } };
          else cell.s = { fill: { fgColor: { rgb: "F3F4F6" } }, color: { rgb: "4B5563" } };
        }
      }
    }
    return ws;
  },

  buildSummarySheet(leads, context) {
    const total = leads.length;
    const novos = leads.filter(l => l.status === "Novo").length;
    const semSite = leads.filter(l => l.presenca === "SEM_SITE").length;
    const soWhats = leads.filter(l => l.presenca === "SO_WHATSAPP").length;
    const soRedes = leads.filter(l => l.presenca.includes("SO_") && l.presenca !== "SO_WHATSAPP").length;
    const indisponivel = leads.filter(l => l.presenca === "SITE_INDISPONIVEL").length;
    const comSite = leads.filter(l => l.presenca === "COM_SITE").length;
    const scoreAlto = leads.filter(l => l.score >= 70).length;
    const scoreMedio = leads.filter(l => l.score >= 40 && l.score < 70).length;
    const scoreBaixo = leads.filter(l => l.score < 40).length;
    const clientes = leads.filter(l => l.status === "Cliente").length;

    const rows = [
      ["RESUMO DA EXPORTAÇÃO - IMPACTO WEB"],
      [],
      ["Pesquisa:", context.query || "Todas"],
      ["Data da exportação:", new Date().toLocaleString('pt-BR')],
      ["Responsável:", "Time Comercial Impacto Web"],
      [],
      ["Métrica", "Quantidade"],
      ["Total de leads", total],
      ["Leads novos", novos],
      ["Duplicados ignorados", context.duplicates || 0],
      [],
      ["Sem site", semSite],
      ["Só WhatsApp", soWhats],
      ["Só redes sociais", soRedes],
      ["Site indisponível", indisponivel],
      ["Com site", comSite],
      [],
      ["Score alto (+70)", scoreAlto],
      ["Score médio (40-69)", scoreMedio],
      ["Score baixo (0-39)", scoreBaixo],
      [],
      ["Clientes fechados", clientes]
    ];

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 25 }, { wch: 20 }];

    // Estilos do Resumo
    ws['A1'].s = { font: { bold: true, sz: 14, color: { rgb: "2563EB" } } };
    ws['A7'].s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "475569" } } };
    ws['B7'].s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "475569" } } };
    
    ws['A18'].s = { fill: { fgColor: { rgb: "D1FAE5" } }, font: { bold: true } };
    ws['A19'].s = { fill: { fgColor: { rgb: "FEF3C7" } }, font: { bold: true } };
    ws['A20'].s = { fill: { fgColor: { rgb: "F3F4F6" } }, font: { bold: true } };

    return ws;
  },

  buildSearchHistorySheet(history) {
    const rows = [["Consulta", "Data", "Leads Encontrados", "Novos", "Duplicados", "Oportunidades", "Duração", "Status"]];
    
    history.forEach(h => {
      rows.push([
        h.query,
        new Date(h.date).toLocaleString('pt-BR'),
        h.count,
        h.newCount || 0,
        h.duplicates || 0,
        h.opportunities || 0,
        h.duration || "-",
        h.status || "Concluído"
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 15 }, { wch: 10 }, { wch: 15 }];
    ws['!autofilter'] = { ref: "A1:H1" };
    
    // Cabeçalho
    for (let C = 0; C < 8; C++) {
      const cell = ws[XLSX.utils.encode_cell({ r: 0, c: C })];
      if (cell) cell.s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "475569" } } };
    }

    return ws;
  }
};