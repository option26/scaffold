#! /usr/bin/env node
/* eslint-disable no-continue */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-bitwise */
import yargs from 'yargs';
import inquirer, { QuestionCollection } from 'inquirer';
import { hideBin } from 'yargs/helpers';
import git from 'simple-git';
import { v4 as uuid } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import { constants } from 'fs';
import nunjucks from 'nunjucks';
import { isText } from 'istextorbinary';
import { isMatch as globMatch } from 'micromatch';

import { PromptEntry, TemplateConfig } from './models/TemplateConfig';

const excludeList = ['**/.git', '**/node_modules'];
const internalValues = { template: '' };

async function processTemplateConfig(
  templateConfig: TemplateConfig,
  sourceDir: string,
  targetDir: string,
  userConfig: any,
): Promise<TemplateConfig> {
  const outConfig: TemplateConfig = {
    name: templateConfig.name || '',
    description: templateConfig.name || '',
    exclude: templateConfig.exclude || [],
    ignore: templateConfig.ignore || [],
    cleanup: templateConfig.cleanup || [],
    variables: templateConfig.variables || [],
  };

  // Prevent template config from being copied to target
  outConfig.ignore = [...outConfig.ignore, 'template.json'];

  // Resolve relative paths for all specified files
  outConfig.ignore = outConfig.ignore.reduce<string[]>((result, filePath) => {
    const parsedFilePath = nunjucks.renderString(filePath, userConfig);
    const resolvedPath = path.resolve(sourceDir, parsedFilePath);

    // Ignore files that would be are outside the source directory
    if (!resolvedPath.startsWith(sourceDir)) {
      return result;
    }
    return [...result, resolvedPath];
  }, []);

  outConfig.exclude = outConfig.exclude.reduce<string[]>((result, filePath) => {
    const parsedFilePath = nunjucks.renderString(filePath, userConfig);
    const resolvedPath = path.resolve(sourceDir, parsedFilePath);

    // Ignore files that would be are outside the source directory
    if (!resolvedPath.startsWith(sourceDir)) {
      return result;
    }
    return [...result, resolvedPath];
  }, []);

  outConfig.cleanup = outConfig.cleanup.map((element) => {
    const outElement = { ...element };

    outElement.paths = outElement.paths.reduce<string[]>((result, filePath) => {
      const parsedFilePath = nunjucks.renderString(filePath, userConfig);
      const resolvedPath = path.resolve(targetDir, parsedFilePath);

      // Ignore files that would be are outside the source directory
      if (!resolvedPath.startsWith(targetDir)) {
        return result;
      }
      return [...result, resolvedPath];
    }, []);

    return outElement;
  }, []);

  return outConfig;
}

async function processFiles(
  sourceDir: string,
  targetDir: string,
  templateConfig: TemplateConfig,
  userConfig: any,
) {
  const baseFiles = await fs.readdir(sourceDir);

  for (const fileName of baseFiles) {
    const sourceFilePath = `${sourceDir}/${fileName}`;

    // Don't process excluded files
    if (
      [...templateConfig.exclude, ...excludeList].some((excludePath) =>
        globMatch(sourceFilePath, excludePath),
      )
    ) {
      console.info('Exclude file', sourceFilePath);
      continue;
    }

    console.info('Processing file', sourceFilePath);

    // Process file name
    const parsedFileName = nunjucks.renderString(fileName, userConfig);
    const targetFilePath = `${targetDir}/${parsedFileName}`;

    // Get stats about the current file
    const stats = await fs.stat(sourceFilePath);

    if (stats.isFile()) {
      // Check if file is text file
      const fileBuffer = await fs.readFile(sourceFilePath);
      if (!isText(sourceFilePath, fileBuffer)) {
        // No text file, simply copy
        await fs.writeFile(targetFilePath, fileBuffer);
        continue;
      }

      // Process file, then write to target directory
      const contents = fileBuffer.toString('utf-8');

      let parsedContents: string;
      if (
        templateConfig.ignore.some((ignorePath) => globMatch(sourceFilePath, ignorePath))
      ) {
        console.info(
          'File was copied but not processed (part of ignored files)',
        );
        parsedContents = contents;
      } else {
        parsedContents = nunjucks.renderString(contents, userConfig);
      }

      await fs.writeFile(targetFilePath, parsedContents, 'utf8');
    } else if (stats.isDirectory()) {
      await fs.mkdir(targetFilePath);

      // Recursive call
      await processFiles(
        sourceFilePath,
        targetFilePath,
        templateConfig,
        userConfig,
      );
    }
  }
}

