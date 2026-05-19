const express = require('express');
const cors    = require('cors');
const path    = require('path');
const app     = express();

app.use(cors());
app.use(express.json());

const SIGNAGE_TOKEN = process.env.SIGNAGE_TOKEN;
const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;

const SIGNAGE_URL         = 'https://app.gm7signage.com/graphql';
const CACHE_TTL_MS        = 60 * 60 * 1000; // 60 minutos — 1 fetch por hora
const MIN_MANUAL_MS       =  5 * 60 * 1000; // mínimo 5 min entre refreshes manuais
const ORGS_PER_PAGE       = 5;              // orgs por página (menor = menos nós por query)
const PLAYERS_PER_PAGE    = 100;            // players por página

// ─── Listas de referência ────────────────────────────────────────────────────
const SEGMENTOS_VALIDOS = [
  "ACAD","SHOP","PAD","EDF","BAR","HOTEL","Painel de LED","BEL","CAF","CLIN","CLUBE","ESP","RES","Terminal",
  "Academia","Shopping","Padaria","Edificio Comercial","Bar e Restaurante","Salão de Beleza","Cafeteria","Cafeterias",
  "Clinica","Esporte","Residencial","Edificio Residencial","Doceria","Construtora","Incorporadora","Imobiliaria",
  "Educação","Distribuidora","Serviços","Varejo - Mercado","Fast Food","Auto Peças","Transportadora","Varejo - Roupas",
  "Hospital","GM7 Interno","Laboratorio","Industria","Esportes","Alfaiataria","Varejo","Igreja","Entretenimento",
  "Farmacêutica","Tecnologia","Empreendimentos","Coworking","Outro: Concessionária","Arquitetura"
];
const TAGS_TECNICAS = [
  "PDM","DS","Hivestack","HORIZONTAL","VERTICAL","1280x720","720x1280","1080x1920","1920x1080","VIDEOWALL",
  "INTERNET_GM7","Em Manutenção","336x672","360x600","576x288","192x288","864x288","fci","engenharia","higienopolis",
  "biblioteca","praça de alimentação","joao calvino","portaria","auditório","Prédio 45","ccl","itacolomi","blackford",
  "colegio","buenos aires","regente feijo","video wall","Alameda 30 Lote 10-A","marketing","Aniversario","RECEPÇAO",
  "Copa","Restaurant","Elementary Pavilion","Upper School","Lounge","Staff","VEMPRAVELA","BARSEDE","VELEIRO",
  "#comunicados","refeitorio","paineiras","barao","tx","ANDRETTA","FAZZA","HMB","TAQUARAL","BARAO","MANSOES",
  "PLAYER PLUS","PLAYER MINI","MONITOR","TVC","direito","joão calvino","alimentacao","campinas","alphaville",
  "rio de janeiro","palmas","WIFI","Cinco"
];
const MAP_SEGMENTOS = {
  "ACAD":"Academia","ACADEMIA":"Academia","SHOP":"Shopping","SHOPPING":"Shopping",
  "PAD":"Padaria","PADARIA":"Padaria","EDF":"Edifício Comercial","EDIFICIO COMERCIAL":"Edifício Comercial",
  "BAR":"Bar e Restaurante","BAR E RESTAURANTE":"Bar e Restaurante","HOTEL":"Hotel",
  "BEL":"Salão de Beleza","SALÃO DE BELEZA":"Salão de Beleza","CAF":"Cafeteria",
  "CAFETERIA":"Cafeteria","CAFETERIAS":"Cafeteria","CLIN":"Clínica","CLINICA":"Clínica",
  "CLUBE":"Clube","ESP":"Esporte","ESPORTES":"Esporte","ESPORT":"Esporte",
  "RES":"Residencial","RESIDENCIAL":"Residencial","TERMINAL":"Terminal","PAINEL DE LED":"Painel de LED"
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

// ── Tabela de geocodificação por Cidade/UF ────────────────────────────────────
const CIDADES_BR = {
  "SAO PAULO-SP":[-23.5505,-46.6333],"CAMPINAS-SP":[-22.9056,-47.0608],
  "SANTOS-SP":[-23.9608,-46.3336],"SAO BERNARDO DO CAMPO-SP":[-23.6939,-46.5650],
  "GUARULHOS-SP":[-23.4538,-46.5333],"RIBEIRAO PRETO-SP":[-21.1775,-47.8103],
  "SOROCABA-SP":[-23.5015,-47.4526],"SAO JOSE DOS CAMPOS-SP":[-23.1794,-45.8869],
  "OSASCO-SP":[-23.5322,-46.7919],"SANTO ANDRE-SP":[-23.6639,-46.5383],
  "JUNDIAI-SP":[-23.1864,-46.8844],"PIRACICABA-SP":[-22.7253,-47.6492],
  "BAURU-SP":[-22.3246,-49.0706],"SAO JOSE DO RIO PRETO-SP":[-20.8197,-49.3794],
  "MOGI DAS CRUZES-SP":[-23.5228,-46.1875],"MARILIA-SP":[-22.2139,-49.9464],
  "PRESIDENTE PRUDENTE-SP":[-22.1256,-51.3886],"LIMEIRA-SP":[-22.5647,-47.4011],
  "FRANCA-SP":[-20.5386,-47.4008],"TAUBATE-SP":[-23.0197,-45.5558],
  "ARAÇATUBA-SP":[-21.2092,-50.4431],"ARACATUBA-SP":[-21.2092,-50.4431],
  "BARUERI-SP":[-23.5050,-46.8761],"CARAPICUIBA-SP":[-23.5228,-46.8353],
  "ITAQUAQUECETUBA-SP":[-23.4861,-46.3483],"SUMARE-SP":[-22.8219,-47.2681],
  "AMERICANA-SP":[-22.7375,-47.3328],"ALPHAVILLE-SP":[-23.4944,-46.8533],
  "COTIA-SP":[-23.6039,-46.9194],"INDAIATUBA-SP":[-23.0903,-47.2192],
  "VINHEDO-SP":[-23.0283,-46.9750],"VALINHOS-SP":[-22.9728,-46.9961],
  "PAULINIA-SP":[-22.7608,-47.1539],"HORTOLANDIA-SP":[-22.8581,-47.2197],
  "NOVA ODESSA-SP":[-22.7803,-47.2953],"SERTAOZINHO-SP":[-21.1378,-47.9908],
  "BRAGANCA PAULISTA-SP":[-22.9519,-46.5431],"ATIBAIA-SP":[-23.1178,-46.5508],
  "MOGI GUACU-SP":[-22.3728,-46.9428],"SAO CARLOS-SP":[-21.9774,-47.8908],
  "ARARAQUARA-SP":[-21.7942,-48.1758],"CATANDUVA-SP":[-21.1378,-48.9728],
  "VOTUPORANGA-SP":[-20.4228,-49.9728],"ARARAS-SP":[-22.3578,-47.3839],
  "RIO DE JANEIRO-RJ":[-22.9068,-43.1729],"NITEROI-RJ":[-22.8833,-43.1036],
  "SAO GONCALO-RJ":[-22.8272,-43.0539],"DUQUE DE CAXIAS-RJ":[-22.7858,-43.3117],
  "NOVA IGUACU-RJ":[-22.7556,-43.4511],"CAMPOS DOS GOYTACAZES-RJ":[-21.7628,-41.3239],
  "PETROPOLIS-RJ":[-22.5050,-43.1786],"VOLTA REDONDA-RJ":[-22.5231,-44.1039],
  "BARRA MANSA-RJ":[-22.5444,-44.1717],"ANGRA DOS REIS-RJ":[-23.0067,-44.3183],
  "CABO FRIO-RJ":[-22.8789,-42.0189],"MACAE-RJ":[-22.3711,-41.7869],
  "BELO HORIZONTE-MG":[-19.9167,-43.9345],"UBERLANDIA-MG":[-18.9186,-48.2772],
  "CONTAGEM-MG":[-19.9317,-44.0536],"JUIZ DE FORA-MG":[-21.7642,-43.3503],
  "BETIM-MG":[-19.9678,-44.1983],"MONTES CLAROS-MG":[-16.7281,-43.8617],
  "RIBEIRAO DAS NEVES-MG":[-19.7667,-44.0833],"UBERABA-MG":[-19.7478,-47.9322],
  "GOVERNADOR VALADARES-MG":[-18.8514,-41.9497],"IPATINGA-MG":[-19.4686,-42.5375],
  "SETE LAGOAS-MG":[-19.4678,-44.2469],"DIVINOPOLIS-MG":[-20.1392,-44.8836],
  "VARGINHA-MG":[-21.5514,-45.4306],"POCOS DE CALDAS-MG":[-21.7875,-46.5686],
  "PORTO ALEGRE-RS":[-30.0346,-51.2177],"CAXIAS DO SUL-RS":[-29.1678,-51.1794],
  "PELOTAS-RS":[-31.7719,-52.3428],"CANOAS-RS":[-29.9178,-51.1839],
  "SANTA MARIA-RS":[-29.6842,-53.8069],"NOVO HAMBURGO-RS":[-29.6728,-51.1306],
  "SAO LEOPOLDO-RS":[-29.7608,-51.1483],"RIO GRANDE-RS":[-32.0344,-52.0986],
  "PASSO FUNDO-RS":[-28.2628,-52.4069],"URUGUAIANA-RS":[-29.7544,-57.0883],
  "CURITIBA-PR":[-25.4297,-49.2719],"LONDRINA-PR":[-23.3103,-51.1628],
  "MARINGA-PR":[-23.4206,-51.9331],"PONTA GROSSA-PR":[-25.0917,-50.1619],
  "CASCAVEL-PR":[-24.9578,-53.4553],"SAO JOSE DOS PINHAIS-PR":[-25.5378,-49.2083],
  "FOZ DO IGUACU-PR":[-25.5478,-54.5881],"COLOMBO-PR":[-25.2928,-49.2244],
  "GUARAPUAVA-PR":[-25.3886,-51.4628],"TOLEDO-PR":[-24.7244,-53.7428],
  "APUCARANA-PR":[-23.5508,-51.4611],"UMUARAMA-PR":[-23.7658,-53.3211],
  "FLORIANOPOLIS-SC":[-27.5954,-48.5480],"JOINVILLE-SC":[-26.3044,-48.8456],
  "BLUMENAU-SC":[-26.9194,-49.0661],"SAO JOSE-SC":[-27.5950,-48.6189],
  "CHAPECO-SC":[-27.0897,-52.6158],"ITAJAI-SC":[-26.9078,-48.6619],
  "CRICIUMA-SC":[-28.6778,-49.3697],"LAGES-SC":[-27.8158,-50.3261],
  "BALNEARIO CAMBORIU-SC":[-26.9906,-48.6347],"BRUSQUE-SC":[-27.0972,-48.9158],
  "SALVADOR-BA":[-12.9714,-38.5014],"FEIRA DE SANTANA-BA":[-12.2564,-38.9669],
  "VITORIA DA CONQUISTA-BA":[-14.8661,-40.8444],"CAMACARI-BA":[-12.6978,-38.3236],
  "JUAZEIRO-BA":[-9.4178,-40.5028],"ILHEUS-BA":[-14.7889,-39.0328],
  "LAURO DE FREITAS-BA":[-12.8978,-38.3289],"ITABUNA-BA":[-14.7853,-39.2794],
  "GOIANIA-GO":[-16.6869,-49.2648],"APARECIDA DE GOIANIA-GO":[-16.8253,-49.2439],
  "ANAPOLIS-GO":[-16.3261,-48.9528],"TRINDADE-GO":[-16.6483,-49.4883],
  "SENADOR CANEDO-GO":[-16.7083,-49.0906],"CALDAS NOVAS-GO":[-17.7428,-48.6239],
  "BRASILIA-DF":[-15.7942,-47.8825],"BRASÍLIA-DF":[-15.7942,-47.8825],
  "FORTALEZA-CE":[-3.7172,-38.5433],"CAUCAIA-CE":[-3.7358,-38.6583],
  "JUAZEIRO DO NORTE-CE":[-7.2136,-39.3153],"MARACANAU-CE":[-3.8753,-38.6258],
  "SOBRAL-CE":[-3.6886,-40.3508],"RECIFE-PE":[-8.0578,-34.8829],
  "CARUARU-PE":[-8.2761,-35.9753],"PETROLINA-PE":[-9.3978,-40.5011],
  "OLINDA-PE":[-8.0089,-34.8553],"PAULISTA-PE":[-7.9419,-34.8725],
  "JABOATAO DOS GUARARAPES-PE":[-8.1128,-35.0139],
  "VITORIA-ES":[-20.3222,-40.3386],"VILA VELHA-ES":[-20.3297,-40.2922],
  "CARIACICA-ES":[-20.2639,-40.4097],"SERRA-ES":[-20.1214,-40.3069],
  "CACHOEIRO DE ITAPEMIRIM-ES":[-20.8483,-41.1133],
  "MANAUS-AM":[-3.1019,-60.0250],"PARINTINS-AM":[-2.6278,-56.7361],
  "BELEM-PA":[-1.4558,-48.4902],"ANANINDEUA-PA":[-1.3653,-48.3728],
  "SANTAREM-PA":[-2.4433,-54.7086],"MARABA-PA":[-5.3686,-49.1175],
  "SAO LUIS-MA":[-2.5297,-44.3028],"IMPERATRIZ-MA":[-5.5253,-47.4794],
  "TERESINA-PI":[-5.0892,-42.8019],"MACEIO-AL":[-9.6658,-35.7350],
  "ARACAJU-SE":[-10.9472,-37.0731],"NATAL-RN":[-5.7945,-35.2110],
  "MOSSORO-RN":[-5.1878,-37.3442],"PARNAMIRIM-RN":[-5.9156,-35.2628],
  "JOAO PESSOA-PB":[-7.1195,-34.8450],"CAMPINA GRANDE-PB":[-7.2306,-35.8811],
  "CUIABA-MT":[-15.5961,-56.0969],"VARZEA GRANDE-MT":[-15.6467,-56.1317],
  "RONDONOPOLIS-MT":[-16.4736,-54.6356],"SINOP-MT":[-11.8636,-55.5053],
  "CAMPO GRANDE-MS":[-20.4697,-54.6201],"DOURADOS-MS":[-22.2211,-54.8056],
  "PALMAS-TO":[-10.1689,-48.3317],"ARAGUAINA-TO":[-7.1928,-48.2053],
  "RIO BRANCO-AC":[-9.9742,-67.8100],"PORTO VELHO-RO":[-8.7619,-63.9006],
  "BOA VISTA-RR":[2.8197,-60.6733],"MACAPA-AP":[0.0356,-51.0706],
  // EUA
  "MIAMI-FL":[25.7617,-80.1918],"MIAMI-USA":[25.7617,-80.1918],"MIAMI-EUA":[25.7617,-80.1918],
  "NEW YORK-NY":[40.7128,-74.0060],"NEW YORK-USA":[40.7128,-74.0060],
  "LOS ANGELES-CA":[34.0522,-118.2437],"LOS ANGELES-USA":[34.0522,-118.2437],
  "CHICAGO-IL":[41.8781,-87.6298],"ORLANDO-FL":[28.5383,-81.3792],
  "HOUSTON-TX":[29.7604,-95.3698],"DALLAS-TX":[32.7767,-96.7970],
  "PHOENIX-AZ":[33.4484,-112.0740],"SAN FRANCISCO-CA":[37.7749,-122.4194],
  "BOSTON-MA":[42.3601,-71.0589],"ATLANTA-GA":[33.7490,-84.3880],
  "FORT LAUDERDALE-FL":[26.1224,-80.1373],"TAMPA-FL":[27.9506,-82.4572],
  "JACKSONVILLE-FL":[30.3322,-81.6557],"MIAMI BEACH-FL":[25.7907,-80.1300],
  "BOCA RATON-FL":[26.3683,-80.1289],"WEST PALM BEACH-FL":[26.7153,-80.0534],
  "DORAL-FL":[25.8196,-80.3554],"HIALEAH-FL":[25.8576,-80.2781],
  "POMPANO BEACH-FL":[26.2379,-80.1248],"CORAL GABLES-FL":[25.7215,-80.2684],
  "AVENTURA-FL":[25.9565,-80.1392],"WESTON-FL":[26.1004,-80.3997],
  "PEMBROKE PINES-FL":[26.0073,-86.1456],
  // Europa
  "LISBOA-PT":[38.7169,-9.1395],"PORTO-PT":[41.1496,-8.6109],
  "MADRID-ES":[40.4168,-3.7038],"BARCELONA-ES":[41.3851,2.1734],
  "PARIS-FR":[48.8566,2.3522],"LONDON-UK":[51.5074,-0.1278],
  "BERLIN-DE":[52.5200,13.4050],"ROME-IT":[41.9028,12.4964],
  "AMSTERDAM-NL":[52.3676,4.9041],"ZURICH-CH":[47.3769,8.5417],
  // América Latina
  "BUENOS AIRES-AR":[-34.6037,-58.3816],"SANTIAGO-CL":[-33.4489,-70.6693],
  "BOGOTA-CO":[4.7110,-74.0721],"LIMA-PE":[-12.0464,-77.0428],
  "CIUDAD DE MEXICO-MX":[19.4326,-99.1332],"MEXICO-MX":[19.4326,-99.1332],
  "MONTEVIDEO-UY":[-34.9011,-56.1915],"ASUNCION-PY":[-25.2867,-57.6470],
  "QUITO-EC":[-0.1807,-78.4678],"CARACAS-VE":[10.4806,-66.9036],
  "PANAMA-PA":[8.9936,-79.5197],"SAN JOSE-CR":[9.9281,-84.0907],
  // Ásia / Outros
  "DUBAI-UAE":[25.2048,55.2708],"TORONTO-CA":[43.6532,-79.3832],
  "SYDNEY-AU":[-33.8688,151.2093],"TOKYO-JP":[35.6762,139.6503],
  // Capitais fallback por UF
  "SP":[-23.5505,-46.6333],"RJ":[-22.9068,-43.1729],"MG":[-19.9167,-43.9345],
  "RS":[-30.0346,-51.2177],"PR":[-25.4297,-49.2719],"SC":[-27.5954,-48.5480],
  "BA":[-12.9714,-38.5014],"GO":[-16.6869,-49.2648],"DF":[-15.7942,-47.8825],
  "CE":[-3.7172,-38.5433],"PE":[-8.0578,-34.8829],"ES":[-20.3222,-40.3386],
  "AM":[-3.1019,-60.0250],"PA":[-1.4558,-48.4902],"MA":[-2.5297,-44.3028],
  "PI":[-5.0892,-42.8019],"AL":[-9.6658,-35.7350],"SE":[-10.9472,-37.0731],
  "RN":[-5.7945,-35.2110],"PB":[-7.1195,-34.8450],"MT":[-15.5961,-56.0969],
  "MS":[-20.4697,-54.6201],"TO":[-10.1689,-48.3317],"AC":[-9.9742,-67.8100],
  "RO":[-8.7619,-63.9006],"RR":[2.8197,-60.6733],"AP":[0.0356,-51.0706]
};

function normalizeStr(s) {
  return String(s||'').toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^A-Z0-9\-]/g,' ').replace(/\s+/g,' ').trim();
}

