/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable no-bitwise */

import fs from 'fs/promises';
import { constants as FsConstants } from 'fs';
import nunjucks from 'nunjucks';
import path from 'path';
import { TemplateConfig } from 'models/TemplateConfig';
import getUserInput from './getUserInput';
import cleanupTarget from './cleanupTarget';
import processFiles from './processFiles';

const defaultIgnoreList = ['template.json'];
const defaultExcludeList = ['**/.git', '**/node_modules'];

/**
 * This is the main processing function.
 *
 * First, it will try to locate the template config file and abort if it can't be found.
 * Next, it will start gathering the user input based on the variable section in the template config.
 * Afterwards, it does a final parsing step of the template config itself to fix issues and resolve any template syntax used in the config.
 * It will then start to process each file in the source directory (recursively) and apply all template transformations on them
 * Finally, it will preform all the cleanup steps in the target directory and the source directory (if necessary)
 *
 * @param sourceDir Absolute path to source directory
 * @param targetDir Absolute path to target directory
 * @param deleteSourceDir Wether the source directory should be deleted in the end
 */
async function processTemplate(
  sourceDir: string,
  targetDir: string,
  deleteSourceDir: boolean,
) {
  const templateConfigPath = `${sourceDir}/template.json`;

  // Check if template config file exists
  try {
    await fs.access(templateConfigPath, FsConstants.F_OK | FsConstants.R_OK);
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

  // Read user input (fill user config)
  const userConfig = await getUserInput(templateConfig.variables);

  // Parse template config (fix missing, add defaults, resolve template syntax)
  templateConfig = await parseTemplateConfig(
    templateConfig,
    sourceDir,
    targetDir,
    userConfig,
  );

  // Process files (copy and resolve template syntax)
  console.info('----------- Input complete, scaffolding now -----------');
  await processFiles(sourceDir, targetDir, templateConfig, userConfig);

  // Clean up target (remove files based on user inputs)
  console.info('----------- Cleanup -----------');
  cleanupTarget(templateConfig.cleanup, userConfig);

  // Clean up source (if required)
  if (deleteSourceDir) {
    console.info('Removing temporary source directory:', sourceDir);
    await fs.rm(sourceDir, { recursive: true, force: true });
  }
}

export default processTemplate;

/**
 * This function parses the template config itself.
 *
 * This is necessary for several reasons:
 * - The config might have an invalid syntax (missing values) which needs fixing for further processing
 * - The config might need to be extended with default values
 * - The config may contain template syntax itself that ahs to be resolved once the user input is gathered
 * - The config may contain relative paths that need to be resolved
 *
 * @param templateConfig The original template config
 * @returns The parsed template config
 */
async function parseTemplateConfig(
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

  // Extend with default values

  outConfig.ignore = [...outConfig.ignore, ...defaultIgnoreList];
  outConfig.exclude = [...templateConfig.exclude, ...defaultExcludeList];

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
