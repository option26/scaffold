# Option 26 – Scaffold

A command line utility that allows to scaffold new projects.

## Installation
Install the CLI with npm: `npm i -g @option26/scaffold`

## Usage
If you want to create a new project from a template, run the scaffold command: `scaffold [source] [target]`.

- `source` can either be a relative or absolute path the template in your file system or alternatively a URL to a git repository.
- `target` has to be a path (relative or absolute) to an empty folder in your filesystem.

### Usage Examples
```
scaffold https://github.com/option26/template.git .         // Clones the repository from 'https://github.com/option26/template.git' and scaffolds the project to the current directory.
scaffold template/directory /full/target/directory          // Scaffolds the project from a template located at $CWD/template/directory to '/full/target/directory'.
```

## Templating
In order to create a template, simply add a `template.json` file to the root of your template project directory. This files specifies all the information for the templating process.

### Template Config
The `template.json` file has the following structure:
```
{
    // Template name (shown when scaffolding project).
    name: string;
    // Template description (shown when scaffolding project).
    description: string;
    // List of paths to be excluded (i.e not copied) from the template. By default, .git and node_modules are excluded.
    exclude: string[];   
    // List of paths to be ignored (i.e. copied but not parsed). Useful if a file contains nunjucks syntax.
    ignore: string[];
    // For each entry, if variable 'name' has specified 'value', all 'paths' are deleted in the final project.
    cleanup: Array<{            
        name: string,
        value: any,
        paths: string[]
    }>;
    // List of variables that will be requested from the user. Follows structure of https://github.com/SBoudrias/Inquirer.js#readme
    variables: Array<{
        type: string;
        name: string;
        prompt: string;
        default: any;
        promptIf?: { name: string, value: any }; // Only as this, if variable 'name' equals 'value'
        validation?: { regex: string };
        choices?: any[];
    }>;
}
```

### Process
The scaffolding process works as follows
1. If the `source` is a git repository, clone it's content. Else, check if specified directory exists.
2. Check if `target` directory exists and is empty
3. Try to locate the `template.json` file in the source directory and read its contents
4. Gather user input based on the `variables` property of the template configuration
5. Iterate over each file/folder in the source directory and
   1. If the path is in the `exclude` array, skip this file/directory
   2. Else, parse the filename and fill template variables to determine output path (This is useful if you want to name files/folders based on user input)
   3. If the current path is in the `ignore` array, simply copy the file to the target
   4. Else, read the file content and fill template variables
   5. If the file was a folder, run the steps recursively
6. For each entry in the `cleanup` array, check if the condition is true and if so, remove all specified paths from the target directory.
7. If we cloned a template repository earlier, remove the temporary directory

### Template Structure
Scaffold uses the [nunjucks templating language](https://mozilla.github.io/nunjucks/) to process files and paths in a project template.

You can use templating inside file paths by simply naming the file with a valid nunjucks template string and the filename will be replaced later. This can also be done for the paths in `exclude`, `ignore` and `cleanup` in template config.

Inside files, you can use the default nunjucks syntax including control statements and alike.

The values passed to the nunjucks environment are based on the user input given earlier. As described, this can be configured by specifying entries in the `variables` property.

## Examples
TODO
