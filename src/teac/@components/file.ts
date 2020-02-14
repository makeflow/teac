namespace Teac {
  type Project = import('ts-morph').Project;
  type Node = import('ts-morph').Node;

  const FS: typeof import('fs') = require('fs');
  const _: typeof import('lodash') = require('lodash');
  const Path: typeof import('path') = require('path');

  const TYPESCRIPT_INTERNAL_FILENAME_REGEXP = /node_modules[\\/]typescript/;

  function writeFile(path: string, content: string): void {
    FS.mkdirSync(Path.dirname(path), {recursive: true});
    FS.writeFileSync(path, content);
  }

  function getCorrespondingPackageJSONFile(path: string): string | undefined {
    while (true) {
      let directoryPath = Path.dirname(path);

      if (/node_moduels$/.test(directoryPath) || directoryPath === path) {
        return undefined;
      }

      for (let fileName of FS.readdirSync(directoryPath)) {
        let filePath = Path.join(directoryPath, fileName);

        if (FS.statSync(filePath).isFile() && /package\.json$/.test(filePath)) {
          return filePath;
        }
      }

      path = directoryPath;
    }
  }

  function getConvertedFilePath(filePath: string, projectPath: string, outputPath: string): string {
    let path: string;

    if (TYPESCRIPT_INTERNAL_FILENAME_REGEXP.test(filePath)) {
      let paths = filePath.split(TYPESCRIPT_INTERNAL_FILENAME_REGEXP);
      path = Path.join(outputPath, 'node_modules', 'typescript', paths[paths.length - 1]);
    } else {
      path = Path.join(
        outputPath,
        mapExternalFileNameToInternalFileName(
          Path.relative(projectPath, filePath),
        ),
      );
    }

    return path;
  }

  function sortNodes(node: Node): string {
    if (node.getKind() === 1 /** kind of EndOfFileToken */) {
      return '';
    }

    let nodeToTextMap: Map<Node, string> = new Map();
    
    node.forEachChild(accumulate);

    let nodeAndTextList = Array.from(nodeToTextMap).sort((a, b) => a[1].localeCompare(b[1]));

    for (let i=0; i<nodeAndTextList.length; ++i) {
      (<any>nodeAndTextList[i][0]).setOrder(i);
    }

    node.formatText(FORMAT_CODE_SETTINGS);

    return node.getText();

    function accumulate(node: Node): void {
      let text = sortNodes(node);

      if ('setOrder' in node) {
        nodeToTextMap.set(node, text);
      }
    }
  }

  export function writeCodeToFile(
    project: Project,
    fileNames: string[],
    projectPath: string,
    outputPath: string,
  ): void {
    for (let fileName of fileNames) {
      let packageJSONFilePath = getCorrespondingPackageJSONFile(fileName);

      if (packageJSONFilePath) {
        writeFile(getConvertedFilePath(packageJSONFilePath, projectPath, outputPath), FS.readFileSync(packageJSONFilePath).toString());
      }

      writeFile(getConvertedFilePath(fileName, projectPath, outputPath), project.getSourceFile(fileName)!.getText());
    }
  }

  export function writeCodeToSnapshot(
    project: Project,
    fileNames: string[],
    projectPath: string,
    outputPath: string,
  ): string {
    let snapshotFileName = Path.join(outputPath, `snapshot-${new Date().toLocaleString().replace(/[:\s]/g, '-')}`);
    let snapshotString = fileNames.map(
      fileName => {
        let relativePath = Path.relative(projectPath, fileName);
        let sourceFile = project.getSourceFile(fileName)!
        sortNodes(sourceFile);
        return `${relativePath}\n${sourceFile.getText()}`;
      })
      .join('\n');

    writeFile(snapshotFileName, snapshotString);

    return snapshotFileName;
  }
}
