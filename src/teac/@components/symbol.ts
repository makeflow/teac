namespace ts {}

/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/consistent-type-assertions */

namespace Teac {
  type Node = import('ts-morph').Node;
  type Project = import('ts-morph').Project;

  class SymbolSearcher {
    symbolToIfRecursiveResolvedMap: Map<ts.Symbol, boolean> = new Map();
    nodeSet: Set<ts.Node> = new Set();
    typeChecker: ts.TypeChecker;

    constructor(readonly project: Project) {
      this.typeChecker = ts.createTypeChecker(project.getProgram().compilerObject as unknown as ts.TypeCheckerHost, false);
    }

    addSymbol(symbol: ts.Symbol): void {
      if (!symbol.declarations) {
        return;
      }

      let recursiveResolved = this.symbolToIfRecursiveResolvedMap.get(symbol);
  
      if (recursiveResolved === undefined) {
        this.symbolToIfRecursiveResolvedMap.set(symbol, false);
      }
    }

    addSymbolByNode(node: ts.Node): void {
      let symbol = this.getSymbolAtLocation(node);

      if (symbol) {
        this.addSymbol(symbol);
      } else {
        console.error(`The symbol of node ${node.getText()} to add is undefined.`);
      }
    }
    
    addResolveAliasResult(symbols: ts.Symbol[], nodes: ts.Node[]): void {
      for (let symbol of symbols) {
        this.addSymbol(symbol);
      }

      for (let node of nodes) {
        this.nodeSet.add(node);
      }
    }
  
    getSymbolAtLocation(node: ts.Node): ts.Symbol | undefined {
      let [symbol, aliasSymbols, pathNodes] = this.typeChecker.getPathSymbolsAndPathNodesAtLocation(node);

      this.addResolveAliasResult(aliasSymbols, pathNodes);

      return symbol;
    }

    addSymbolAndSearch(symbol: ts.Symbol): void {
      if (!symbol.declarations) {
        return;
      }

      if (!this.symbolToIfRecursiveResolvedMap.get(symbol)) {
        this.symbolToIfRecursiveResolvedMap.set(symbol, true);

        this.findDependentSymbols(symbol);
      }
    }

    addSymbolByNodeAndSearch(node: ts.Node): void {
      let symbol = this.getSymbolAtLocation(node);

      if (symbol) {
        this.addSymbolAndSearch(symbol);
      } else {
        console.error(`The symbol of node ${node.getText()} to add is undefined.`);
      }
    }

    isImported(namespaceNode: ts.Identifier): boolean {
      let symbol = this.getSymbolAtLocation(namespaceNode);

      if (!symbol) {
        console.error(`The symbol of node ${namespaceNode.getText()} to add is undefined.`);

        return false;
      }

      for (let declaration of symbol.declarations) {
        switch (declaration.kind) {
          case ts.SyntaxKind.NamespaceImport:
          case ts.SyntaxKind.ImportSpecifier:
          case ts.SyntaxKind.ImportClause:
          case ts.SyntaxKind.ImportEqualsDeclaration:
            return true;
        }
      }

      return false;
    }

    addSymbolByEntityNameAndSearch(node: ts.EntityName): void {
      let namespaceNode: ts.EntityName = node;
  
      this.addSymbolByNodeAndSearch(node);

      while (ts.isQualifiedName(namespaceNode)) {
        namespaceNode = namespaceNode.left;
      }

      // If the namespace node is imported, add the import declaration node.
      // Otherwise(the namespace node is defined in current file), do not add the namespace node. 
      if (namespaceNode !== node && this.isImported(namespaceNode)) {
        this.addSymbolByNode(namespaceNode);
      }
    }

    addSymbolByTypeReferenceNodeAndSearch(typeReferenceNode: ts.TypeReferenceNode): void {
      this.addSymbolByEntityNameAndSearch(typeReferenceNode.typeName);
    }

    walkNodeAllAndSearch = (node: ts.Node): void => {
      if (
        ts.isInterfaceDeclaration(node) ||
        ts.isClassDeclaration(node) ||
        ts.isTypeAliasDeclaration(node)
      ) {
        if (node.name) {
          this.addSymbolByNodeAndSearch(node.name);
        }
      } else if (ts.isImportDeclaration(node)) {
        if (node.importClause) {
          if (node.importClause.name) {
            this.addSymbolByNodeAndSearch(node.importClause.name);
          }
  
          if (node.importClause.namedBindings) {
            if (ts.isNamedImports(node.importClause.namedBindings)) {
              for (let namedImport of node.importClause.namedBindings.elements) {
                this.addSymbolByNodeAndSearch(namedImport.name);
              }
            }
          }
        }
      } else {
        ts.forEachChild(node, this.walkNodeAllAndSearch);
      }
    };

