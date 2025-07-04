import type { Model } from '../language/generated/ast.js';
import chalk from 'chalk';
import { Command } from 'commander';
import { ReelLanguageMetaData } from '../language/generated/module.js';
import { createReelServices } from '../language/reel-module.js';
import { extractAstNode } from './cli-util.js';
import { generateJSON } from './generator.js';
import { NodeFileSystem } from 'langium/node';
import * as url from 'node:url';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

const packagePath = path.resolve(__dirname, '..', '..', 'package.json');
const packageContent = await fs.readFile(packagePath, 'utf-8');

export const generateAction = async (fileName: string, opts: GenerateOptions): Promise<void> => {
    const services = createReelServices(NodeFileSystem).Reel;
    const modelList = await extractAstNode<Model>(fileName, services);
    const mainModel = modelList[0];
    // slice other models if there are more than one
    const otherModel = modelList.slice(1)
    const generatedFilePath = generateJSON(mainModel,otherModel, fileName, opts.destination);
    console.log(chalk.green(`JSON generated successfully: ${generatedFilePath}`));
};

export type GenerateOptions = {
    destination?: string;
}

export default function(): void {
    const program = new Command();

    program.version(JSON.parse(packageContent).version);

    const fileExtensions = ReelLanguageMetaData.fileExtensions.join(', ');
    program
        .command('generate')
        .argument('<file>', `source file (possible file extensions: ${fileExtensions})`)
        .option('-d, --destination <dir>', 'destination directory of generating')
        .description('generates JSON Reel code from the given file')
        .action(generateAction);

    program.parse(process.argv);
}