function geocodePorCidadeUF(cidadeUF) {
  if (!cidadeUF) return null;
  var key = normalizeStr(cidadeUF);
  if (CIDADES_BR[key]) return CIDADES_BR[key];
  // Tenta só UF
  var uf = key.split('-').pop().trim();
  if (uf && uf.length === 2 && CIDADES_BR[uf]) return CIDADES_BR[uf];
  return null;
}

function cleanStr(v) { return v == null ? '' : String(v).trim(); }

function getTipoByName(name) {
  if (!name) return 'Outro';
  const n = String(name).toUpperCase();
  if (n.includes('PDM'))                           return 'PDM';
  if (n.includes(' DS') || n.startsWith('DS'))     return 'DS';
  if (n.includes('AFILIADO') || n.includes(' AF') || n.startsWith('AF_') || n.startsWith('AF ')) return 'Afiliado';
  if (n.includes('GM7'))                           return 'GM7';
  return 'Outro';
}

function extrairInfoDasTags(tags) {
  let segmento = '', cidadeUF = '', bairro = '';
  const tecUp = TAGS_TECNICAS.map(s => s.toUpperCase());
  const segUp = SEGMENTOS_VALIDOS.map(s => s.toUpperCase());
  for (const raw of (tags || [])) {
    const tag = String(raw || '').trim();
    if (!tag) continue;
    const up = tag.toUpperCase();
    if (!cidadeUF && /^[\wçãéíóúâêôõ.\s-]+-[A-Z]{2}$/i.test(tag)) { cidadeUF = tag; continue; }
    if (!segmento && MAP_SEGMENTOS[up])   { segmento = MAP_SEGMENTOS[up]; continue; }
    if (!segmento && segUp.includes(up))  { segmento = tag; continue; }
    if (!bairro   && !tecUp.includes(up)) { bairro   = tag; continue; }
  }
  return { segmento, cidadeUF, bairro };
}

