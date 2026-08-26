function isDemoMode() {
  return String(process.env.DEMO_MODE || '').toLowerCase() === 'true';
}

module.exports = { isDemoMode };
