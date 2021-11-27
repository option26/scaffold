export interface CleanupEntry {
  name: string;
  value: any;
  paths: string[]; // List of paths that will be deleted if 'name' matches value
}

export interface PromptEntry {
  name: string;
  value: any;
}

export interface TemplateConfig {
  name: string;
  description: string;
  exclude: string[]; // List of paths to be excluded (not copied)
  ignore: string[]; // List of paths to be ignored (not parsed but copied)
  cleanup: Array<CleanupEntry>;
  variables: Array<{
    type: string;
    name: string;
    prompt: string;
    default: any;
    promptIf?: PromptEntry | Array<PromptEntry>;
    validation?: { regex: string };
    choices?: any[];
  }>;
}