function extrairInfoAttrs(attrs, tags) {
  const a = (attrs && typeof attrs === 'object') ? attrs : {};
  const t = extrairInfoDasTags(tags);
  return {
    segmento: cleanStr(a['Segmento'])  || t.segmento || '',
    cidadeUF: cleanStr(a['Cidade-UF']) || t.cidadeUF || '',
    bairro:   cleanStr(a['Bairro'])    || t.bairro   || ''
  };
}

function processPlayer(p, org, now) {
  const lastSeen   = p.lastSeen   ? new Date(p.lastSeen)   : null;
  const lastSync   = p.lastSync   ? new Date(p.lastSync)   : null;
  const lastUpdate = p.lastUpdate ? new Date(p.lastUpdate) : null;
  const sub        = p.subscription || null;
  const endsOn     = sub?.endsOn ? new Date(sub.endsOn) : null;
  const { segmento, cidadeUF, bairro } = extrairInfoAttrs(p.attrs, p.tags);

  // GPS real do device
  const gpsLat = (p.location && p.location.latitude  != null) ? p.location.latitude  : null;
  const gpsLng = (p.location && p.location.longitude != null) ? p.location.longitude : null;

  // Fallback: geocodifica por Cidade/UF
  const geo    = (!gpsLat && cidadeUF) ? geocodePorCidadeUF(cidadeUF) : null;
  const lat    = gpsLat ?? (geo ? geo[0] : null);
  const lng    = gpsLng ?? (geo ? geo[1] : null);

  return {
    orgName:      org.name,
    orgActive:    org.isActive,
    tipo:         getTipoByName(org.name),
    playerName:   p.name,
    playerId:     p.id,
    isConnected:  p.isConnected,
    statusOnline: p.isConnected ? 'Online' : 'Offline',
    statusSync:   lastSync && (now - lastSync) / 36e5 <= 24 ? 'Atualizado' : 'Desatualizado',
    diasOffline:       lastSeen ? Math.floor((now - lastSeen) / 864e5) : null,
    diasDesatualizado: lastSync ? Math.floor((now - lastSync) / 864e5) : null,
    segmento, cidadeUF, bairro,
    lastUpdate:   lastUpdate?.toISOString() || null,
    licencaAtiva: sub ? (endsOn && endsOn < now ? 'Não Ativa' : 'Ativa') : 'Não Ativa',
    planName:     sub?.planName || null,
    tags:         p.tags || [],
    latitude:     lat,
    longitude:    lng,
    locationSource: gpsLat ? 'GPS' : (geo ? 'geocode' : null),
  };
}

