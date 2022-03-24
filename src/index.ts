#! /usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import prepareDirectories from 'domain/prepareDirectories';
import processTemplate from 'domain/processTemplate';

async function main() {
  // Parse command line arguments
  const rawArgs = await yargs(hideBin(process.argv))
    .usage('Usage: $0 [source] [target]')
    .example(
      '$0 /example/template .',
      'Creates a new project in the current directory, based on the template in "/example/template"',
    )
    .example(
      '$0 https://github.com/project target/directory',
      'Creates a new project in "target/directory/, based on the template in the git repository',
    )
    .help('h')
    .alias('h', 'help')
    .demandCommand(2).argv;

  const positionalArgs = rawArgs._;

  // Extract positional arguments
  const [sourceArg, targetArg] = positionalArgs as [string, string];

  // Validate arguments
  const { sourceDir, targetDir, deleteSourceDir } = await prepareDirectories(
    sourceArg,
    targetArg,
  );

  // Start processing
  await processTemplate(sourceDir, targetDir, deleteSourceDir);
}

main();
