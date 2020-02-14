/// <reference path="../@utils/utils.ts" />

namespace ts {}

namespace Teac {
  type Project = import('ts-morph').Project;
  type Node = import('ts-morph').Node;
  type Symbol = import('ts-morph').Symbol;
  type SourceFile = import('ts-morph').SourceFile;
  type Expression = import('ts-morph').Expression;
  type ImportDeclaration = import('ts-morph').ImportDeclaration;
  type ExportDeclaration = import('ts-morph').ExportDeclaration;
  type ImportEqualsDeclaration = import('ts-morph').ImportEqualsDeclaration;

  const Path: typeof import('path') = require('path');
  const {SyntaxKind, TypeGuards}: typeof import('ts-morph') = require('ts-morph');

  function isModuleSymbol(symbol: Symbol): boolean {
    let count = 0;

    for (let declaration of symbol.getDeclarations()) {
      if (!TypeGuards.isModuledNode(declaration)) {
        if (++count >= 2) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * @param projectPath absolute path
   * @param fileName absolute path
   * @param moduleSpecifier
   */
  function getConvertedModuleSpecifier(
    projectPath: string,
    moduleSpecifier: Expression,
  ): string {
    let fileName = moduleSpecifier.getSourceFile().getFilePath();
    let symbol = moduleSpecifier.getSymbol();

    if (symbol) {
      let declarations = symbol.getDeclarations();
      
      if (
        declarations.length === 1 &&
        TypeGuards.isSourceFile(declarations[0])
      ) {
        const dependentFileName = declarations[0].getSourceFile().getFilePath();
        const dependentInternalFileName = mapExternalFileNameToInternalFileName(
          Path.relative(projectPath, dependentFileName),
        );

        if (!dependentInternalFileName.startsWith('node_modules')) {
          if (isInternal(fileName, projectPath)) {
            return dotPathJoin(
              Path.relative(
                Path.dirname(fileName),
                Path.join(projectPath, dependentInternalFileName),
              ).replace(EXTENSION_REGEX, ''),
            ).replace(/\\/g, '/');
          } else {
            const internalFileNameOfCurrentFile = mapExternalFileNameToInternalFileName(
              Path.relative(projectPath, fileName),
            );

            return dotPathJoin(
              Path.relative(
                Path.dirname(internalFileNameOfCurrentFile),
                dependentInternalFileName,
              ).replace(EXTENSION_REGEX, ''),
            ).replace(/\\/g, '/');
          }
        }
      } else if (declarations.length >= 1 && (TypeGuards.isNamespaceDeclaration(declarations[0]) || isModuleSymbol(symbol)) ) {
        return moduleSpecifier.getText();
      } else {
        console.error(
          `unknown error in 'getConvertedModuleSpecifier': moduleSpecifier map to multiple files. kind: ${declarations[0].getKind()}, File: ${moduleSpecifier.getSourceFile().getFilePath()}, text: ${moduleSpecifier.getText()}.`,
        );
      }
    } else {
      console.error('getConvertedModuleSpecifier failed');
    }

    return moduleSpecifier.getText();
  }

  function convertModuleSpecifierOfImportDeclarationOrExportDeclaration(declaration: ImportDeclaration | ExportDeclaration, projectPath: string) {
    let moduleSpecifier = declaration.getModuleSpecifier();
    if (moduleSpecifier) {
      let convertedModuleSpecifier =
        getConvertedModuleSpecifier(
          projectPath,
          moduleSpecifier,
        );

      let originalModuleSpecifier = moduleSpecifier.getText();
      if (originalModuleSpecifier !== convertedModuleSpecifier) {
        moduleSpecifier.replaceWithText(convertedModuleSpecifier);
      }
    }
  }

  function convertModuleSpecifierOfImportEqualsDeclaration(declaration: ImportEqualsDeclaration, sourceFile: SourceFile, projectPath: string): void {
    // TODO
  }

  function convertModuleSpecifierPerSourceFile(projectPath: string, sourceFile: SourceFile) {
    sourceFile.forEachChild(walkNodeToConvertModuleSpecifier);

    function walkNodeToConvertModuleSpecifier(node: Node): void {
      switch (node.getKind()) {
        case SyntaxKind.ImportDeclaration:
        case SyntaxKind.ExportDeclaration:
          convertModuleSpecifierOfImportDeclarationOrExportDeclaration(<ImportDeclaration | ExportDeclaration>node, projectPath);
          return;

        case SyntaxKind.ImportEqualsDeclaration:
          convertModuleSpecifierOfImportEqualsDeclaration(<ImportEqualsDeclaration>node, sourceFile, projectPath);
          return;
      }
    }
  }

  export function convertModuleSpecifier(projectPath: string, project: Project, fileNames: string[]) {
    for (let fileName of fileNames) {
      let sourceFile = project.getSourceFile(fileName)!;

      convertModuleSpecifierPerSourceFile(projectPath, sourceFile);
    }

  }
}
