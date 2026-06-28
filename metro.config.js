const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// jsPDF lazily requires html2canvas/dompurify only inside its unused .html()
// renderer, but Metro statically resolves every require() it finds. Stub
// them out so the bundle still builds without pulling in real DOM-canvas deps.
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  html2canvas: path.resolve(__dirname, 'stubs/empty.js'),
  dompurify: path.resolve(__dirname, 'stubs/empty.js'),
};

module.exports = config;
