/* ================= CONSTANTS & HELPERS ================= */
var MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

function esc(s){
  return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function dateLong(iso){
  if(!iso) return '';
  var parts = iso.split('-').map(Number);
  var y = parts[0], m = parts[1], d = parts[2];
  if(!y || !m || !d) return '';
  return d + ' de ' + MESES[m-1] + ' de ' + y;
}
function dateShort(iso){
  if(!iso) return '';
  var parts = iso.split('-').map(Number);
  var y = parts[0], m = parts[1], d = parts[2];
  if(!y || !m || !d) return '';
  return String(d).padStart(2,'0') + '/' + String(m).padStart(2,'0') + '/' + y;
}
function addHoursToTime(hhmm, hoursToAdd){
  if(!hhmm) return '';
  var bits = hhmm.split(':').map(Number);
  var h = bits[0], m = bits[1];
  h = (h + hoursToAdd) % 24;
  return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
}
function formatDateTime(iso){
  try{
    var d = new Date(iso);
    return d.toLocaleString('pt-BR', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
  }catch(e){ return iso || ''; }
}
function formatBRL(v){
  var n = Number(v);
  if(isNaN(n)) return '';
  return 'R$ ' + n.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
}
function maskCEP(raw){
  var v = raw.replace(/\D/g,'').slice(0,8);
  if(v.length>5) return v.slice(0,5)+'-'+v.slice(5);
  return v;
}
function maskCPFCNPJ(raw){
  var v = raw.replace(/\D/g,'');
  if(v.length<=11){
    v = v.slice(0,11);
    v = v.replace(/(\d{3})(\d)/,'$1.$2');
    v = v.replace(/(\d{3})(\d)/,'$1.$2');
    v = v.replace(/(\d{3})(\d{1,2})$/,'$1-$2');
  } else {
    v = v.slice(0,14);
    v = v.replace(/(\d{2})(\d)/,'$1.$2');
    v = v.replace(/(\d{3})(\d)/,'$1.$2');
    v = v.replace(/(\d{3})(\d)/,'$1/$2');
    v = v.replace(/(\d{4})(\d{1,2})$/,'$1-$2');
  }
  return v;
}
function maskRG(raw){
  var v = raw.toUpperCase().replace(/[^0-9X]/g,'').slice(0,9);
  var p1 = v.slice(0,2), p2 = v.slice(2,5), p3 = v.slice(5,8), p4 = v.slice(8,9);
  var out = p1;
  if(p2) out += '.' + p2;
  if(p3) out += '.' + p3;
  if(p4) out += '-' + p4;
  return out;
}
var toastTimer = null;
function toast(msg){
  var el = document.getElementById('toast');
  el.innerHTML = '<span class="dot"></span>' + esc(msg);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){ el.classList.remove('show'); }, 3200);
}
function showScreen(id){
  document.querySelectorAll('.screen').forEach(function(s){ s.classList.remove('active'); });
  document.getElementById(id).classList.add('active');
  window.scrollTo(0,0);
}
function emptyLookup(msg){
  return '<div class="empty-state"><div class="em-icon">&#127915;</div><p>' + msg + '</p></div>';
}

/* ================= CONFIRM MODAL ================= */
var confirmCallback = null;
function showConfirm(msg, onConfirm, opts){
  opts = opts || {};
  document.getElementById('confirm-modal-title').textContent = opts.title || 'Confirmar exclusão';
  document.getElementById('confirm-modal-msg').textContent = msg;
  document.getElementById('confirm-modal-ok').textContent = opts.okLabel || 'Excluir';
  confirmCallback = onConfirm;
  document.getElementById('confirm-modal').classList.add('show');
}
function hideConfirm(){
  document.getElementById('confirm-modal').classList.remove('show');
  confirmCallback = null;
}

/* ================= API ================= */
// '/api' por padrão; se o front estiver separado do back, defina a URL completa na
// <meta name="api-base"> do index.html.
var API_BASE = (function(){
  var meta = document.querySelector('meta[name="api-base"]');
  var override = meta && meta.content && meta.content.trim();
  return override || '/api';
})();

function apiFetch(path, opts){
  opts = opts || {};
  opts.credentials = 'include';
  if(opts.body !== undefined){
    opts.headers = Object.assign({'Content-Type':'application/json'}, opts.headers||{});
  }
  return fetch(API_BASE + path, opts);
}

// Sempre resolve (nunca rejeita) — erros de rede viram {ok:false, status:0, data:null}.
async function apiJson(path, opts){
  try{
    var res = await apiFetch(path, opts);
    var data = null;
    try{ data = await res.json(); }catch(e){ data = null; }
    return {ok: res.ok, status: res.status, data: data};
  }catch(e){
    console.error('apiJson', path, e);
    return {ok:false, status:0, data:null};
  }
}

// Como apiJson, mas devolve pra tela de login se a sessão expirou (401).
async function adminApi(path, opts){
  var r = await apiJson(path, opts);
  if(r.status === 401){
    toast('Sessão expirada. Faça login novamente.');
    showAdminGate();
  }
  return r;
}

async function createContract(draft){
  var r = await apiJson('/contratos', {method:'POST', body: JSON.stringify(draft)});
  return r.ok ? r.data : null;
}
async function getContract(id){
  var r = await apiJson('/contratos/'+encodeURIComponent(id));
  return r.ok ? r.data : null;
}
async function downloadContractPDF(id){
  try{
    var res = await apiFetch('/contratos/'+encodeURIComponent(id)+'/pdf');
    if(!res.ok){ toast('Não foi possível gerar o PDF.'); return; }
    var blob = await res.blob();
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'contrato-'+id+'.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
  }catch(e){ console.error('downloadContractPDF', e); toast('Não foi possível gerar o PDF.'); }
}

