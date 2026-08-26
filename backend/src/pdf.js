// Gera o PDF final com pdfkit. Rodar no servidor (não no navegador) é o que permite
// devolver o documento completo (com CPF/RG) sem expor esses campos em JSON público.
const PDFDocument = require('pdfkit');
const { buildSections, dateLong } = require('./sections');
const { getBusinessInfo } = require('./business');

function formatDateTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  } catch (e) { return iso; }
}

function dataURLToBuffer(dataURL) {
  if (!dataURL) return null;
  var m = /^data:image\/\w+;base64,(.+)$/.exec(dataURL);
  if (!m) return null;
  try { return Buffer.from(m[1], 'base64'); } catch (e) { return null; }
}

const MARGIN_X = 56;
const PAGE_BOTTOM = 760;

function buildContractPDF(c) {
  var doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true });
  var pageW = doc.page.width;
  var maxW = pageW - MARGIN_X * 2;
  var y = 64;

  function checkPage(needed) {
    if (y + (needed || 0) > PAGE_BOTTOM) {
      doc.addPage();
      y = 64;
    }
  }
  function heading(text) {
    checkPage(16);
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#B8341F');
    doc.text(String(text).toUpperCase(), MARGIN_X, y, { width: maxW });
    y = doc.y + 4;
    doc.fillColor('#1E1812');
  }
  function paragraph(text) {
    doc.font('Helvetica').fontSize(10.5).fillColor('#1E1812');
    var height = doc.heightOfString(text, { width: maxW, lineGap: 2.5 });
    checkPage(height);
    doc.text(text, MARGIN_X, y, { width: maxW, lineGap: 2.5 });
    y = doc.y + 4;
  }

  var biz = getBusinessInfo();

  doc.font('Helvetica-Bold').fontSize(17).fillColor('#14100C');
  doc.text('CONTRATO DE APRESENTAÇÃO — ' + biz.nomeEmpresa.toUpperCase(), MARGIN_X, y, { width: maxW });
  y = doc.y + 8;
  doc.font('Helvetica').fontSize(9.5).fillColor('#6E6254');
  doc.text('Artista: ' + biz.nomeArtista + '  ·  ' + biz.cidadeUf, MARGIN_X, y, { width: maxW });
  y = doc.y + 18;

  var sections = buildSections(c);
  sections.forEach(function (sec) {
    if (sec.heading) heading(sec.heading);
    sec.paragraphs.forEach(function (p) {
      if (typeof p === 'string') { paragraph(p); }
      else if (p.list) { p.list.forEach(function (li) { paragraph('—  ' + li); }); }
    });
  });

  y += 2;
  checkPage(20);
  paragraph('Itatiba, ' + dateLong((c.createdAt ? c.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10))) + '.');

  y += 6;
  checkPage(20);
  doc.strokeColor('#D2C8B9').lineWidth(1).moveTo(MARGIN_X, y).lineTo(MARGIN_X + maxW, y).stroke();
  y += 20;

  function signatureBlock(label, name, dataURL, whenISO) {
    checkPage(100);
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#3C3228');
    doc.text(label, MARGIN_X, y);
    y += 8;
    var imgBuf = dataURLToBuffer(dataURL);
    if (imgBuf) {
      try { doc.image(imgBuf, MARGIN_X, y, { width: 170, height: 60, fit: [170, 60] }); } catch (e) { /* assinatura ilegível, segue sem imagem */ }
    }
    y += 66;
    doc.font('Helvetica').fontSize(9.5).fillColor('#1E1812');
    doc.text(name, MARGIN_X, y);
    y = doc.y + 2;
    if (whenISO) {
      doc.font('Helvetica').fontSize(8).fillColor('#8C8070');
      doc.text('Assinado eletronicamente em ' + formatDateTime(whenISO), MARGIN_X, y);
      y = doc.y + 14;
    }
  }

  signatureBlock('CONTRATANTE', c.cliente.nome || '—', c.assinaturaCliente, c.assinaturaClienteEm);
  signatureBlock('CONTRATADO — ' + biz.nomeEmpresa, biz.representante, c.assinaturaBadu, c.assinaturaBaduEm);

  var range = doc.bufferedPageRange();
  for (var i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.font('Courier').fontSize(7.5).fillColor('#96887E');
    doc.text(
      'Documento assinado eletronicamente · código ' + c.id + ' · página ' + (i - range.start + 1) + '/' + range.count,
      MARGIN_X, 812, { lineBreak: false }
    );
  }

  doc.end();
  return doc;
}

module.exports = { buildContractPDF };
