import fs from 'node:fs';
import path from 'node:path';
import * as ts from 'typescript';

const root = path.resolve('app');
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.tsx?$/.test(entry.name)) files.push(full);
  }
}
walk(root);

const problems = [];
const lineOf = (sf, pos) => sf.getLineAndCharacterOfPosition(pos).line + 1;
const isPropertyName = (id) => {
  const p = id.parent;
  return (ts.isPropertyAccessExpression(p) && p.name === id)
    || (ts.isPropertyAssignment(p) && p.name === id)
    || (ts.isJsxAttribute(p) && p.name === id);
};
const isDeclarationName = (id) => {
  const p = id.parent;
  return (ts.isVariableDeclaration(p) && p.name === id)
    || (ts.isParameter(p) && p.name === id)
    || (ts.isBindingElement(p) && p.name === id)
    || (ts.isFunctionDeclaration(p) && p.name === id)
    || (ts.isClassDeclaration(p) && p.name === id);
};

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

  function auditFunction(fn) {
    if (!fn.body || !ts.isBlock(fn.body)) return;
    const decls = new Map();
    for (const stmt of fn.body.statements) {
      if (!ts.isVariableStatement(stmt)) continue;
      for (const decl of stmt.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && (stmt.declarationList.flags & (ts.NodeFlags.Const | ts.NodeFlags.Let))) {
          decls.set(decl.name.text, decl);
        }
      }
    }
    for (const stmt of fn.body.statements) {
      if (!ts.isVariableStatement(stmt)) continue;
      for (const decl of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
        const currentPos = decl.getStart(sf);
        function scan(node) {
          if (ts.isIdentifier(node) && !isPropertyName(node) && !isDeclarationName(node)) {
            const target = decls.get(node.text);
            if (target && target.getStart(sf) > currentPos) {
              problems.push(`${path.relative(process.cwd(), file)}:${lineOf(sf, node.getStart(sf))} — ${decl.name.text} depende de ${node.text} antes da inicialização (${lineOf(sf, target.getStart(sf))})`);
            }
          }
          ts.forEachChild(node, scan);
        }
        scan(decl.initializer);
      }
    }
  }
  function visit(node) {
    if (ts.isFunctionLike(node)) auditFunction(node);
    ts.forEachChild(node, visit);
  }
  visit(sf);
}

if (problems.length) {
  console.error('Runtime-order audit falhou:\n' + problems.join('\n'));
  process.exit(1);
}
console.log(`Runtime-order audit OK — ${files.length} ficheiros TS/TSX verificados.`);