/* ================= SIGNATURE PAD ================= */
function SignaturePad(canvas, placeholderEl){
  this.canvas = canvas;
  this.ctx = canvas.getContext('2d');
  this.placeholder = placeholderEl;
  this.drawing = false;
  this.hasInk = false;
  var self = this;
  var rect = canvas.getBoundingClientRect();
  var ratio = window.devicePixelRatio || 1;
  var w = rect.width || canvas.parentElement.clientWidth || 320;
  var h = rect.height || 170;
  canvas.width = w*ratio;
  canvas.height = h*ratio;
  this.ctx.scale(ratio,ratio);
  this.ctx.lineWidth = 2.4;
  this.ctx.lineCap = 'round';
  this.ctx.lineJoin = 'round';
  this.ctx.strokeStyle = '#E8482E';

  function pos(e){
    var r = canvas.getBoundingClientRect();
    var t = e.touches ? e.touches[0] : e;
    return {x: t.clientX-r.left, y: t.clientY-r.top};
  }
  function start(e){
    e.preventDefault();
    self.drawing = true;
    var p = pos(e);
    self.ctx.beginPath();
    self.ctx.moveTo(p.x,p.y);
    if(self.placeholder) self.placeholder.style.display='none';
  }
  function move(e){
    if(!self.drawing) return;
    e.preventDefault();
    var p = pos(e);
    self.ctx.lineTo(p.x,p.y);
    self.ctx.stroke();
    self.hasInk = true;
  }
  function end(){ self.drawing = false; }

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);
  canvas.addEventListener('touchstart', start, {passive:false});
  canvas.addEventListener('touchmove', move, {passive:false});
  canvas.addEventListener('touchend', end);
}
SignaturePad.prototype.clear = function(){
  this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
  this.hasInk = false;
  if(this.placeholder) this.placeholder.style.display='block';
};
SignaturePad.prototype.isEmpty = function(){ return !this.hasInk; };
SignaturePad.prototype.toDataURL = function(){ return this.canvas.toDataURL('image/png'); };

/* ================= CONTRACT TEXT ================= */
// Dados do contratado vêm de GET /api/config, não hardcoded. Fallback até a API responder:
var BUSINESS_INFO = {
  nomeArtista:'—', nomeEmpresa:'—', cnpj:'—', representante:'—',
  endRua:'—', endNumero:'—', endBairro:'—', endCep:'—', cidadeUf:'—',
  pix:'—', bancoConta:'—', bancoAgencia:'—', bancoNome:'—'
};
async function loadBusinessInfo(){
  var r = await apiJson('/config');
  if(r.ok && r.data) BUSINESS_INFO = r.data;
  if(BUSINESS_INFO.demoMode) showDemoBanner();
}

function showDemoBanner(){
  if(document.getElementById('demo-banner')) return;
  var el = document.createElement('div');
  el.id = 'demo-banner';
  el.setAttribute('role', 'status');
  el.style.cssText = 'position:sticky;top:0;z-index:9999;background:#B8341F;color:#fff;'
    + 'font-family:var(--font-mono, monospace);font-size:12.5px;text-align:center;'
    + 'padding:8px 14px;letter-spacing:0.02em;';
  el.textContent = '🔧 Ambiente de demonstração — dados fictícios, não preencha informações reais. O banco é reiniciado periodicamente.';
  document.body.insertBefore(el, document.body.firstChild);
}

