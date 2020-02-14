/// <reference path="@components/node.ts" />
/// <reference path="@components/symbol.ts" />
/// <reference path="@components/tree-shaking.ts" />
/// <reference path="@components/module-specifier.ts" />
/// <reference path="@components/file.ts" />

namespace Teac {
  type Project = import('ts-morph').Project;
  const {Project}: typeof import('ts-morph') = require('ts-morph');

  export interface TeacConfig {
    entryFilePath: string;
    projectPath: string;
    optionsPath: string;
    outputPath: string;
    typeNames: string[];
  }

  function process(config: TeacConfig): [Project, string[]] {
    const {entryFilePath, optionsPath, projectPath, typeNames} = config;
    let project = new Project({
      tsConfigFilePath: optionsPath,
      addFilesFromTsConfig: false,
    });

    project.addSourceFileAtPath(entryFilePath);
    project.resolveSourceFileDependencies();

    let sourceFile = project.getSourceFile(entryFilePath);

    if (sourceFile) {
      let nodesToSearch = findNodes(typeNames, sourceFile);
      let [symbols, nodes] = findSymbols(nodesToSearch, project);
      let fileNames = treeShake(symbols, nodes, projectPath, entryFilePath, project);

      return [project, fileNames];
    } else {
      throw new Error('The entry file not found.');
    }
  }

  export function generateFiles(config: TeacConfig): void {
    let [project, fileNames] = process(config);

    convertModuleSpecifier(config.projectPath, project, fileNames);

    formatCode(project, fileNames);

    writeCodeToFile(project, fileNames, config.projectPath, config.outputPath);
  }

  export function generateSnapShot(config: TeacConfig): string {
    let [project, fileNames] = process(config);

    return writeCodeToSnapshot(project, fileNames, config.projectPath, config.outputPath);
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = Teac;
}