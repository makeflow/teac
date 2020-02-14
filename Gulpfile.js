// @ts-check
const newer = require("gulp-newer");
const del = require("del");
const fold = require("travis-fold");
const rename = require("gulp-rename");
const { src, dest, task, parallel, series, watch } = require("gulp");
const { append } = require("gulp-insert");
const { exec, needsUpdate } = require("./scripts/build/utils");
const { buildProject, cleanProject, watchProject } = require("./scripts/build/projects");
const cmdLineOptions = require("./scripts/build/options");

const cleanTasks = [];

const buildScripts = () => buildProject("scripts");
const cleanScripts = () => cleanProject("scripts");
cleanTasks.push(cleanScripts);

const diagnosticInformationMapTs = "src/compiler/diagnosticInformationMap.generated.ts";
const diagnosticMessagesJson = "src/compiler/diagnosticMessages.json";
const diagnosticMessagesGeneratedJson = "src/compiler/diagnosticMessages.generated.json";
const generateDiagnostics = async () => {
    if (needsUpdate(diagnosticMessagesJson, [diagnosticMessagesGeneratedJson, diagnosticInformationMapTs])) {
        await exec(process.execPath, ["scripts/processDiagnosticMessages.js", diagnosticMessagesJson]);
    }
};
task("generate-diagnostics", series(buildScripts, generateDiagnostics));
task("generate-diagnostics").description = "Generates a diagnostic file in TypeScript based on an input JSON file";

const cleanDiagnostics = () => del([diagnosticInformationMapTs, diagnosticMessagesGeneratedJson]);
cleanTasks.push(cleanDiagnostics);

const watchDiagnostics = () => watch(["src/compiler/diagnosticMessages.json"], task("generate-diagnostics"));

const buildShims = () => buildProject("src/shims");
const cleanShims = () => cleanProject("src/shims");
cleanTasks.push(cleanShims);

// Pre-build steps when targeting the LKG compiler
const lkgPreBuild = series(buildScripts, generateDiagnostics, buildShims);

const buildTeac = series(
    () => buildProject("src/teac"),
    () => src("built/local/teac.out.d.ts").pipe(newer("built/local/teac.d.ts")).pipe(append("\nexport = Teac;")).pipe(rename("teac.d.ts")).pipe(dest("built/local")),
    () => src("built/local/teac.out.js").pipe(newer("built/local/teac.js")).pipe(rename("teac.js")).pipe(dest("built/local"))
);
task("teac", series(lkgPreBuild, buildTeac));
task("teac").description = "Builds the teac lib";

const cleanTeac = () => cleanProject("src/teac");
cleanTasks.push(cleanTeac);
task("clean-teac", cleanTeac);
task("clean-teac").description = "Cleans outputs for the teac lib";

const watchTeac = () => watchProject("src/teac");
task("watch-teac", series(lkgPreBuild, parallel(watchDiagnostics, watchTeac)));
task("watch-teac").description = "Watch for changes and rebuild the teac lib only.";

const buildTeacli = () => buildProject("src/teacli");
task("teacli", series(lkgPreBuild, buildTeacli));
task("teacli").description = "Builds the command-line extracter";

const cleanTeacli = () => cleanProject("src/teacli");
cleanTasks.push(cleanTeacli);
task("clean-teacli", cleanTeacli);
task("clean-teacli").description = "Cleans outputs for the command-line extracter";

const watchTeacli = () => watchProject("src/teacli");
task("watch-teacli", watchTeacli);
task("watch-teacli").description = "Watch for changes and rebuild the command-line extracter only.";

// Pre-build steps when targeting the built/local compiler.
const localPreBuild = series(buildScripts, generateDiagnostics, buildShims, buildTeac, buildTeacli);

// Pre-build steps to use based on supplied options.
const preBuild = cmdLineOptions.lkg ? lkgPreBuild : localPreBuild;