function buildSections(c, mode){
  function V(val){
    var s = (val === undefined || val === null || val === '') ? '—' : val;
    return mode === 'html' ? ('<span class="fill">' + esc(s) + '</span>') : String(s);
  }
  function PEND(text){
    return mode === 'html' ? ('<span class="pending">' + esc(text) + '</span>') : text;
  }
  var biz = BUSINESS_INFO;
  var dLong = dateLong(c.evento.data);
  var dShort = dateShort(c.evento.data);
  var hIni = c.evento.hora;

  var sections = [];

  sections.push({heading:null, paragraphs:[
    'CONTRATANTE: ' + V(c.cliente.nome) + ', ' + V(c.cliente.nacionalidade) + ', ' + V(c.cliente.profissao) + ', com sede na ' + V(c.cliente.endRua) + ', nº ' + V(c.cliente.endNumero) + ', ' + V(c.cliente.endBairro) + ', ' + V(c.cliente.endCidade) + ', CEP ' + V(c.cliente.endCep) + '. CPF/CNPJ: ' + V(c.cliente.cpfCnpj) + '. RG: ' + V(c.cliente.rg) + '.',
    'CONTRATADO: ' + V(biz.nomeEmpresa) + ', inscrita no CNPJ sob o nº ' + V(biz.cnpj) + ', representada pelo titular ' + V(biz.representante) + ', domiciliado na ' + V(biz.endRua) + ', nº ' + V(biz.endNumero) + ', bairro ' + V(biz.endBairro) + ', CEP ' + V(biz.endCep) + ', ' + V(biz.cidadeUf) + '.',
    'As partes acima identificadas têm, entre si, justo e acertado o presente Contrato de Apresentação do Artista ' + V(biz.nomeArtista) + ', que se regerá pelas cláusulas seguintes e pelas condições descritas no presente.'
  ]});

  sections.push({heading:'Do objeto do contrato', paragraphs:[
    '1. Este contrato tem como objeto a apresentação do Artista ' + V(biz.nomeArtista) + ', neste ato representado pela empresa ' + V(biz.nomeEmpresa) + ', o CONTRATADO, ao público presente no endereço: ' + V(c.evento.localRua) + ', nº ' + V(c.evento.localNumero) + ', ' + V(c.evento.localBairro) + ', ' + V(c.evento.localCidade) + ', CEP ' + V(c.evento.localCep) + ', no dia ' + V(dLong || null) + ', às ' + V(hIni) + '. Informações fornecidas pelo CONTRATANTE.'
  ]});

  var durParagraphs = [];
  if(c.duracaoFinal && c.duracaoFinal.horaFim){
    var interText = c.duracaoFinal.temIntervalo
      ? ('com intervalo de ' + V(c.duracaoFinal.intervaloMin) + ' minutos no meio desse período')
      : 'sem intervalo, em apresentação contínua';
    durParagraphs.push('2. Início do evento às ' + V(hIni) + ' do dia ' + V(dShort || null) + ', com previsão de término às ' + V(c.duracaoFinal.horaFim) + ', ' + interText + '.');
  } else {
    durParagraphs.push('2. Início do evento às ' + V(hIni) + ' do dia ' + V(dShort || null) + '. ' + PEND('O horário previsto de término e a existência ou não de intervalo serão confirmados por Badu Produções antes da assinatura do CONTRATADO.'));
  }
  durParagraphs.push('3. Caso o artista ultrapasse o tempo estabelecido na cláusula anterior, será de sua inteira responsabilidade, não existindo acréscimo ao pagamento a ser efetuado pelo CONTRATADO. Porém, após o término da apresentação anunciado pelo artista, havendo desejo do CONTRATANTE e disponibilidade do CONTRATADO, será cobrado o adicional por hora de R$ 500,00 (quinhentos reais).');
  sections.push({heading:'Da duração do show', paragraphs: durParagraphs});

  sections.push({heading:'Do repertório', paragraphs:[
    '4. O repertório musical a ser apresentado no dia do show será escolhido a critério do CONTRATADO, ficando impossibilitado ao CONTRATANTE opor-se à escolha das músicas, podendo somente o CONTRATANTE dar sugestões sobre o repertório, sem vinculação de aceitação pelo CONTRATADO.'
  ]});

  sections.push({heading:'Dos equipamentos', paragraphs:[
    '5. O CONTRATADO fornecerá todo instrumento musical necessário à apresentação, comprometendo-se ao fornecimento da estrutura de som, iluminação e DJ. A CONTRATANTE compromete-se a garantir:',
    {list:[
      'Fornecimento de energia 110v ou 220v, próximo ao local do show;',
      'Local coberto para a realização e devida proteção dos equipamentos em caso de chuva.'
    ]}
  ]});

  sections.push({heading:'Das despesas', paragraphs:[
    '6. As despesas com alvarás são de responsabilidade exclusiva da CONTRATANTE.',
    '7. Diante da necessidade de viagem do artista CONTRATADO, as despesas com transporte e hospedagem ficam sob responsabilidade do CONTRATADO. As despesas de refeições durante a apresentação ficam por conta da CONTRATANTE.'
  ]});

  sections.push({heading:'Das condições', paragraphs:[
    '8. A CONTRATANTE compromete-se a oferecer policiamento ou segurança, palco e suprimento de energia elétrica condizentes com o equipamento, responsabilizando-se por qualquer risco que possa expor terceiros.',
    '9. Este contrato não é passível de transferência por nenhuma das partes a outra empresa ou clube.'
  ]});

  var payParagraphs = [];
  if(c.pagamento && c.pagamento.valorEntrada != null && c.pagamento.valorRestante != null){
    var total = Number(c.pagamento.valorEntrada) + Number(c.pagamento.valorRestante);
    payParagraphs.push('10. A CONTRATANTE se compromete a pagar a quantia total de ' + V(formatBRL(total)) + ' ao CONTRATADO em contraprestação à apresentação, sendo ' + V(formatBRL(c.pagamento.valorEntrada)) + ' de entrada e ' + V(formatBRL(c.pagamento.valorRestante)) + ' a serem pagos até a semana do show.');
  } else {
    payParagraphs.push('10. ' + PEND('O valor total do cachê, o valor de entrada e o saldo a pagar até a semana do show serão definidos por Badu Produções e confirmados nesta cláusula antes da assinatura do CONTRATADO.'));
  }
  payParagraphs.push('Dados para pagamento — PIX: ' + V(biz.pix) + ', ou Conta ' + V(biz.bancoConta) + ', Agência ' + V(biz.bancoAgencia) + ', Banco ' + V(biz.bancoNome) + ', titular ' + V(biz.representante) + '.');
  sections.push({heading:'Do pagamento', paragraphs: payParagraphs});

  sections.push({heading:'Vedações', paragraphs:[
    '11. O CONTRATADO se compromete a não utilizar técnica de apresentação que utilize pirotecnia (fogos de artifício, sinalizadores ou assemelhados), visando a máxima segurança do público.'
  ]});

  sections.push({heading:'Da rescisão', paragraphs:[
    '12. O presente contrato será rescindido caso uma das partes descumpra o pactuado nas cláusulas deste instrumento.',
    '13. Caso ocorra impedimento à realização da apresentação, ligado a caso fortuito ou força maior, as partes deverão pactuar outra data ou proceder à devolução dos valores e à reposição do que foi gasto nos preparativos.'
  ]});

  sections.push({heading:'Da multa', paragraphs:[
    '14. A parte que der causa à rescisão do presente instrumento pagará multa de 50% do valor do contrato.'
  ]});

  sections.push({heading:'Do foro', paragraphs:[
    '15. Para dirimir quaisquer controvérsias oriundas deste contrato, as partes elegem o foro da comarca de Itatiba - SP.'
  ]});

  sections.push({heading:null, paragraphs:[
    'Por estarem assim justos e contratados, firmam o presente instrumento de forma eletrônica, com data e hora do aceite de cada parte registradas abaixo.'
  ]});

  return sections;
}

