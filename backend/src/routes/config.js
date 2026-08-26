const express = require('express');
const { getBusinessInfo } = require('../business');
const { isDemoMode } = require('../demo');

const router = express.Router();

// Dados do contratado pro texto do contrato + flag de modo demo (pro frontend mostrar o aviso).
router.get('/', (req, res) => {
  var info = getBusinessInfo();
  info.demoMode = isDemoMode();
  res.json(info);
});

module.exports = router;
