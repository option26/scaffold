/* eslint-disable @typescript-eslint/no-use-before-define */

import inquirer, { QuestionCollection } from 'inquirer';
import { PromptEntry, TemplateConfig } from 'models/TemplateConfig';

const internalValues = { template: '' };

/**
 * This function uses the variable config from the scaffolded project config and queries the user for input to those variables.
 *
 * First, it will use the simplified variable syntax from the template config and parse it to be a valid 'inquirer' config.
 * Afterwards, it will run the inquirer lib with the parsed config and query the user for the variables.
 *
 * @param variables Simplified variable config from project template config
 * @returns A key:value object including the user input for the individual variables
 */
async function getUserInput(variables: TemplateConfig['variables']) {
  // Get user input
  let questions;
  try {
    // Convert config used in template config to actual inquirer format
    questions = await parseVariableConfig(variables);
  } catch (err) {
    console.error('Unable to process variables:', err);
    process.exit(1);
  }
  const userConfig = await inquirer.prompt(questions); // Get user data

  return { ...userConfig, ...internalValues }; // If necessary, override internal values
}

export default getUserInput;

/**
 * Parses the simplified variable config from the template config to the correct format expected by 'inquirer' lib.
 *
 * This also adds the functions that are required in order to validate variable input and to show questions conditionally.
 *
 * @param variables The raw variable config from the template config
 * @returns The parsed and expanded variable config for 'inquirer'
 */
async function parseVariableConfig(
  variables: TemplateConfig['variables'],
): Promise<QuestionCollection<any>> {
  const questions = variables.map((entry) => {
    if (entry.name === 'template') {
      throw new Error(
        'Bad parameter. Variable name "template" is reserved, please use a different name',
      );
    }

    // If set by the user, specify a validation function for the question (validate user input)
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

    // If set by the user, add a condition to the question (show only if condition is met)
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
