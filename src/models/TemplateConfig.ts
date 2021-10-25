export interface TemplateConfig {
    name: string;
    description: string;
    exclude: string[]; // List of paths to be excluded (not copied)
    ignore: string[]; // List of paths to be ignored (not parsed but copied)
    cleanup: Array<{
        name: string,
        value: any,
        paths: string[] // List of paths that will be deleted if 'name' matches value
    }>;
    variables: Array<{
        type: string;
        name: string;
        prompt: string;
        default: any;
        promptIf?: { name: string, value: any };
        validation?: { regex: string };
        choices?: any[];
    }>;
}
