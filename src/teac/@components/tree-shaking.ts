/// <reference path="../@utils/utils.ts" />

namespace ts {}

namespace Teac {
  type Node = import('ts-morph').Node;
  type Project = import('ts-morph').Project;
  type Statement = import('ts-morph').Statement;
  type ImportSpecifier = import('ts-morph').ImportSpecifier;
  type RemovableNode = Statement | ImportSpecifier;

  const {TypeGuards}: typeof import('ts-morph') = require('ts-morph');

  function isRemovable(node: Node): node is RemovableNode {
    return (
      TypeGuards.isStatement(node)
      || TypeGuards.isImportSpecifier(node)
      || TypeGuards.isExportSpecifier(node)
    );
  }

  class TreeShaker {
    private nodesToRemove: RemovableNode[] = [];
    private fileNameSet: Set<string> = new Set();

    /*
     * mark is 1: the node and all its descendants should be reserved
     * mark is 0: some descendants of the node should be reserved
     * no mark: the node should be removed.
     */
    private nodeToMarkMap: Map<ts.Node, number> = new Map();

    constructor(
      readonly projectPath: string,
      readonly entryFileName: string,
      readonly project: Project,
    ) {}

    markASTNode(nodeToMark: ts.Node) {
      this.nodeToMarkMap.set(nodeToMark, 1);

      let node: ts.Node = nodeToMark;

      while (1) {
        node = node.parent;

        if (!this.nodeToMarkMap.has(node)) {
          this.nodeToMarkMap.set(node, 0);
        }

        if (ts.isSourceFile(node)) {
          break;
        }
      }
    }

    markASTAndGetFilenameSet(symbols: ts.Symbol[], nodes: ts.Node[]): void {
      for (let symbol of symbols) {
        for (let declaration of symbol.declarations) {
          this.markASTNode(declaration);

          this.fileNameSet.add(declaration.getSourceFile().fileName);
        }
      }

      for (let node of nodes) {
        this.markASTNode(node);
        
        this.fileNameSet.add(node.getSourceFile().fileName);
      }
    }

    walkNodeToDelete = (node: Node): void => {
      let tsNode = node.compilerNode as unknown as ts.Node;

      if (isRemovable(node)) {
        if (!this.nodeToMarkMap.has(tsNode)) {
          this.nodesToRemove.push(node);

          return;
        }
      }

      if (this.nodeToMarkMap.has(tsNode) && this.nodeToMarkMap.get(tsNode) === 1) {
        return;
      }

      node.forEachChild(this.walkNodeToDelete);
    }

    removeUnmarkedASTNodes(): void {
      for (let fileName of Array.from(this.fileNameSet)) {
        let sourceFile = this.project.getSourceFile(fileName);

        if (sourceFile) {
          sourceFile.forEachChild(this.walkNodeToDelete);
        } else {
          console.error('unknown error: sourceFile is undefined');
        }
      }

      for (let node of this.nodesToRemove) {
        node.remove();
      }
    }


    treeShake(symbols: ts.Symbol[], nodes: ts.Node[]): string[] {
      this.markASTAndGetFilenameSet(symbols, nodes);

      this.removeUnmarkedASTNodes();

      return Array.from(this.fileNameSet);
    }
  }

  export function treeShake(
    symbols: ts.Symbol[],
    nodes: ts.Node[],
    projectPath: string,
    entryFileName: string,
    project: Project,
  ): string[] {
    return new TreeShaker(
      projectPath,
      entryFileName,
      project,
    ).treeShake(symbols, nodes);
  }
}
