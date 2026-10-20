const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { runTests } = require('@vscode/test-electron');

async function main() {
  const root = path.resolve(__dirname, '..');
  const extension = path.join(root, 'packages/vscode-extension-table');
  const source = path.join(extension, 'src/test/e2e');
  const output = path.join(root, '.vscode-test/compiled-tests');
  fs.mkdirSync(output, { recursive: true });
  const compiled = ts.transpileModule(fs.readFileSync(path.join(source, 'integration.test.ts'), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true }
  });
  fs.writeFileSync(path.join(output, 'integration.test.js'), compiled.outputText);
  fs.copyFileSync(path.join(source, 'index.js'), path.join(output, 'index.js'));
  await runTests({
    extensionDevelopmentPath: extension,
    extensionTestsPath: path.join(output, 'index.js'),
    version: process.env.VSCODE_VERSION || 'stable',
    launchArgs: ['--disable-extensions', '--disable-workspace-trust', '--skip-welcome', '--skip-release-notes']
  });
}
main().catch(error => { console.error(error); process.exitCode = 1; });