const watchServices = () => watch([
    "src/compiler/tsconfig.json",
    "src/compiler/**/*.ts",
    "src/jsTyping/tsconfig.json",
    "src/jsTyping/**/*.ts",
    "src/services/tsconfig.json",
    "src/services/**/*.ts",
], series(preBuild));
task("watch-services", series(preBuild, parallel(watchDiagnostics, watchServices)));
task("watch-services").description = "Watches for changes and rebuild language service only";
task("watch-services").flags = {
    "   --built": "Compile using the built version of the compiler."
};

task("min", series(preBuild, parallel(buildTeac, buildTeacli)));
task("min").description = "Builds only tsc and tsserver";
task("min").flags = {
    "   --built": "Compile using the built version of the compiler."
};

task("clean-min", series(cleanTeac, cleanTeacli));
task("clean-min").description = "Cleans outputs for tsc and tsserver";

task("watch-min", series(preBuild, parallel(watchDiagnostics, watchTeac, watchTeacli)));
task("watch-min").description = "Watches for changes to a tsc and tsserver only";
task("watch-min").flags = {
    "   --built": "Compile using the built version of the compiler."
};

const cleanTypesMap = () => del("built/local/typesMap.json");
cleanTasks.push(cleanTypesMap);

const buildFoldStart = async () => { if (fold.isTravis()) console.log(fold.start("build")); };
const buildFoldEnd = async () => { if (fold.isTravis()) console.log(fold.end("build")); };
task("local", series(buildFoldStart, preBuild, parallel(buildTeac, buildTeacli), buildFoldEnd));
task("local").description = "Builds the full compiler and services";
task("local").flags = {
    "   --built": "Compile using the built version of the compiler."
};

task("watch-local", series(preBuild, parallel(watchDiagnostics, watchTeac, watchTeacli, watchServices)));
task("watch-local").description = "Watches for changes to projects in src/ (but does not execute tests).";
task("watch-local").flags = {
    "   --built": "Compile using the built version of the compiler."
};

const buildImportDefinitelyTypedTests = () => buildProject("scripts/importDefinitelyTypedTests");
const cleanImportDefinitelyTypedTests = () => cleanProject("scripts/importDefinitelyTypedTests");
cleanTasks.push(cleanImportDefinitelyTypedTests);

// TODO(rbuckton): Should the path to DefinitelyTyped be configurable via an environment variable?
const importDefinitelyTypedTests = () => exec(process.execPath, ["scripts/importDefinitelyTypedTests/importDefinitelyTypedTests.js", "./", "../DefinitelyTyped"]);
task("importDefinitelyTypedTests", series(buildImportDefinitelyTypedTests, importDefinitelyTypedTests));
task("importDefinitelyTypedTests").description = "Runs the importDefinitelyTypedTests script to copy DT's tests to the TS-internal RWC tests";

const cleanBuilt = () => del("built");

task("clean", series(parallel(cleanTasks), cleanBuilt));
task("clean").description = "Cleans build outputs";

task("watch", series(preBuild, parallel(watchDiagnostics, watchServices)));
task("watch").description = "Watches for changes and rebuilds and runs tests in parallel.";
task("watch").flags = {
    "-t --tests=<regex>": "Pattern for tests to run. Forces tests to be run in a single worker.",
    "   --failed": "Runs tests listed in '.failed-tests'. Forces tests to be run in a single worker.",
    "-r --reporter=<reporter>": "The mocha reporter to use.",
    "   --keepFailed": "Keep tests in .failed-tests even if they pass",
    "   --light": "Run tests in light mode (fewer verifications, but tests run faster)",
    "   --dirty": "Run tests without first cleaning test output directories",
    "   --stackTraceLimit=<limit>": "Sets the maximum number of stack frames to display. Use 'full' to show all frames.",
    "   --no-color": "Disables color",
    "   --no-lint": "Disables lint",
    "   --timeout=<ms>": "Overrides the default test timeout.",
    "   --workers=<number>": "The number of parallel workers to use.",
    "   --built": "Compile using the built version of the compiler.",
};

task("default", series("local"));
task("default").description = "Runs 'local'";

task("help", () => exec("gulp", ["--tasks", "--depth", "1", "--sort-tasks"], { hidePrompt: true }));
task("help").description = "Prints the top-level tasks.";
