/**
 * Rewrites `return` in the synthetic `__run` body so the sandbox can emit a machine-readable stdout line.
 * Nested function bodies are left unchanged.
 */

import ts from "typescript"

/**
 * Prefix for the single-line JSON payload written to stdout by sandbox runner code.
 * The host executor parses the **last** stdout line with this prefix.
 */
export const CODE_STEP_STDOUT_RESULT_PREFIX = "__WORKFLOW_CM_RESULT__:"

/**
 * Returns the inner `__run` body source after rewriting `return` statements that belong to `__run`
 * (not to nested functions).
 */
export function rewriteCodeStepReturnsInRunBody({ userBody }: { userBody: string }): string {
  const wrapped = `async function __run(input) {\n${userBody}\n}`
  const sourceFile = ts.createSourceFile("step.mjs", wrapped, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)

  const runDecl = sourceFile.statements[0]
  if (!ts.isFunctionDeclaration(runDecl) || runDecl.name?.text !== "__run" || !runDecl.body || !ts.isBlock(runDecl.body)) {
    throw new Error("Code step internal error: expected async function __run wrapper.")
  }

  const newBody = transformBlockForRunScope({ block: runDecl.body, sourceFile })
  const updatedRun = ts.factory.updateFunctionDeclaration(
    runDecl,
    runDecl.modifiers,
    runDecl.asteriskToken,
    runDecl.name,
    runDecl.typeParameters,
    runDecl.parameters,
    runDecl.type,
    newBody,
  )
  const outFile = ts.factory.updateSourceFile(sourceFile, [updatedRun])
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed, removeComments: false })
  const printed = printer.printNode(ts.EmitHint.Unspecified, outFile.statements[0], outFile)
  const bodyMatch = /\{\s*([\s\S]*)\s*\}\s*$/.exec(printed)
  if (!bodyMatch) {
    throw new Error("Code step internal error: could not extract __run body after transform.")
  }
  return bodyMatch[1].trimEnd()
}

function transformBlockForRunScope({ block, sourceFile }: { block: ts.Block; sourceFile: ts.SourceFile }): ts.Block {
  const next = block.statements.flatMap((st) => expandStatementForRunScope({ statement: st, sourceFile }))
  return ts.factory.updateBlock(block, next)
}

function expandStatementForRunScope({
  statement,
  sourceFile,
}: {
  statement: ts.Statement
  sourceFile: ts.SourceFile
}): ts.Statement[] {
  if (ts.isReturnStatement(statement)) {
    return rewriteReturnStatement({ ret: statement })
  }

  if (ts.isBlock(statement)) {
    return [transformBlockForRunScope({ block: statement, sourceFile })]
  }

  if (ts.isIfStatement(statement)) {
    return [
      ts.factory.updateIfStatement(
        statement,
        statement.expression,
        transformIfOrLoopChild({ node: statement.thenStatement, sourceFile }),
        statement.elseStatement ? transformIfOrLoopChild({ node: statement.elseStatement, sourceFile }) : undefined,
      ),
    ]
  }

  if (ts.isWhileStatement(statement)) {
    return [
      ts.factory.updateWhileStatement(
        statement,
        statement.expression,
        transformIfOrLoopChild({ node: statement.statement, sourceFile }),
      ),
    ]
  }

  if (ts.isDoStatement(statement)) {
    return [
      ts.factory.updateDoStatement(
        statement,
        transformIfOrLoopChild({ node: statement.statement, sourceFile }),
        statement.expression,
      ),
    ]
  }

  if (ts.isForStatement(statement)) {
    return [
      ts.factory.updateForStatement(
        statement,
        statement.initializer,
        statement.condition,
        statement.incrementor,
        transformIfOrLoopChild({ node: statement.statement, sourceFile }),
      ),
    ]
  }

  if (ts.isForOfStatement(statement)) {
    return [
      ts.factory.updateForOfStatement(
        statement,
        statement.awaitModifier,
        statement.initializer,
        statement.expression,
        transformIfOrLoopChild({ node: statement.statement, sourceFile }),
      ),
    ]
  }

  if (ts.isForInStatement(statement)) {
    return [
      ts.factory.updateForInStatement(
        statement,
        statement.initializer,
        statement.expression,
        transformIfOrLoopChild({ node: statement.statement, sourceFile }),
      ),
    ]
  }

  if (ts.isSwitchStatement(statement)) {
    const newClauses = statement.caseBlock.clauses.map((clause) => {
      if (ts.isCaseClause(clause)) {
        return ts.factory.updateCaseClause(
          clause,
          clause.expression,
          clause.statements.flatMap((s) => expandStatementForRunScope({ statement: s, sourceFile })),
        )
      }
      return ts.factory.updateDefaultClause(
        clause,
        clause.statements.flatMap((s) => expandStatementForRunScope({ statement: s, sourceFile })),
      )
    })
    return [ts.factory.updateSwitchStatement(statement, statement.expression, ts.factory.updateCaseBlock(statement.caseBlock, newClauses))]
  }

  if (ts.isTryStatement(statement)) {
    return [
      ts.factory.updateTryStatement(
        statement,
        transformBlockForRunScope({ block: statement.tryBlock, sourceFile }),
        statement.catchClause
          ? ts.factory.updateCatchClause(
              statement.catchClause,
              statement.catchClause.variableDeclaration,
              transformBlockForRunScope({ block: statement.catchClause.block, sourceFile }),
            )
          : undefined,
        statement.finallyBlock ? transformBlockForRunScope({ block: statement.finallyBlock, sourceFile }) : undefined,
      ),
    ]
  }

  if (ts.isLabeledStatement(statement)) {
    return [
      ts.factory.updateLabeledStatement(
        statement,
        statement.label,
        transformIfOrLoopChild({ node: statement.statement, sourceFile }),
      ),
    ]
  }

  if (ts.isWithStatement(statement)) {
    return [
      ts.factory.updateWithStatement(
        statement,
        statement.expression,
        transformIfOrLoopChild({ node: statement.statement, sourceFile }),
      ),
    ]
  }

  /** Nested `function` / `class` declarations: do not rewrite inner returns. */
  if (
    ts.isFunctionDeclaration(statement) ||
    ts.isClassDeclaration(statement) ||
    ts.isInterfaceDeclaration(statement) ||
    ts.isTypeAliasDeclaration(statement) ||
    ts.isEnumDeclaration(statement) ||
    ts.isModuleDeclaration(statement) ||
    ts.isImportDeclaration(statement) ||
    ts.isExportDeclaration(statement) ||
    ts.isExportAssignment(statement)
  ) {
    return [statement]
  }

  return [statement]
}

function transformIfOrLoopChild({ node, sourceFile }: { node: ts.Statement; sourceFile: ts.SourceFile }): ts.Statement {
  if (ts.isBlock(node)) {
    return transformBlockForRunScope({ block: node, sourceFile })
  }
  const expanded = expandStatementForRunScope({ statement: node, sourceFile })
  if (expanded.length === 1) {
    return expanded[0]!
  }
  return ts.factory.createBlock(expanded, true)
}

function rewriteReturnStatement({ ret }: { ret: ts.ReturnStatement }): ts.Statement[] {
  const expr = ret.expression ?? ts.factory.createNull()
  const emit = ts.factory.createExpressionStatement(
    ts.factory.createCallExpression(ts.factory.createIdentifier("__WORKFLOW_emitReturn"), undefined, [expr]),
  )
  const retVoid = ts.factory.createReturnStatement(undefined)
  return [emit, retVoid]
}
