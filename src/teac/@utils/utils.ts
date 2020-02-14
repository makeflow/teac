namespace Teac {
  type Project = import('ts-morph').Project;
  type FormatCodeSettings = import('ts-morph').FormatCodeSettings;
  const Path: typeof import('path') = require('path');

  export const EXTENSION_REGEX = /(?:\.d)?\.[^/\\.]+$/;

  export const FORMAT_CODE_SETTINGS: FormatCodeSettings = {
    indentSize: 0,
    convertTabsToSpaces: true,
    tabSize: 0,
    newLineCharacter: '',
    insertSpaceAfterCommaDelimiter: false,
    insertSpaceAfterSemicolonInForStatements: false,
    insertSpaceBeforeAndAfterBinaryOperators: false,
    insertSpaceAfterConstructor: false,
    insertSpaceAfterKeywordsInControlFlowStatements: false,
    insertSpaceAfterFunctionKeywordForAnonymousFunctions: false,
    insertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis: false,
    insertSpaceAfterOpeningAndBeforeClosingNonemptyBrackets: false,
    insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces: false,
    insertSpaceAfterOpeningAndBeforeClosingTemplateStringBraces: false,
    insertSpaceAfterOpeningAndBeforeClosingJsxExpressionBraces: false,
    insertSpaceAfterTypeAssertion: false,
    insertSpaceBeforeFunctionParenthesis: false,
    insertSpaceBeforeTypeAnnotation: false,
    indentMultiLineObjectLiteralBeginningOnBlankLine: false
  };

  function trimLeftParentPath(path: string): string {
    return path.replace(/(?:\.{2}[\\/])/g, '');
  }
  
  /**
   * @param fileName absolute path
   * @param projectPath absolute path
   */
  export function isInternal(fileName: string, projectPath: string): boolean {
    return fileName.startsWith(projectPath);
  }

  export function dotPathJoin(path: string): string {
    return path.startsWith(`..${Path.sep}`)
      ? `'${path}'`
      : `'.${Path.sep}${path}'`;
  }

  /**
   * @param fileName file path relative to the project path.
   */
  export function mapExternalFileNameToInternalFileName(fileName: string): string {
    if (!fileName.startsWith('.')) {
      return fileName;
    } else {
      if (fileName.startsWith('..') && /node_modules/.test(fileName)) {
        let pathParts = fileName.split('node_modules');
        return `.${Path.sep}node_modules${pathParts[pathParts.length - 1]}`;
      }

      fileName = trimLeftParentPath(fileName);
  
      if (fileName.startsWith('node_modules')) {
        return fileName;
      } else {
        return Path.join('__shared', fileName);
      }
    }
  }

  
  export function formatCode(project: Project, fileNames: string[]): void {
    for (let fileName of fileNames) {
      let sourceFile = project.getSourceFile(fileName)!;

      sourceFile.formatText(FORMAT_CODE_SETTINGS);
    }
  }

}