    findDependentSymbols(symbol: ts.Symbol): void {
      for (let declaration of symbol.declarations) {
        switch (declaration.kind) {
          case ts.SyntaxKind.InterfaceDeclaration:
            this.findDependentSymbolsByInterfaceDeclaration(<ts.InterfaceDeclaration>declaration);
            break;

          case ts.SyntaxKind.ClassDeclaration:
            this.findDependentSymbolsByClassDeclaration(<ts.ClassDeclaration>declaration);
            break;
  
          case ts.SyntaxKind.NamespaceImport:
            this.findDependentSymbolsByNamespaceImport(<ts.NamespaceImport>declaration);
            break;
  
          case ts.SyntaxKind.ImportSpecifier:
            this.findDependentSymbolsByImportSpecifier(<ts.ImportSpecifier>declaration);
            break;
          
          case ts.SyntaxKind.ImportClause:
            this.findDependentSymbolsByImportClause(<ts.ImportClause>declaration);
            break;
          
          case ts.SyntaxKind.ImportEqualsDeclaration:
            this.findDependentSymbolsByImportEqualsDeclaration(<ts.ImportEqualsDeclaration>declaration);
            break;
          
          case ts.SyntaxKind.ExportAssignment:
            this.findDependentSymbolsByExportAssignment(<ts.ExportAssignment>declaration);
            break;

          case ts.SyntaxKind.TypeAliasDeclaration:
            this.getTypeReferenceNodeAndSearch((<ts.TypeAliasDeclaration>declaration).type);
            break;
          
          case ts.SyntaxKind.TypeParameter:
            this.getTypeReferenceNodeAndSearch((<ts.TypeParameterDeclaration>declaration).constraint);
            break;
          
          case ts.SyntaxKind.VariableDeclaration:
            this.findDependentSymbolsByVariableDeclaration(<ts.VariableDeclaration>declaration);
            break;
          
          case ts.SyntaxKind.ModuleDeclaration:
            ts.forEachChild(declaration, this.walkNodeAllAndSearch);
            break;
          
          case ts.SyntaxKind.FunctionDeclaration:
            this.findDependentSymbolsByFunctionDeclaration(<ts.FunctionDeclaration>declaration);
            break;

          case ts.SyntaxKind.ImportEqualsDeclaration:
          default:
            throw new Error(`findDependentSymbols: not considered. file: ${declaration.getSourceFile().fileName}, kind: ${declaration.kind}, text: ${declaration.getText()}`);
        }
      }
    }

    findDependentSymbolsByInterfaceDeclaration(declaration: ts.InterfaceDeclaration): void {
      for (let member of declaration.members) {
        switch (member.kind) {
          case ts.SyntaxKind.PropertySignature:
            this.findDependentSymbolsByPropertySignature(<ts.PropertySignature>member);
            break;
  
          case ts.SyntaxKind.ConstructSignature:
          case ts.SyntaxKind.MethodSignature:
          case ts.SyntaxKind.CallSignature:
          case ts.SyntaxKind.IndexSignature:
            this.findDependentSymbolsByConstructSignatureOrMethodSignatureOrCallSignatureOrIndexSignature(<ts.ConstructSignatureDeclaration | ts.MethodSignature | ts.CallSignatureDeclaration | ts.IndexSignatureDeclaration>member);
            break;
        }
      }

      if (declaration.heritageClauses) {
        for (let heritageClause of declaration.heritageClauses) {
          for (let heritageType of heritageClause.types) {
            let expression = heritageType.expression;
    
            this.addSymbolByNodeAndSearch(expression);
    
            while (ts.isPropertyAccessExpression(expression)) {
              expression = expression.expression;
            }
    
            if (ts.isIdentifier(expression)) {
              this.addSymbolByNodeAndSearch(expression);
            } else {
              console.error('unknown error in findDependentSymbol: not considered.');
            }
    
            if (heritageType.typeArguments) {
              for (let typeArgument of heritageType.typeArguments) {
                this.getTypeReferenceNodeAndSearch(typeArgument);
              }
            }
          }
        }
      }
  
      this.getTypeReferenceNodeByTypeParametersAndSearch(declaration.typeParameters);
    }
  