async function cleanUp(templateConfig: TemplateConfig, userConfig: any) {
  for (const entry of templateConfig.cleanup) {
    if (userConfig[entry.name] === entry.value) {
      for (const filePath of entry.paths) {
        try {
          console.info(
            `Removing file ${filePath} because variable '${entry.name}' has value '${entry.value}'`,
          );
          await fs.rm(filePath, { recursive: true, force: true });
        } catch (err) {
          console.warn('Unable to delete file', filePath);
        }
      }
    }
  }
}

async function preprocessVariables(
  variables: TemplateConfig['variables'],
): Promise<QuestionCollection<any>> {
  const questions = variables.map((entry) => {
    if (entry.name === 'template') {
      throw new Error(
        'Bad parameter. Variable name "template" is reserved, please use a different name',
      );
    }

    let validate: ((input: any) => boolean) | undefined;
    if (entry.validation) {
      switch (true) {
        case entry.validation.regex !== undefined:
          validate = (input: string) =>
            new RegExp(entry.validation!.regex).test(input);
          break;
        default:
          break;
      }
    }

    let when: ((state: any) => boolean) | undefined;
    if (entry.promptIf) {
      if (Array.isArray(entry.promptIf)) {
        when = (state: any) => {
          const promptEntry = entry.promptIf! as Array<PromptEntry>;
          return promptEntry.every(({ name, value }) => state[name] === value);
        };
      } else {
        when = (state: any) => {
          const promptEntry = entry.promptIf! as PromptEntry;
          return state[promptEntry.name] === promptEntry.value;
        };
      }
    }

    return {
      type: entry.type,
      name: entry.name,
      message: entry.prompt,
      default: entry.default,
      choices: entry.choices,
      validate,
      when,
    };
  });

  return questions;
}

async function processTemplate(sourceDir: string, targetDir: string) {
  const templateConfigPath = `${sourceDir}/template.json`;
  // Try to locate template setup file
  try {
    await fs.access(templateConfigPath, constants.F_OK | constants.R_OK);
  } catch (err) {
    console.error('Unable to locate template config:', templateConfigPath);
    process.exit(1);
  }

  // Read template config file
  let templateConfig: TemplateConfig = JSON.parse(
    await fs.readFile(templateConfigPath, 'utf-8'),
  );

  // Process template config
  console.info('----------- Initializing template -----------');
  console.info(`Name: ${templateConfig.name}`);
  console.info(`Description: ${templateConfig.description}`);

  // Get user input
  let questions;
  try {
    questions = await preprocessVariables(templateConfig.variables);
  } catch (err) {
    console.error('Unable to process variables:', err);
    process.exit(1);
  }
  let userConfig = await inquirer.prompt(questions); // Get user data
  userConfig = { ...userConfig, ...internalValues }; // If necessary, override internal values
  console.info('----------- Input complete, scaffolding now -----------');

  // Parse template config
  templateConfig = await processTemplateConfig(
    templateConfig,
    sourceDir,
    targetDir,
    userConfig,
  );

  // Process files
  await processFiles(sourceDir, targetDir, templateConfig, userConfig);

  // Clean Up
  console.info('----------- Cleanup -----------');
  cleanUp(templateConfig, userConfig);
}

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
  const [source, target] = positionalArgs as [string, string];

  // Determine if we need to clone a git repo
  let sourceDir: string;
  const targetDir = path.resolve(process.cwd(), target);

  let cleanSource: boolean = false;
  if (source.startsWith('https://')) {
    // Clone to temporary directory
    const tmpDir = `/tmp/${uuid()}`;
    console.info(`Downloading template code from ${source} to ${tmpDir}`);

    try {
      await git().clone(source, tmpDir);
      sourceDir = tmpDir;
    } catch (err) {
      console.error('An error occurred while downloading the template:', err);
      process.exit(1);
    }

    cleanSource = true;
  } else {
    // Resolve path if relative
    sourceDir = path.resolve(process.cwd(), source);
  }

  // Check if directories are valid
  try {
    await fs.access(sourceDir, constants.F_OK | constants.R_OK);
  } catch (err) {
    console.error('Unable to open source directory @', sourceDir);
    process.exit(1);
  }

  try {
    await fs.access(targetDir, constants.F_OK | constants.W_OK);
  } catch (err) {
    console.error('Unable to open target directory @', sourceDir);
    process.exit(1);
  }

  const targetDirFileCount = await fs.readdir(targetDir).then((f) => f.length);
  if (targetDirFileCount > 0) {
    console.error('Target directory is not empty! Aborting...');
    process.exit();
  }

  // Start processing
  await processTemplate(sourceDir, targetDir);

  // Cleanup if required
  if (cleanSource) {
    console.info('Removing temporary source directory:', sourceDir);
    await fs.rm(sourceDir, { recursive: true, force: true });
  }
}

main();