function renderPaperHTML(c){
  var sections = buildSections(c, 'html');
  var html = '<div class="doc-title">Contrato de Apresentação — Badu Produções</div><div class="doc-sub">Artista: Badu Perrone · Itatiba – SP</div>';
  sections.forEach(function(sec){
    if(sec.heading) html += '<h3>' + esc(sec.heading) + '</h3>';
    sec.paragraphs.forEach(function(p){
      if(typeof p === 'string'){
        html += '<p>' + p + '</p>';
      } else if(p.list){
        p.list.forEach(function(li){ html += '<p class="list-item">' + esc(li) + '</p>'; });
      }
    });
  });
  return html;
}

/* ================= FORM STATE ================= */
function newDraft(){
  return {
    id:null, createdAt:null, status:'rascunho',
    cliente:{nome:'',nacionalidade:'Brasileira',profissao:'',rg:'',cpfCnpj:'',endRua:'',endNumero:'',endBairro:'',endCidade:'',endCep:''},
    evento:{localRua:'',localNumero:'',localBairro:'',localCidade:'',localCep:'',data:'',hora:'20:00'},
    duracaoFinal:null,
    pagamento:null,
    assinaturaCliente:null, assinaturaClienteEm:null,
    assinaturaBadu:null, assinaturaBaduEm:null
  };
}
var draft = newDraft();
var currentStep = 1;
var clientPad = null;
var baduPad = null;
var currentAdminContract = null;

var STEP_FIELDS = {
  1:[['f-nome','cliente','nome'],['f-nacionalidade','cliente','nacionalidade'],['f-profissao','cliente','profissao'],['f-rg','cliente','rg'],['f-cpfcnpj','cliente','cpfCnpj']],
  2:[['f-endRua','cliente','endRua'],['f-endNumero','cliente','endNumero'],['f-endBairro','cliente','endBairro'],['f-endCidade','cliente','endCidade'],['f-endCep','cliente','endCep']],
  3:[['f-localRua','evento','localRua'],['f-localNumero','evento','localNumero'],['f-localBairro','evento','localBairro'],['f-localCidade','evento','localCidade'],['f-localCep','evento','localCep'],['f-data','evento','data'],['f-hora','evento','hora']]
};

function validateStep(step){
  var fields = STEP_FIELDS[step];
  if(!fields) return true;
  var ok = true;
  fields.forEach(function(f){
    var id=f[0], group=f[1], key=f[2];
    var el = document.getElementById(id);
    var wrap = el.closest('.field');
    var val = el.value.trim();
    if(!val){ wrap.classList.add('err'); ok=false; }
    else{ wrap.classList.remove('err'); draft[group][key]=val; }
  });
  return ok;
}

function renderContractPreview(){
  document.getElementById('contract-preview').innerHTML = renderPaperHTML(draft);
}

function ensureClientPad(){
  if(!clientPad){
    clientPad = new SignaturePad(document.getElementById('sign-canvas-client'), document.getElementById('sign-placeholder-client'));
  }
}

function goStep(step){
  document.querySelectorAll('.form-step').forEach(function(p){
    p.style.display = (Number(p.dataset.step)===step) ? 'block' : 'none';
  });
  document.querySelectorAll('#stepbar .step').forEach(function(s){
    var n = Number(s.dataset.step);
    s.classList.toggle('current', n===step);
    s.classList.toggle('done', n<step);
  });
  currentStep = step;
  if(step===4){ renderContractPreview(); }
  if(step===5){ requestAnimationFrame(ensureClientPad); }
  var shell = document.querySelector('#screen-form .app-shell');
  if(shell) shell.scrollIntoView({behavior:'smooth', block:'start'});
}

function resetFormFields(){
  document.querySelectorAll('#screen-form input').forEach(function(i){
    if(i.type==='checkbox'){ i.checked=false; }
    else if(i.id==='f-nacionalidade'){ i.value='Brasileira'; }
    else if(i.id==='f-hora'){ i.value='20:00'; }
    else{ i.value=''; }
  });
  document.querySelectorAll('#screen-form .field').forEach(function(f){ f.classList.remove('err'); });
  document.getElementById('btn-submit-client').disabled = true;
  if(clientPad) clientPad.clear();
}