    findDependentSymbolsByPropertySignature(declaration: ts.PropertySignature): void {
      this.getTypeReferenceNodeAndSearch(declaration.type);
  
      if (ts.isComputedPropertyName(declaration.name)) {
        // this.addSymbolByNodeAndSearch( // TODO
        //   declaration.getNameNode().expression,
        //   declaration.getNameNode().expression.getText(),
        // );
      } else if (!ts.isIdentifier(declaration.name) && !ts.isStringLiteral(declaration.name)) {
        console.error(`unknown error in findDependentSymbol: not considered when PropertySignature '${declaration.getText()}' of kind '${declaration.kind}' is InterfaceDeclaration .`);
      }
    }

    findDependentSymbolsByConstructSignatureOrMethodSignatureOrCallSignatureOrIndexSignature(declaration: ts.ConstructSignatureDeclaration | ts.MethodSignature | ts.CallSignatureDeclaration | ts.IndexSignatureDeclaration): void {
      this.getTypeReferenceNodeAndSearch(declaration.type);
  
      for (let parameter of declaration.parameters) {
        this.getTypeReferenceNodeAndSearch(parameter.type);
      }
  
      this.getTypeReferenceNodeByTypeParametersAndSearch(declaration.typeParameters);
    }
  
    findDependentSymbolsByClassDeclaration(declaration: ts.ClassDeclaration): void {
      for (let member of declaration.members) {
        switch (member.kind) {
          case ts.SyntaxKind.PropertyDeclaration:
            this.getTypeReferenceNodeAndSearch((<ts.PropertyDeclaration>member).type);
            break;

          case ts.SyntaxKind.MethodDeclaration:
            this.getTypeReferenceNodeByMethodDeclarationAndSearch(<ts.MethodDeclaration>member);
            break;
  
          case ts.SyntaxKind.Constructor:
            this.getTypeReferenceNodeByConstructorDeclarationAndSearch(<ts.ConstructorDeclaration>member);
            break;
  
          case ts.SyntaxKind.GetAccessor:
            this.getTypeReferenceNodeByGetAccessorAndSearch(<ts.GetAccessorDeclaration>member);
            break;
  
          case ts.SyntaxKind.SetAccessor:
            this.getTypeReferenceNodeBySetAccessorAndSearch(<ts.SetAccessorDeclaration>member);
            break;
        }
      }

      if (declaration.heritageClauses) {
        for (let heritageClause of declaration.heritageClauses) {
          for (let heritageType of heritageClause.types) {
            let expression = heritageType.expression;
    
            this.addSymbolByNodeAndSearch(expression);
    
            while (ts.isPropertyAccessExpression(expression)) {
              expression = expression.expression;
            }
    
            if (ts.isIdentifier(expression)) {
              this.addSymbolByNodeAndSearch(expression);
            } else {
              console.error('unknown error in findDependentSymbol: not considered.');
            }
  
            if (heritageType.typeArguments) {
              for (let typeArgument of heritageType.typeArguments) {
                this.getTypeReferenceNodeAndSearch(typeArgument);
              }
            }
          }
        }
      }
  
      this.getTypeReferenceNodeByTypeParametersAndSearch(declaration.typeParameters);
    }

    findDependentSymbolsByNamespaceImport(declaration: ts.NamespaceImport): void {
      // TODO
      console.log('findDependentSymbolsByNamespaceImport: need to TODO');
    }

    findDependentSymbolsByImportSpecifier(declaration: ts.ImportSpecifier): void {
      let symbol = this.getSymbolAtLocation(declaration.name);

      if (symbol) {
        let [aliasSymbol, symbols, nodes] = this.typeChecker.startToResolveAlias(symbol);

        this.addResolveAliasResult(symbols, nodes);

        this.addSymbolAndSearch(aliasSymbol); // TODO: ??
      } else {
        console.error('unknown error in findDependentSymbolsByImportSpecifier: symbol is undefined.');
      }
    }

    findDependentSymbolsByImportClause(declaration: ts.ImportClause): void {
      let symbol = this.getSymbolAtLocation(declaration.name!);

      if (symbol) {
        let [aliasSymbol, symbols, nodes] = this.typeChecker.startToResolveAlias(symbol);

        this.addResolveAliasResult(symbols, nodes);

        this.addSymbolAndSearch(aliasSymbol); // TODO: ??
      } else {
        console.error('unknown error in findDependentSymbolsByImportClause: symbol is undefined.');
      }
    }

