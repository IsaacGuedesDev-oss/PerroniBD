const express = require('express');
const { getBusinessInfo } = require('../business');

const router = express.Router();

// Dados do contratado pro texto do contrato.
router.get('/', (req, res) => {
  res.json(getBusinessInfo());
});

module.exports = router;