/* ================= VOUCHER / LOOKUP RENDER ================= */
function showVoucher(c){
  var box = document.getElementById('voucher-box');
  var isFinal = c.status === 'finalizado';
  box.innerHTML =
    '<div class="voucher-top">' +
      '<div class="voucher-status ' + (isFinal?'':'wait') + '"><span class="pulse"></span>' + (isFinal?'Contrato finalizado':'Aguardando assinatura do Badu') + '</div>' +
      '<h2>' + (isFinal?'Tudo pronto!':'Assinatura enviada') + '</h2>' +
      '<div class="voucher-code">' + esc(c.id) + '</div>' +
      '<p class="voucher-copy-hint">Guarde este código para consultar o status e baixar o PDF depois.</p>' +
    '</div>' +
    '<div class="voucher-divider"></div>' +
    '<div class="voucher-bottom">' +
      '<div class="voucher-row"><span>Contratante</span><span>' + esc(c.cliente.nome) + '</span></div>' +
      '<div class="voucher-row"><span>Show</span><span>' + esc(dateLong(c.evento.data)) + ', ' + esc(c.evento.hora) + '</span></div>' +
      '<div class="voucher-row"><span>Local</span><span>' + esc(c.evento.localCidade) + '</span></div>' +
      '<div class="voucher-actions">' +
        (isFinal ? '<button class="btn btn-teal" id="btn-download-voucher" type="button">Baixar PDF</button>' : '<button class="btn btn-ghost" id="btn-copy-code" type="button">Copiar código</button>') +
      '</div>' +
    '</div>';
  if(isFinal){
    document.getElementById('btn-download-voucher').addEventListener('click', function(){
      downloadContractPDF(c.id);
    });
  } else {
    document.getElementById('btn-copy-code').addEventListener('click', function(){
      if(navigator.clipboard){ navigator.clipboard.writeText(c.id).then(function(){ toast('Código copiado.'); }).catch(function(){}); }
    });
  }
}

function renderLookupResult(c){
  var target = document.getElementById('lookup-result');
  var isFinal = c.status==='finalizado';
  target.innerHTML =
    '<div class="voucher" style="margin:0;">' +
      '<div class="voucher-top">' +
        '<div class="voucher-status ' + (isFinal?'':'wait') + '"><span class="pulse"></span>' + (isFinal?'Contrato finalizado':'Aguardando assinatura do Badu') + '</div>' +
        '<h2 style="font-size:22px;">' + esc(c.id) + '</h2>' +
      '</div>' +
      '<div class="voucher-divider"></div>' +
      '<div class="voucher-bottom">' +
        '<div class="voucher-row"><span>Contratante</span><span>' + esc(c.cliente.nome) + '</span></div>' +
        '<div class="voucher-row"><span>Show</span><span>' + esc(dateLong(c.evento.data)) + ', ' + esc(c.evento.hora) + '</span></div>' +
        '<div class="voucher-row"><span>Local</span><span>' + esc(c.evento.localCidade) + '</span></div>' +
        '<div class="voucher-actions">' +
          (isFinal ? '<button class="btn btn-teal" id="btn-download-lookup" type="button">Baixar PDF</button>' : '<span class="hint" style="font-family:var(--font-mono);font-size:12px;color:var(--ink-faint);">O PDF fica disponível assim que o Badu assinar.</span>') +
        '</div>' +
      '</div>' +
    '</div>';
  if(isFinal){
    document.getElementById('btn-download-lookup').addEventListener('click', function(){
      downloadContractPDF(c.id);
    });
  }
}

async function doLookup(codeRaw){
  var code = (codeRaw||'').trim().toUpperCase();
  var target = document.getElementById('lookup-result');
  showScreen('screen-lookup');
  target.innerHTML = '<div class="loading-row"><span class="spinner"></span> Consultando contrato…</div>';
  if(!code){ target.innerHTML = emptyLookup('Digite um código de contrato para consultar.'); return; }
  var c = await getContract(code);
  if(!c){ target.innerHTML = emptyLookup('Nenhum contrato encontrado com o código ' + esc(code) + '.'); return; }
  renderLookupResult(c);
}

