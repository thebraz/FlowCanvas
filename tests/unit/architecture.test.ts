import { expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import ts from 'typescript';
function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(resolve(directory, entry.name))
      : /\.tsx?$/u.test(entry.name)
        ? [resolve(directory, entry.name)]
        : [],
  );
}
it('given all source modules, then dependency direction, forbidden capabilities, and acyclic imports hold', () => {
  const sources = files(resolve('src'));
  const graph = new Map<string, string[]>();
  for (const file of sources) {
    const source = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const name = relative(resolve('src'), file).replaceAll('\\', '/');
    const imports: string[] = [];
    const visit = (node: ts.Node) => {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        const dependency = node.moduleSpecifier.text;
        if (/^(domain|contracts)\//u.test(name)) {
          expect(dependency.startsWith('.')).toBe(true);
          const target = relative(resolve('src'), resolve(dirname(file), dependency)).replaceAll(
            '\\',
            '/',
          );
          expect(target).toMatch(/^(domain|contracts)\//u);
        }
        if (name.startsWith('engine/')) {
          expect(dependency.startsWith('.')).toBe(true);
          const target = relative(resolve('src'), resolve(dirname(file), dependency)).replaceAll(
            '\\',
            '/',
          );
          expect(target).toMatch(/^(engine|domain|contracts|validation)\//u);
        }
        if (dependency.startsWith('.')) {
          if (dependency.endsWith('.css')) {
            expect(existsSync(resolve(dirname(file), dependency))).toBe(true);
            return;
          }
          const target = [
            resolve(dirname(file), dependency + '.ts'),
            resolve(dirname(file), dependency + '.tsx'),
          ].find((path) => sources.includes(path));
          expect(target, `Resolve ${dependency} from ${name}`).toBeDefined();
          if (target) imports.push(target);
        }
      }
      if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
        if (ts.isIdentifier(node.expression))
          expect(
            ['eval', 'Function', 'fetch', 'WebSocket', 'XMLHttpRequest'].includes(
              node.expression.text,
            ),
          ).toBe(false);
        if (node.expression.kind === ts.SyntaxKind.ImportKeyword)
          expect(node.arguments?.[0] && ts.isStringLiteral(node.arguments[0])).toBe(true);
      }
      if (ts.isJsxAttribute(node))
        expect(node.name.getText(source)).not.toBe('dangerouslySetInnerHTML');
      if (name.startsWith('engine/') && ts.isIdentifier(node))
        expect(
          [
            'window',
            'navigator',
            'localStorage',
            'indexedDB',
            'Worker',
            'MessageChannel',
            'performance',
            'setTimeout',
            'setInterval',
            'Date',
            'crypto',
            'console',
          ].includes(node.text),
        ).toBe(false);
      ts.forEachChild(node, visit);
    };
    visit(source);
    graph.set(file, imports);
  }
  const visited = new Set<string>();
  const active = new Set<string>();
  const walk = (file: string) => {
    expect(active.has(file), `No circular imports: ${relative(resolve('src'), file)}`).toBe(false);
    if (visited.has(file)) return;
    active.add(file);
    for (const dependency of graph.get(file) ?? []) walk(dependency);
    active.delete(file);
    visited.add(file);
  };
  for (const file of sources) walk(file);
});
