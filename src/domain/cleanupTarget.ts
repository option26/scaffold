/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
import { TemplateConfig } from 'models/TemplateConfig';
import fs from 'fs/promises';

/**
 * This is the final step of the processing flow. It will remove specific files from the target directory based on some rules.
 *
 * We will iterate over every entry in the cleanup section of the template config.
 * For each entry, we check if the condition for removing the paths is met by checking against the user inputs.
 * If the condition is met, we delete every file specified in the 'paths' attribute (recursively)
 *
 * @param cleanup The cleanup section of the template config
 * @param userConfig The user input to the variables
 */
async function cleanupTarget(
  cleanup: TemplateConfig['cleanup'],
  userConfig: any,
) {
  for (const entry of cleanup) {
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

export default cleanupTarget;