/* ================= ADMIN ================= */
async function openAdminDashboard(){
  showScreen('screen-admin');
  var listEl = document.getElementById('admin-list');
  var statsEl = document.getElementById('admin-stats');
  listEl.innerHTML = '<div class="loading-row"><span class="spinner"></span> Carregando contratos…</div>';
  statsEl.innerHTML = '';
  var r = await adminApi('/contratos');
  if(r.status === 401) return;
  if(!r.ok){ listEl.innerHTML = emptyLookup('Não foi possível carregar os contratos.'); return; }
  var contracts = Array.isArray(r.data) ? r.data : [];
  contracts.sort(function(a,b){ return new Date(b.createdAt) - new Date(a.createdAt); });
  var total = contracts.length;
  var pend = contracts.filter(function(c){ return c.status==='aguardando_badu'; }).length;
  var done = contracts.filter(function(c){ return c.status==='finalizado'; }).length;
  statsEl.innerHTML =
    '<div class="stat-card"><div class="num">'+total+'</div><div class="lbl">Total</div></div>' +
    '<div class="stat-card"><div class="num">'+pend+'</div><div class="lbl">Aguardando assinatura</div></div>' +
    '<div class="stat-card"><div class="num">'+done+'</div><div class="lbl">Finalizados</div></div>';
  if(total===0){ listEl.innerHTML = emptyLookup('Nenhum contrato gerado ainda.'); return; }

  var groups = {};
  contracts.forEach(function(c){
    var dayKey = (c.createdAt||'').slice(0,10) || 'sem-data';
    if(!groups[dayKey]) groups[dayKey]=[];
    groups[dayKey].push(c);
  });
  var dayKeys = Object.keys(groups).sort(function(a,b){ return b.localeCompare(a); });
  listEl.innerHTML = dayKeys.map(function(dayKey){
    var rows = groups[dayKey].map(function(c){
      var isFinal = c.status==='finalizado';
      return '<div class="contract-row">' +
        '<div class="cinfo">' +
          '<div class="cname">' + esc(c.cliente.nome||'—') + '</div>' +
          '<div class="cmeta">' + esc(c.id) + ' · show em ' + esc(dateShort(c.evento.data)) + '</div>' +
        '</div>' +
        '<div class="cactions">' +
          '<span class="badge ' + (isFinal?'done':'wait') + '">' + (isFinal?'Finalizado':'Aguardando Badu') + '</span>' +
          '<button class="btn btn-sm ' + (isFinal?'btn-ghost':'btn-primary') + '" data-open-contract="' + esc(c.id) + '" type="button">' + (isFinal?'Ver / baixar':'Assinar') + '</button>' +
          '<button class="btn btn-sm btn-danger-ghost" data-delete-contract="' + esc(c.id) + '" type="button">Excluir</button>' +
        '</div>' +
      '</div>';
    }).join('');
    var dayLabel = dayKey==='sem-data' ? 'Sem data' : dateLong(dayKey);
    return '<div class="contract-group"><div class="group-date">'+esc(dayLabel)+'</div>'+rows+'</div>';
  }).join('');

  listEl.querySelectorAll('[data-open-contract]').forEach(function(btn){
    btn.addEventListener('click', function(){ openAdminSign(btn.getAttribute('data-open-contract')); });
  });
  listEl.querySelectorAll('[data-delete-contract]').forEach(function(btn){
    btn.addEventListener('click', function(e){
      e.stopPropagation();
      var id = btn.getAttribute('data-delete-contract');
      var row = btn.closest('.contract-row');
      var name = row ? row.querySelector('.cname').textContent : id;
      showConfirm('Excluir o contrato de ' + name + ' (' + id + ')? Essa ação não pode ser desfeita.', async function(){
        var r = await adminApi('/contratos/'+encodeURIComponent(id), {method:'DELETE'});
        if(r.status === 401) return;
        if(r.ok){ toast('Contrato excluído.'); openAdminDashboard(); }
        else{ toast('Não foi possível excluir o contrato.'); }
      });
    });
  });
}

function toggleIntervaloField(){
  var checked = document.getElementById('admin-f-intervalo').checked;
  document.getElementById('admin-f-intervalomin-wrap').style.display = checked ? 'block' : 'none';
}

function syncAdminFieldsToContract(){
  if(!currentAdminContract) return;
  var horaFim = document.getElementById('admin-f-horafim').value || null;
  var temIntervalo = document.getElementById('admin-f-intervalo').checked;
  var intervaloMinRaw = document.getElementById('admin-f-intervalomin').value;
  currentAdminContract.duracaoFinal = {
    horaFim: horaFim,
    temIntervalo: temIntervalo,
    intervaloMin: temIntervalo ? (intervaloMinRaw ? Number(intervaloMinRaw) : null) : null
  };
  var entradaRaw = document.getElementById('admin-f-entrada').value;
  var restanteRaw = document.getElementById('admin-f-restante').value;
  currentAdminContract.pagamento = {
    valorEntrada: entradaRaw==='' ? null : Number(entradaRaw),
    valorRestante: restanteRaw==='' ? null : Number(restanteRaw)
  };
  document.getElementById('admin-contract-preview').innerHTML = renderPaperHTML(currentAdminContract);
  var totalEl = document.getElementById('admin-total-display');
  if(currentAdminContract.pagamento.valorEntrada!=null && currentAdminContract.pagamento.valorRestante!=null){
    var total = currentAdminContract.pagamento.valorEntrada + currentAdminContract.pagamento.valorRestante;
    totalEl.textContent = 'Total do cachê: ' + formatBRL(total);
  } else {
    totalEl.textContent = '';
  }
}

async function openAdminSign(id){
  showScreen('screen-admin-sign');
  document.getElementById('admin-contract-preview').innerHTML = '<div class="loading-row"><span class="spinner"></span> Carregando…</div>';
  var r = await adminApi('/contratos/'+encodeURIComponent(id));
  if(r.status === 401) return;
  var c = r.ok ? r.data : null;
  if(!c){ toast('Contrato não encontrado.'); showScreen('screen-admin'); return; }
  currentAdminContract = c;
  document.getElementById('admin-sign-title').textContent = c.cliente.nome || c.id;
  document.getElementById('admin-sign-sub').textContent = c.id + ' · show em ' + dateLong(c.evento.data);

  var termsBlock = document.getElementById('badu-terms-block');
  var signArea = document.getElementById('admin-sign-area');
  var already = document.getElementById('admin-already-signed');

  if(c.status==='finalizado'){
    termsBlock.style.display='none';
    document.getElementById('admin-contract-preview').innerHTML = renderPaperHTML(c);
    signArea.style.display='none';
    already.style.display='block';
    document.getElementById('btn-admin-download').onclick = function(){
      downloadContractPDF(c.id);
    };
  } else {
    termsBlock.style.display='block';
    signArea.style.display='block';
    already.style.display='none';
    var defaultHoraFim = addHoursToTime(c.evento.hora, 3);
    document.getElementById('admin-f-horafim').value = (c.duracaoFinal && c.duracaoFinal.horaFim) || defaultHoraFim;
    document.getElementById('admin-f-intervalo').checked = c.duracaoFinal ? !!c.duracaoFinal.temIntervalo : true;
    document.getElementById('admin-f-intervalomin').value = (c.duracaoFinal && c.duracaoFinal.intervaloMin) ? c.duracaoFinal.intervaloMin : 30;
    document.getElementById('admin-f-entrada').value = (c.pagamento && c.pagamento.valorEntrada!=null) ? c.pagamento.valorEntrada : '';
    document.getElementById('admin-f-restante').value = (c.pagamento && c.pagamento.valorRestante!=null) ? c.pagamento.valorRestante : '';
    toggleIntervaloField();
    syncAdminFieldsToContract();
    requestAnimationFrame(function(){
      if(!baduPad){
        baduPad = new SignaturePad(document.getElementById('sign-canvas-badu'), document.getElementById('sign-placeholder-badu'));
      } else {
        baduPad.clear();
      }
    });
  }
}