    findDependentSymbolsByImportEqualsDeclaration(declaration: ts.ImportEqualsDeclaration): void {
      let symbol = this.getSymbolAtLocation(declaration.name);
      
      if (symbol) {
        let [aliasSymbol, symbols, nodes] = this.typeChecker.startToResolveAlias(symbol);

        this.addResolveAliasResult(symbols, nodes);

        this.addSymbolAndSearch(aliasSymbol); // TODO: ??
      } else {
        console.error('unknown error in findDependentSymbolsByImportEqualsDeclaration: symbol is undefined.');
      }
    }

    findDependentSymbolsByExportAssignment(declaration: ts.ExportAssignment): void {
      // console.log('findDependentSymbolsByExportAssignment', declaration.getText());
      // if (ts.isPropertyAccessExpression(declaration.expression)) {
      //   this.addSymbolByNodeAndSearch(declaration.expression.name);

      //   let node = declaration.expression;
      // } else if (ts.isIdentifier(declaration.expression)) {
      //   let symbol = this.getSymbolAtLocation(declaration.expression);
      // }
      console.log('findDependentSymbolsByExportAssignment: need to TODO');
    }

    findDependentSymbolsByVariableDeclaration(declaration: ts.VariableDeclaration): void {
      if (declaration.initializer && ts.isIdentifier(declaration.initializer)) {
        this.addSymbolByNodeAndSearch(declaration.initializer);
      }
    }

    findDependentSymbolsByFunctionDeclaration(declaration: ts.FunctionDeclaration): void {
      this.getTypeReferenceNodeAndSearch(declaration.type);

      this.getTypeReferenceNodeByTypeParametersAndSearch(declaration.typeParameters);

      for (let parameter of declaration.parameters) {
        if (parameter.type) {
          this.getTypeReferenceNodeAndSearch(parameter.type);
        }
      }

      ts.forEachChild(declaration, this.walkNodeAllAndSearch);
    }

    getTypeReferenceNodeAndSearch(typeNode: ts.TypeNode | undefined): void {
      if (!typeNode) {
        return;
      }

      switch (typeNode.kind) {
        case ts.SyntaxKind.TypeReference:
          this.getTypeReferenceNodeByTypeReferenceNodeAndSearch(<ts.TypeReferenceNode>typeNode);
          break;

        case ts.SyntaxKind.ArrayType:
          this.getTypeReferenceNodeByArrayTypeNodeAndSearch(<ts.ArrayTypeNode>typeNode);
          break;

        case ts.SyntaxKind.UnionType:
        case ts.SyntaxKind.IntersectionType:
          this.getTypeReferenceNodeByUnionTypeOrIntersectionTypeNodeAndSearch(<ts.UnionTypeNode | ts.IntersectionTypeNode>typeNode);
          break;

        case ts.SyntaxKind.TypeLiteral:
          this.getTypeReferenceNodeByTypeLiteralNodeAndSearch(<ts.TypeLiteralNode>typeNode);
          break;

        case ts.SyntaxKind.ConditionalType:
          this.getTypeReferenceNodeByConditionalTypeNodeAndSearch(<ts.ConditionalTypeNode>typeNode);
          break;

        case ts.SyntaxKind.TupleType:
          this.getTypeReferenceNodeByTupleTypeNodeAndSearch(<ts.TupleTypeNode>typeNode);
          break;

        case ts.SyntaxKind.IndexedAccessType:
          this.getTypeReferenceNodeByIndexedAccessTypeNodeAndSearch(<ts.IndexedAccessTypeNode>typeNode);
          break;

        /* export type A = {[P in keyof AA]?: BB[P];} */
        case ts.SyntaxKind.MappedType:
          this.getTypeReferenceNodeByMappedTypeNodeAndSearch(<ts.MappedTypeNode>typeNode);
          break;

        case ts.SyntaxKind.TypeOperator:
          this.getTypeReferenceNodeAndSearch((<ts.TypeOperatorNode>typeNode).type);
          break;

        case ts.SyntaxKind.ParenthesizedType:
          this.getTypeReferenceNodeAndSearch((<ts.ParenthesizedTypeNode>typeNode).type);
          break;

        /* export type A = typeof undefined; */
        case ts.SyntaxKind.TypeQuery:
          this.addSymbolByEntityNameAndSearch((<ts.TypeQueryNode>typeNode).exprName);
          break;

        case ts.SyntaxKind.FunctionType:
        case ts.SyntaxKind.ConstructorType:
          this.getTypeReferenceNodeByFunctionTypeOrConstructorTypeNodeAndSearch(<ts.FunctionTypeNode | ts.ConstructorTypeNode>typeNode);
          break;

        case ts.SyntaxKind.TypePredicate:
          this.getTypeReferenceNodeAndSearch((<ts.TypePredicateNode>typeNode).type);
          break;

        case ts.SyntaxKind.AnyKeyword:
        case ts.SyntaxKind.UnknownKeyword:
        case ts.SyntaxKind.NumberKeyword:
        case ts.SyntaxKind.BigIntKeyword:
        case ts.SyntaxKind.ObjectKeyword:
        case ts.SyntaxKind.BooleanKeyword:
        case ts.SyntaxKind.StringKeyword:
        case ts.SyntaxKind.SymbolKeyword:
        case ts.SyntaxKind.ThisKeyword:
        case ts.SyntaxKind.VoidKeyword:
        case ts.SyntaxKind.UndefinedKeyword:
        case ts.SyntaxKind.NullKeyword:
        case ts.SyntaxKind.NeverKeyword:
        case ts.SyntaxKind.LiteralType:
        case ts.SyntaxKind.InferType:
        case ts.SyntaxKind.ThisType:
          // nothing
          break;

        default:
          console.error(`Error: typeNode '${typeNode.getText()}' of kind '${typeNode.kind}' is unexpected.`);
          break;
      }
    }
  
