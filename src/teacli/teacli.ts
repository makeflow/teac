namespace Teac {}

const Path: typeof import('path') = require('path');
const commander: typeof import('commander') = require('commander');

// eslint-disable-next-line @typescript-eslint/no-require-imports
const version = '0.1.0';

commander
  .version(version, '-v, --version')
  .option('-p, --project <project-path>', 'the path of tsconfig.json')
  .option(
    '-t, --type <typename>',
    'the type name that you want to search for',
    (val, arr) => {
      arr.push(val);
      return arr;
    },
    []
  )
  .option('-o, --output <output-path>', 'the path to output')
  .option('-s, --snapshot', 'just generate snapshot if true')
  .arguments('<filename>')
  .parse(process.argv);

if (!commander.output) {
  commander.output = commander.snapshot ? './output/snapshot' : './output';
}

if (commander.args.length === 1) {
  const optionsPath = Path.resolve(process.cwd(), commander.project);

  if (commander.snapshot) {
    Teac.generateSnapShot({
      entryFilePath: Path.resolve(process.cwd(), commander.args[0]),
      projectPath: Path.dirname(optionsPath),
      optionsPath,
      outputPath: Path.resolve(process.cwd(), commander.output),
      typeNames: commander.type,
    });
  } else {
    Teac.generateFiles({
      entryFilePath: Path.resolve(process.cwd(), commander.args[0]),
      projectPath: Path.dirname(optionsPath),
      optionsPath,
      outputPath: Path.resolve(process.cwd(), commander.output),
      typeNames: commander.type,
    });
  }
} else {
  console.error(`error: ${commander.args.length === 0 ? 'entry file missing' : 'the number of entry files exceed to 1'}`);
}
