namespace Teac {
  type Node = import('ts-morph').Node;
  type SourceFile = import('ts-morph').SourceFile;
  const {TypeGuards}: typeof import('ts-morph') = require('ts-morph');

  export function findNodes(typeNames: string[], sourceFile: SourceFile): Node[] {
    let resultNodes: Node[] = [];
    let typeNameSet: Set<string> = new Set(typeNames);
  
    sourceFile.forEachDescendant(node => {
      if (
        TypeGuards.isInterfaceDeclaration(node) ||
        TypeGuards.isClassDeclaration(node) ||
        TypeGuards.isTypeAliasDeclaration(node) ||
        TypeGuards.isNamespaceDeclaration(node)
      ) {
        if (node.getNameNode() && typeNameSet.has(node.getNameNode()!.getText())) {
          resultNodes.push(node.getNameNode()!);
        }
      }
    });
  
    return resultNodes;
  }
  
}