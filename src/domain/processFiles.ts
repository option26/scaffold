/* eslint-disable no-await-in-loop */
/* eslint-disable no-continue */
/* eslint-disable no-restricted-syntax */
import { TemplateConfig } from 'models/TemplateConfig';
import fs from 'fs/promises';
import nunjucks from 'nunjucks';
import { isMatch as globMatch } from 'micromatch';
import { isText } from 'istextorbinary';

/**
 * This function processes every file of the source directory (recursively).
 *
 * It first checks wether the file is excluded. If not, it will check wether the filename has template syntax and computes the final file name if so.
 * Next, it checks wether the file is a text file or binary file. If it is a binary, it will just copy the file to the (processed) filename.
 * If the file is text, it will check wether the file is in the ignored list. If so, it will just copy the file.
 * Otherwise, it will render the contents using nunjucks taking the user inputs into account. Then it writes the final file to the (processed) filename.
 *
 * @param sourceDir Directory to recursively process
 * @param targetDir Directory to copy (processed) files to
 * @param templateConfig The template config of the scaffolded project
 * @param userConfig The user input of all project variables
 */
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
      templateConfig.exclude.some((excludePath) =>
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
        templateConfig.ignore.some((ignorePath) =>
          globMatch(sourceFilePath, ignorePath),
        )
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

export default processFiles;
