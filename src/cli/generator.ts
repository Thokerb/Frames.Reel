import type { Model } from '../language/generated/ast.js';
import { expandToNode, toString } from 'langium/generate';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { extractDestinationAndName } from './cli-util.js';
import {generateJsonObjects} from "../code-generation/json/reel-json-generate.js";

export function generateJSON(model: Model,otherModel: Array<Model>, filePath: string, destination: string | undefined): string {
    const data = extractDestinationAndName(filePath, destination);
    const generatedFilePath = `${path.join(data.destination, data.name)}.json`;

    const fileNode = expandToNode`
        ${JSON.stringify(generateJsonObjects(model, otherModel), null, '\t')}
    `.appendNewLineIfNotEmpty();

    if (!fs.existsSync(data.destination)) {
        fs.mkdirSync(data.destination, { recursive: true });
    }
    fs.writeFileSync(generatedFilePath, toString(fileNode));
    return generatedFilePath;
}
