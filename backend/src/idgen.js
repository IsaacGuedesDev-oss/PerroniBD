const db = require('./db');

// Mesmo formato usado historicamente no frontend: BP-YYYYMMDD-XXXX
function randomSuffix() {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

function genId() {
  var now = new Date();
  var y = now.getFullYear();
  var m = String(now.getMonth() + 1).padStart(2, '0');
  var d = String(now.getDate()).padStart(2, '0');
  var stmt = db.prepare('SELECT 1 FROM contratos WHERE id = ?');
  for (var i = 0; i < 8; i++) {
    var id = 'BP-' + y + m + d + '-' + randomSuffix();
    if (!stmt.get(id)) return id;
  }
  // Extremamente improvável de chegar aqui, mas garante um id único mesmo assim.
  return 'BP-' + y + m + d + '-' + Date.now().toString(36).toUpperCase();
}

module.exports = { genId };