// ─── GraphQL com campo rateLimit para monitorar consumo ──────────────────────
async function fetchGraphQL(query) {
  const res  = await fetch(SIGNAGE_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `token ${SIGNAGE_TOKEN}` },
    body:    JSON.stringify({ query })
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  if (json.data?.rateLimit) {
    const r = json.data.rateLimit;
    console.log(`[rateLimit] custo: ${r.cost} | restante: ${r.remaining}/${r.limit} | limitado: ${r.isLimited}`);
    if (r.isLimited) throw new Error('Rate limit atingido. Aguarde o reset.');
  }
  return json.data;
}

// ─── Cache ───────────────────────────────────────────────────────────────────
let cache = { players: null, fetchedAt: null, fetching: false };

async function fetchAllPlayers() {
  if (cache.fetching) return;
  cache.fetching = true;
  console.log(`[${new Date().toISOString()}] Iniciando fetch...`);

  try {
    const now    = new Date();
    const result = [];

    // ── Passo 1: buscar lista de orgs (apenas id + name + isActive, sem players) ──
    // Muito barato — sem nós de players aqui.
    const orgIds = [];
    let hasNextOrgs = true, afterOrgs = null;

    while (hasNextOrgs) {
      const afterStr = afterOrgs ? `, after: "${afterOrgs}"` : '';
      const query = `query {
        rateLimit { cost remaining limit isLimited }
        organizations(first: ${ORGS_PER_PAGE}${afterStr}) {
          edges { node { id name isActive } }
          pageInfo { endCursor hasNextPage }
        }
      }`;
      const data = await fetchGraphQL(query);
      data.organizations.edges.forEach(({ node }) => orgIds.push(node));
      hasNextOrgs = data.organizations.pageInfo.hasNextPage;
      afterOrgs   = hasNextOrgs ? data.organizations.pageInfo.endCursor : null;

      // Pequena pausa entre páginas para não estressar a API
      if (hasNextOrgs) await sleep(100);
    }

    console.log(`[${new Date().toISOString()}] ${orgIds.length} orgs encontradas. Buscando players...`);

    // ── Passo 2: buscar players org por org, com pausa entre elas ──
    // Isso distribui o custo ao longo do tempo em vez de fazer tudo de uma vez.
    for (const org of orgIds) {
      let hasNextPlayers = true, afterPlayers = null;

      while (hasNextPlayers) {
        const afterStr = afterPlayers ? `, after: "${afterPlayers}"` : '';

        // Query enxuta: só os campos realmente necessários
        const query = `query {
          rateLimit { cost remaining limit isLimited }
          organization {
            player(id: "${org.id}") { id }
          }
          organizations(ids: ["${org.id}"], first: 1) {
            edges { node {
              id name isActive
              players(first: ${PLAYERS_PER_PAGE}${afterStr}) {
                edges { node {
                  id name isConnected
                  lastSeen lastSync lastUpdate
                  tags attrs
                  location { latitude longitude source }
                  subscription { planName endsOn }
                }}
                pageInfo { endCursor hasNextPage }
              }
            }}
          }
        }`;

        let data;
        try {
          data = await fetchGraphQL(query);
        } catch (err) {
          // Se rate limit nessa org, para e guarda o que já tem
          if (err.message.includes('rate limit') || err.message.includes('Rate limit')) {
            console.warn(`[${new Date().toISOString()}] Rate limit atingido durante fetch. Salvando parcial.`);
            break;
          }
          throw err;
        }

        const orgNode = data.organizations?.edges?.[0]?.node;
        if (!orgNode) break;

        for (const { node: p } of orgNode.players.edges) {
          result.push(processPlayer(p, org, now));
        }

        hasNextPlayers = orgNode.players.pageInfo.hasNextPage;
        afterPlayers   = hasNextPlayers ? orgNode.players.pageInfo.endCursor : null;
        if (hasNextPlayers) await sleep(80);
      }

      // Pausa entre orgs para distribuir o custo
      await sleep(150);
    }

    cache.players   = result;
    cache.fetchedAt = now.toISOString();
    console.log(`[${new Date().toISOString()}] Cache atualizado: ${result.length} players.`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Erro:`, err.message);
    // mantém cache anterior se existir
  } finally {
    cache.fetching = false;
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Inicia fetch e agenda a cada 60 min
fetchAllPlayers();
setInterval(fetchAllPlayers, CACHE_TTL_MS);

// ─── Rotas ───────────────────────────────────────────────────────────────────
app.get('/players', (req, res) => {
  if (!SIGNAGE_TOKEN) return res.status(500).json({ error: 'SIGNAGE_TOKEN não configurado.' });
  if (!cache.players) return res.json({ players: [], fetchedAt: new Date().toISOString(), loading: true });
  res.json({ players: cache.players, fetchedAt: cache.fetchedAt });
});

app.post('/players/refresh', async (req, res) => {
  if (!SIGNAGE_TOKEN) return res.status(500).json({ error: 'SIGNAGE_TOKEN não configurado.' });
  const lastFetch   = cache.fetchedAt ? Date.now() - new Date(cache.fetchedAt).getTime() : Infinity;
  if (lastFetch < MIN_MANUAL_MS) {
    const wait = Math.ceil((MIN_MANUAL_MS - lastFetch) / 1000);
    return res.json({ cached: true, players: cache.players, fetchedAt: cache.fetchedAt, message: `Cache ainda válido. Próximo refresh em ${wait}s.` });
  }
  await fetchAllPlayers();
  res.json({ players: cache.players, fetchedAt: cache.fetchedAt });
});

// Diagnóstico: lista todos os players com GPS
app.get('/gps-check', (req, res) => {
  if (!cache.players) return res.json({ error: 'Cache ainda carregando' });
  const withGps    = cache.players.filter(p => p.latitude != null && p.longitude != null);
  const withoutGps = cache.players.filter(p => p.latitude == null);
  res.json({
    total:      cache.players.length,
    withGps:    withGps.length,
    withoutGps: withoutGps.length,
    players:    withGps.map(p => ({
      name:      p.playerName,
      org:       p.orgName,
      lat:       p.latitude,
      lng:       p.longitude,
      source:    p.locationSource,
      status:    p.statusOnline
    }))
  });
});

app.post('/ai', async (req, res) => {
  if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'ANTHROPIC_KEY não configurado.' });
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body:    JSON.stringify(req.body)
    });
    res.json(await r.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`GM7 Dashboard rodando na porta ${PORT}`));