    getTypeReferenceNodeByTypeReferenceNodeAndSearch(typeNode: ts.TypeReferenceNode): void {
      this.addSymbolByTypeReferenceNodeAndSearch(typeNode);
  
      if (typeNode.typeArguments) {
        for (let typeArgument of typeNode.typeArguments) {
          this.getTypeReferenceNodeAndSearch(typeArgument);
        }
      }
    }

    getTypeReferenceNodeByArrayTypeNodeAndSearch(typeNode: ts.ArrayTypeNode): void {
      this.getTypeReferenceNodeAndSearch(typeNode.elementType);
    }
  
    getTypeReferenceNodeByUnionTypeOrIntersectionTypeNodeAndSearch(typeNode: ts.UnionTypeNode | ts.IntersectionTypeNode): void {
      for (let type of typeNode.types) {
        this.getTypeReferenceNodeAndSearch(type);
      }
    }
  
    getTypeReferenceNodeByTypeLiteralNodeAndSearch(typeNode: ts.TypeLiteralNode): void {
      for (let member of typeNode.members) {
        switch (member.kind) {
          case ts.SyntaxKind.PropertySignature:
            this.getTypeReferenceNodeByPropertySignatureNodeAndSearch(<ts.PropertySignature>member);
            break;
  
          case ts.SyntaxKind.IndexSignature:
            this.getTypeReferenceNodeByIndexSignatureNodeAndSearch(<ts.IndexSignatureDeclaration>member);
            break;
  
          case ts.SyntaxKind.MethodSignature:
          case ts.SyntaxKind.ConstructSignature:
          case ts.SyntaxKind.CallSignature:
            this.getTypeReferenceNodeByMethodSignatureOrConstructSignatureOrCallSignatureNodeAndSearch(<ts.MethodSignature | ts.ConstructSignatureDeclaration | ts.CallSignatureDeclaration>member);
            break;
        }
      }
    }
  
    getTypeReferenceNodeByPropertySignatureNodeAndSearch(typeNode: ts.PropertySignature): void {
      this.getTypeReferenceNodeAndSearch(typeNode.type);
    }
  
    getTypeReferenceNodeByIndexSignatureNodeAndSearch(typeNode: ts.IndexSignatureDeclaration): void {
      this.getTypeReferenceNodeAndSearch(typeNode.type);
  
      for (let parameter of typeNode.parameters) {
        this.getTypeReferenceNodeAndSearch(parameter.type);
      }
  
      this.getTypeReferenceNodeByTypeParametersAndSearch(typeNode.typeParameters);
    }
  
