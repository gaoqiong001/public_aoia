// lint-staged config (CommonJS).
// Vendored flow-editor source (src/pages/flow-editor) is excluded from Biome
// via biome.json. We also filter it out here before invoking Biome, so that:
//   1. commits touching only vendored files don't run Biome at all, and
//   2. we avoid Windows command-line length limits when many vendored files
//      are staged at once.
const FLOW_EDITOR = '/src/pages/flow-editor/';

/** @param {string[]} files */
function biomeCmd(files) {
  const filtered = files.filter((f) => !f.replace(/\\/g, '/').includes(FLOW_EDITOR));
  if (filtered.length === 0) return [];
  return [
    `npx @biomejs/biome check --write --no-errors-on-unmatched ${filtered
      .map((f) => `"${f}"`)
      .join(' ')}`,
  ];
}

module.exports = {
  '**/*.{js,jsx,tsx,ts,css,less}': biomeCmd,
  'src/**/*.md': biomeCmd,
};
