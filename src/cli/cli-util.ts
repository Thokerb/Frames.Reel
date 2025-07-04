import type { AstNode, LangiumCoreServices, LangiumDocument } from 'langium';
import chalk from 'chalk';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { URI } from 'langium';
import {Model} from "../language/generated/ast.js";

export async function extractDocument(fileName: string, services: LangiumCoreServices): Promise<Array<LangiumDocument>> {
    const extensions = services.LanguageMetaData.fileExtensions;
    if (!extensions.includes(path.extname(fileName))) {
        console.error(chalk.yellow(`Please choose a file with one of these extensions: ${extensions}.`));
        process.exit(1);
    }

    if (!fs.existsSync(fileName)) {
        console.error(chalk.red(`File ${fileName} does not exist.`));
        process.exit(1);
    }

    // const document = await services.shared.workspace.LangiumDocuments.getOrCreateDocument(URI.file(path.resolve(fileName)));
    // const model = document.parseResult.value as Model;
    //
    // let importedDocuments: Array<LangiumDocument> = [];
    //
    // if (model.fileImports) {
    //     importedDocuments = await Promise.all(model.fileImports.map(async (importedFile) => {
    //         const importPath = path.resolve(path.dirname(fileName), importedFile.file);
    //         return services.shared.workspace.LangiumDocuments.getOrCreateDocument(URI.file(importPath));
    //     }));
    // }

    var documents = await collectAllImportedDocuments(fileName, services)

    
    await services.shared.workspace.DocumentBuilder.build(documents, { validation: true });

    for (const document of documents) {
        const validationErrors = (document.diagnostics ?? []).filter(e => e.severity === 1);
        if (validationErrors.length > 0) {
            console.error(chalk.red('There are validation errors:'));
            for (const validationError of validationErrors) {
                console.error(chalk.red(
                    `line ${validationError.range.start.line + 1}: ${validationError.message} [${document.textDocument.getText(validationError.range)}]`
                ));
            }
            process.exit(1);
        }
    }
    

    
    return documents;
}

export async function collectAllImportedDocuments(
    fileName: string,
    services:  LangiumCoreServices
): Promise<LangiumDocument[]> {
    const visitedFiles = new Set<string>();
    const result: LangiumDocument[] = [];

    async function processFile(filePath: string): Promise<void> {
        const resolvedPath = path.resolve(filePath);
        if (visitedFiles.has(resolvedPath)) return;

        visitedFiles.add(resolvedPath);

        const document = await services.shared.workspace.LangiumDocuments.getOrCreateDocument(URI.file(resolvedPath));
        result.push(document);

        const model = document.parseResult.value as Model;

        if (model.fileImports) {
            for (const importedFile of model.fileImports) {
                const importPath = path.resolve(path.dirname(resolvedPath), importedFile.file);
                await processFile(importPath);
            }
        }
    }

    await processFile(fileName);
    return result;
}

export async function extractAstNode<T extends AstNode>(fileName: string, services: LangiumCoreServices): Promise<Array<T>> {
    return (await extractDocument(fileName, services)).map(x => x.parseResult.value as T);
}

interface FilePathData {
    destination: string,
    name: string
}



export function extractDestinationAndName(filePath: string, destination: string | undefined): FilePathData {
    filePath = path.basename(filePath, path.extname(filePath)).replace(/[.-]/g, '');
    return {
        destination: destination ?? path.join(path.dirname(filePath), 'generated'),
        name: path.basename(filePath)
    };
}