    getTypeReferenceNodeByMethodSignatureOrConstructSignatureOrCallSignatureNodeAndSearch(typeNode: ts.MethodSignature | ts.ConstructSignatureDeclaration | ts.CallSignatureDeclaration): void {
      for (let parameter of typeNode.parameters) {
        this.getTypeReferenceNodeAndSearch(parameter.type);
      }
  
      this.getTypeReferenceNodeAndSearch(typeNode.type);
    }
  
    getTypeReferenceNodeByConditionalTypeNodeAndSearch(typeNode: ts.ConditionalTypeNode): void {
      this.getTypeReferenceNodeAndSearch(typeNode.checkType);
  
      this.getTypeReferenceNodeAndSearch(typeNode.extendsType);
  
      this.getTypeReferenceNodeAndSearch(typeNode.trueType);
  
      this.getTypeReferenceNodeAndSearch(typeNode.falseType);
    }
  
    getTypeReferenceNodeByTupleTypeNodeAndSearch(typeNode: ts.TupleTypeNode): void {
      for (let elementType of typeNode.elementTypes) {
        this.getTypeReferenceNodeAndSearch(elementType);
      }
    }
  
    getTypeReferenceNodeByIndexedAccessTypeNodeAndSearch(typeNode: ts.IndexedAccessTypeNode): void {
      this.getTypeReferenceNodeAndSearch(typeNode.objectType);
  
      this.getTypeReferenceNodeAndSearch(typeNode.indexType);
    }

    getTypeReferenceNodeByMappedTypeNodeAndSearch(typeNode: ts.MappedTypeNode): void {
      this.getTypeReferenceNodeAndSearch(typeNode.type);

      this.getTypeReferenceNodeAndSearch(typeNode.typeParameter.constraint);
    }

    getTypeReferenceNodeByFunctionTypeOrConstructorTypeNodeAndSearch(typeNode: ts.FunctionTypeNode | ts.ConstructorTypeNode): void {
      this.getTypeReferenceNodeAndSearch(typeNode.type);

      for (let parameter of typeNode.parameters) {
        this.getTypeReferenceNodeAndSearch(parameter.type);
      }
    }
  
    getTypeReferenceNodeByTypeParametersAndSearch(typeParameters: ts.NodeArray<ts.TypeParameterDeclaration> | undefined): void {
      if (typeParameters) {
        for (let typeParameter of typeParameters) {
          this.getTypeReferenceNodeAndSearch(typeParameter.constraint);
  
          this.getTypeReferenceNodeAndSearch(typeParameter.default);
        }
      }
    }
  
    getTypeReferenceNodeByMethodDeclarationAndSearch(node: ts.MethodDeclaration): void {
      if (node.type) {
        this.getTypeReferenceNodeAndSearch(node.type);
      }
  
      for (let parameter of node.parameters) {
        this.getTypeReferenceNodeAndSearch(parameter.type);
      }
  
      this.getTypeReferenceNodeByTypeParametersAndSearch(node.typeParameters);
    }
  
    getTypeReferenceNodeByConstructorDeclarationAndSearch(node: ts.ConstructorDeclaration): void {
      for (let parameter of node.parameters) {
        this.getTypeReferenceNodeAndSearch(parameter.type);
      }

      this.getTypeReferenceNodeByTypeParametersAndSearch(node.typeParameters);
    }

    getTypeReferenceNodeByGetAccessorAndSearch(node: ts.GetAccessorDeclaration): void {
      if (node.type) {
        this.getTypeReferenceNodeAndSearch(node.type);
      }

      for (let parameter of node.parameters) {
        this.getTypeReferenceNodeAndSearch(parameter.type);
      }

      this.getTypeReferenceNodeByTypeParametersAndSearch(node.typeParameters);
    }

    getTypeReferenceNodeBySetAccessorAndSearch(node: ts.SetAccessorDeclaration): void {
      // TODO
      console.log('getTypeReferenceNodeBySetAccessorAndSearch: need to TODO');
    }

    search(nodes: Node[]): [ts.Symbol[], ts.Node[]] {
      for (let node of nodes) {
        this.addSymbolByNodeAndSearch(node.compilerNode as unknown as ts.Node);
      }

      return [Array.from(this.symbolToIfRecursiveResolvedMap.keys()), Array.from(this.nodeSet)];
    }
  }

  export function findSymbols(nodes: Node[], project: Project): [ts.Symbol[], ts.Node[]] {
    return new SymbolSearcher(project).search(nodes);
  }
}
