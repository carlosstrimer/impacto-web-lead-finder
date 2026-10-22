// FILE: modules/scoring.js
export const Scoring = {
  calculate(lead) {
    let score = 0;
    
    // Presença digital
    if (lead.presenca === 'SEM_SITE') score += 30;
    else if (lead.presenca === 'SO_WHATSAPP') score += 25;
    else if (lead.presenca.includes('SO_')) score += 20;
    else if (lead.presenca === 'SITE_INDISPONIVEL') score += 25;
    else if (lead.presenca === 'COM_SITE') score -= 10; // Menos oportunidade

    // Nota e Avaliações
    if (lead.nota >= 4.5) score += 15;
    else if (lead.nota >= 4.0) score += 10;
    
    if (lead.avaliacoes >= 100) score += 20;
    else if (lead.avaliacoes >= 50) score += 10;

    // Contato
    if (lead.telefone && lead.telefone !== 'Não encontrado') score += 10;
    
    // Endereço
    if (lead.endereco && lead.endereco !== 'Não encontrado') score += 5;

    // Normaliza entre 0 e 100
    return Math.max(0, Math.min(100, score));
  },

  getLabel(score) {
    if (score >= 70) return 'Alto';
    if (score >= 40) return 'Médio';
    return 'Baixo';
  },

  generateCopy(lead, userName = "Consultor Impacto Web") {
    let obs = "";
    if (lead.presenca === 'SEM_SITE') {
      obs = `que possui ${lead.avaliacoes} avaliações e nota ${lead.nota}, mas não possui um site próprio`;
    } else if (lead.presenca === 'SO_WHATSAPP') {
      obs = `que utiliza apenas o WhatsApp como contato e possui nota ${lead.nota} no Google`;
    } else if (lead.presenca.includes('SO_')) {
      obs = `que usa apenas redes sociais como presença digital, mesmo com ${lead.avaliacoes} avaliações`;
    } else {
      obs = `que possui uma excelente reputação no Google (${lead.nota} estrelas)`;
    }

    return `Olá, equipe da ${lead.nome}, tudo bem?\n\n` +
           `Sou ${userName} e faço parte do time da Impacto Web.\n\n` +
           `Conhecemos a ${lead.nome} através do Google e chamou nossa atenção o fato de vocês terem ${obs}.\n\n` +
           `Analisando a presença digital de vocês, identificamos uma oportunidade de apresentar ainda melhor a empresa e facilitar o contato de potenciais clientes.\n\n` +
           `Nosso time pode preparar uma prévia personalizada mostrando como poderia ficar a presença digital da ${lead.nome}.\n\n` +
           `Posso te enviar para você dar uma olhada?`;
  }
};