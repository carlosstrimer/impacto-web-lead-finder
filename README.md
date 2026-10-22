# Impacto Web Lead Finder

Ferramenta profissional de prospecção B2B no Google Maps, construída como extensão para Chromium (Chrome, Edge, Brave).

## Sobre
A extensão percorre resultados do Google Maps em busca de empresas com oportunidades de melhoria na presença digital (sem site, apenas WhatsApp, apenas redes sociais, etc.). Ela extrai os dados, calcula um Lead Score com base em regras de negócio e armazena tudo localmente, permitindo que o time comercial filtre, exporte e gere abordagens personalizadas sem depender de servidores externos.

## Recursos
- **Modos de Extração:** Defina um limite ou extraia "Até o fim dos resultados".
- **Sem Limite Artificial:** O código e a interface suportam milhares de leads.
- **Pausar e Continuar:** O progresso não é perdido se o popup fechar ou a máquina desligar.
- **Deduplicação Global:** O mesmo lead não é salvo duas vezes, mesmo que surja em buscas diferentes.
- **Banco Local (IndexedDB):** Armazena milhares de leads com performance.
- **Lead Score:** Pontuação transparente de 0 a 100 para priorizar os melhores leads.
- **Dashboard Completo:** Tabela com filtros, ordenação, status, observações e histórico de pesquisas.
- **Gerador de Abordagem:** Cria mensagens personalizadas com base nos dados reais do lead.
- **Exportação:** CSV (compatível com Excel PT-BR) e JSON.
- **Internacional:** Normalização de telefones para BR e US, não dependendo do idioma da página.

## Arquitetura
- `manifest.json`: Configurações da extensão (MV3).
- `background.js`: Service Worker. Gerencia a fila de buscas, abas e estado global.
- `content.js`: Scraper. Roda no Google Maps, interage com o DOM e coleta os dados.
- `popup.html/js/css`: Interface rápida para iniciar/pausar extrações.
- `dashboard.html/js/css`: Interface completa de gestão de leads (abre em uma aba).
- `modules/`: Lógica de negócio dividida (banco, score, exportação).

## Instalação
1. Baixe ou clone esta pasta (`impacto-web-lead-finder`).
2. Abra o navegador e vá em `chrome://extensions/` (ou `edge://extensions/`).
3. Ative o **Modo do desenvolvedor** no canto superior direito.
4. Clique em **Carregar sem compactação**.
5. Selecione a pasta `impacto-web-lead-finder`.

## Como usar
1. Clique no ícone da extensão no navegador.
2. Digite as pesquisas (ex: `barbearia em Goiânia`). Pode colocar uma por linha.
3. Escolha o limite ou "Até o fim".
4. Clique em **Iniciar**.
5. Acompanhe o progresso no popup.
6. Clique em **Abrir Dashboard Completo** para ver os leads, filtrar, editar status, gerar abordagens e exportar.

## Permissões
- `storage` / `unlimitedStorage`: Para salvar configurações e usar o IndexedDB para milhares de leads.
- `tabs` / `scripting` / `activeTab`: Para abrir o Google Maps e injetar o script de extração.
- `downloads`: Para salvar os arquivos CSV/JSON.
- `host_permissions`: Restrito aos domínios do Google Maps.

## Limitações Conhecidas
- **Mudanças no Google Maps:** Se o Google mudar os elementos HTML (`div[role="feed"]`, `div[role="main"]`), a extração pode falhar até que os seletores sejam atualizados em `content.js`.
- **Bloqueios (CAPTCHA):** Se o Google bloquear, a extensão pausa e exige ação manual. Não há bypass de segurança.
- **Validação de Site:** Devido a restrições de CORS em extensões, sites que demoram a responder ou bloqueiam requisições externas podem ser marcados como `INDETERMINADO`. Sites que derem timeout estourado (5s) serão marcados como `SITE_INDISPONIVEL`.