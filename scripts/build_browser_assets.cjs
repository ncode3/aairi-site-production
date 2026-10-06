const fs = require('node:fs');
const path = require('node:path');
const { compile, optimize } = require('@tailwindcss/node');
const { Scanner } = require('@tailwindcss/oxide');
const root = path.resolve(__dirname, '..');
const dest = path.join(root, 'dist');
const vendor = path.join(dest, 'assets/vendor');
fs.mkdirSync(vendor, { recursive: true });
fs.copyFileSync(path.join(root, 'node_modules/lucide/dist/umd/lucide.min.js'), path.join(vendor, 'lucide.min.js'));
fs.copyFileSync(path.join(root, 'node_modules/lucide/LICENSE'), path.join(vendor, 'lucide-LICENSE.txt'));
fs.mkdirSync(path.join(dest, 'assets/css/pages'), { recursive: true });
async function buildStyles() {
for (const file of fs.readdirSync(path.join(root, 'config/tailwind'))) {
  const page = path.basename(file, '.cjs');
  const input = fs.readFileSync(path.join(root, 'config/tailwind-input.css'), 'utf8') +
    `\n@config "./tailwind/${file}";\n@source "../dist/${page}.html";\n@source "../assets/js";\n`;
  const compiler = await compile(input, { base: path.join(root, 'config'), onDependency() {} });
  const scanner = new Scanner({ sources: compiler.sources });
  const css = compiler.build(scanner.scan());
  fs.writeFileSync(path.join(dest, 'assets/css/pages', page + '.css'), optimize(css, { minify: true }).code);
}
console.log('Built pinned local icons and page-specific CSS.');
}
buildStyles().catch(error => { console.error(error); process.exitCode = 1; });