function showAdminGate(){
  showScreen('screen-admin-gate');
  document.getElementById('input-admin-senha').value = '';
  document.getElementById('admin-pin-err').style.display = 'none';
}

async function doAdminLogin(){
  var errEl = document.getElementById('admin-pin-err');
  var email = document.getElementById('input-admin-email').value.trim();
  var senha = document.getElementById('input-admin-senha').value;
  if(!email || !senha){
    errEl.textContent = 'Preencha e-mail e senha.';
    errEl.style.display = 'block';
    return;
  }
  var btn = document.getElementById('btn-admin-enter');
  btn.disabled = true; btn.textContent = 'Entrando…';
  var r = await apiJson('/auth/login', {method:'POST', body: JSON.stringify({email:email, senha:senha})});
  btn.disabled = false; btn.textContent = 'Entrar';
  if(r.ok){
    errEl.style.display = 'none';
    openAdminDashboard();
  } else {
    errEl.textContent = (r.data && r.data.error) || 'Não foi possível entrar.';
    errEl.style.display = 'block';
  }
}

/* ================= CAROUSEL ================= */
var CAR_IMAGES = [
  {src:'assets/badu-1.jpg', pos:'58% 12%'},
  {src:'assets/badu-2.jpg', pos:'56% 42%'},
  {src:'assets/badu-3.jpg', pos:'40% 42%'},
  {src:'assets/badu-4.jpg', pos:'52% 38%'}
];
var carIndex = 0;
var carTimer = null;
function initCarousel(){
  var track = document.getElementById('carousel-track');
  var dots = document.getElementById('car-dots');
  if(!track || !dots) return;
  track.innerHTML = CAR_IMAGES.map(function(im,i){
    return '<div class="carousel-slide'+(i===0?' active':'')+'"><img src="'+im.src+'" alt="Badu Perrone ao vivo" style="object-position:'+im.pos+'"></div>';
  }).join('');
  dots.innerHTML = CAR_IMAGES.map(function(_,i){
    return '<button class="car-dot'+(i===0?' active':'')+'" type="button" data-i="'+i+'" aria-label="Foto '+(i+1)+'"></button>';
  }).join('');
  dots.querySelectorAll('.car-dot').forEach(function(d){
    d.addEventListener('click', function(){ goToSlide(Number(d.getAttribute('data-i'))); restartAutoplay(); });
  });
  var prevBtn = document.querySelector('.car-prev');
  var nextBtn = document.querySelector('.car-next');
  if(prevBtn) prevBtn.addEventListener('click', function(){ goToSlide(carIndex-1); restartAutoplay(); });
  if(nextBtn) nextBtn.addEventListener('click', function(){ goToSlide(carIndex+1); restartAutoplay(); });
  var art = document.getElementById('hero-carousel');
  var startX = null;
  art.addEventListener('touchstart', function(e){ startX = e.touches[0].clientX; }, {passive:true});
  art.addEventListener('touchend', function(e){
    if(startX===null) return;
    var dx = e.changedTouches[0].clientX - startX;
    if(Math.abs(dx) > 40){ if(dx<0){ goToSlide(carIndex+1); } else { goToSlide(carIndex-1); } restartAutoplay(); }
    startX = null;
  }, {passive:true});
  restartAutoplay();
}
function goToSlide(i){
  var n = CAR_IMAGES.length;
  carIndex = ((i % n) + n) % n;
  document.querySelectorAll('.carousel-slide').forEach(function(s,idx){ s.classList.toggle('active', idx===carIndex); });
  document.querySelectorAll('.car-dot').forEach(function(d,idx){ d.classList.toggle('active', idx===carIndex); });
}
function restartAutoplay(){
  clearInterval(carTimer);
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduce) return;
  carTimer = setInterval(function(){ goToSlide(carIndex+1); }, 5000);
}

/* ================= WIRING ================= */
document.getElementById('btn-open-admin').addEventListener('click', async function(){
  var r = await apiJson('/auth/me');
  if(r.ok){ openAdminDashboard(); return; }
  showAdminGate();
});
document.getElementById('btn-admin-gate-home').addEventListener('click', function(){ showScreen('screen-landing'); });
document.getElementById('btn-admin-enter').addEventListener('click', doAdminLogin);
document.getElementById('input-admin-senha').addEventListener('keydown', function(e){ if(e.key==='Enter') doAdminLogin(); });
document.getElementById('btn-admin-home').addEventListener('click', async function(){
  await apiJson('/auth/logout', {method:'POST'});
  showScreen('screen-landing');
});
document.getElementById('btn-admin-sign-back').addEventListener('click', function(){ openAdminDashboard(); });
document.getElementById('btn-admin-delete').addEventListener('click', function(){
  if(!currentAdminContract) return;
  var id = currentAdminContract.id;
  var name = currentAdminContract.cliente.nome || id;
  showConfirm('Excluir o contrato de ' + name + ' (' + id + ')? Essa ação não pode ser desfeita.', async function(){
    var r = await adminApi('/contratos/'+encodeURIComponent(id), {method:'DELETE'});
    if(r.status === 401) return;
    if(r.ok){ toast('Contrato excluído.'); openAdminDashboard(); }
    else{ toast('Não foi possível excluir o contrato.'); }
  });
});
document.getElementById('confirm-modal-cancel').addEventListener('click', hideConfirm);
document.getElementById('confirm-modal-ok').addEventListener('click', function(){
  var cb = confirmCallback;
  hideConfirm();
  if(cb) cb();
});
document.getElementById('confirm-modal').addEventListener('click', function(e){
  if(e.target === this) hideConfirm();
});

document.getElementById('btn-start').addEventListener('click', function(){
  draft = newDraft();
  resetFormFields();
  goStep(1);
  showScreen('screen-form');
});
document.getElementById('btn-form-cancel').addEventListener('click', function(){ showScreen('screen-landing'); });

document.querySelectorAll('#screen-form [data-next]').forEach(function(btn){
  btn.addEventListener('click', function(){
    if(validateStep(currentStep)) goStep(currentStep+1);
  });
});
document.querySelectorAll('#screen-form [data-prev]').forEach(function(btn){
  btn.addEventListener('click', function(){ goStep(currentStep-1); });
});

document.getElementById('f-cpfcnpj').addEventListener('input', function(e){ e.target.value = maskCPFCNPJ(e.target.value); });
document.getElementById('f-rg').addEventListener('input', function(e){ e.target.value = maskRG(e.target.value); });
document.getElementById('f-endCep').addEventListener('input', function(e){ e.target.value = maskCEP(e.target.value); });
document.getElementById('f-localCep').addEventListener('input', function(e){ e.target.value = maskCEP(e.target.value); });

document.getElementById('chk-agree').addEventListener('change', function(){
  document.getElementById('btn-submit-client').disabled = !this.checked;
});
document.getElementById('btn-clear-sign-client').addEventListener('click', function(){ if(clientPad) clientPad.clear(); });
document.getElementById('btn-clear-sign-badu').addEventListener('click', function(){ if(baduPad) baduPad.clear(); });

document.getElementById('btn-submit-client').addEventListener('click', async function(){
  if(!clientPad || clientPad.isEmpty()){ toast('Desenhe sua assinatura antes de continuar.'); return; }
  var btn = this;
  btn.disabled = true; btn.textContent = 'Enviando…';
  draft.assinaturaCliente = clientPad.toDataURL();
  draft.assinaturaClienteEm = new Date().toISOString();
  var saved = await createContract(draft);
  btn.disabled = false; btn.textContent = 'Assinar e enviar';
  if(!saved){ toast('Não foi possível salvar. Tente novamente.'); return; }
  draft = saved;
  showVoucher(draft);
  showScreen('screen-confirm');
});

['admin-f-horafim','admin-f-entrada','admin-f-restante','admin-f-intervalomin'].forEach(function(id){
  var el = document.getElementById(id);
  if(el) el.addEventListener('input', syncAdminFieldsToContract);
});
document.getElementById('admin-f-intervalo').addEventListener('change', function(){ toggleIntervaloField(); syncAdminFieldsToContract(); });

document.getElementById('btn-submit-badu').addEventListener('click', async function(){
  var horaFim = document.getElementById('admin-f-horafim').value;
  var entrada = document.getElementById('admin-f-entrada').value;
  var restante = document.getElementById('admin-f-restante').value;
  if(!horaFim || entrada==='' || restante===''){
    toast('Preencha a duração e os valores de pagamento antes de assinar.');
    return;
  }
  if(!baduPad || baduPad.isEmpty()){ toast('Desenhe a assinatura do Badu antes de continuar.'); return; }
  syncAdminFieldsToContract();
  var btn = this;
  btn.disabled = true; btn.textContent = 'Salvando…';
  var patch = {
    duracaoFinal: currentAdminContract.duracaoFinal,
    pagamento: currentAdminContract.pagamento,
    assinaturaBadu: baduPad.toDataURL(),
    assinaturaBaduEm: new Date().toISOString()
  };
  var r = await adminApi('/contratos/'+encodeURIComponent(currentAdminContract.id), {method:'PATCH', body: JSON.stringify(patch)});
  btn.disabled = false; btn.textContent = 'Assinar e finalizar contrato';
  if(r.status === 401) return;
  if(!r.ok){ toast('Não foi possível salvar.'); return; }
  currentAdminContract = r.data;
  toast('Contrato finalizado com sucesso.');
  openAdminSign(currentAdminContract.id);
});

document.getElementById('btn-confirm-home').addEventListener('click', function(){ showScreen('screen-landing'); });
document.getElementById('btn-lookup-home').addEventListener('click', function(){ showScreen('screen-landing'); });
document.getElementById('btn-lookup').addEventListener('click', function(){ doLookup(document.getElementById('input-lookup-code').value); });
document.getElementById('input-lookup-code').addEventListener('keydown', function(e){ if(e.key==='Enter') doLookup(e.target.value); });

(function initDefaults(){
  var todayISO = new Date().toISOString().slice(0,10);
  var dataField = document.getElementById('f-data');
  if(dataField) dataField.min = todayISO;
  initCarousel();
  loadBusinessInfo();
})();
