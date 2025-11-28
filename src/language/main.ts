import { startLanguageServer } from 'langium/lsp';
import { NodeFileSystem } from 'langium/node';
import { createConnection, ProposedFeatures } from 'vscode-languageserver/node.js';
import { createReelServices } from './reel-module.js';
import { DocumentState, URI } from 'langium';
import {generateJsonObjects} from "../code-generation/json/reel-json-generate.js";
import {Model} from "./generated/ast.js";

// Create a connection to the client
const connection = createConnection(ProposedFeatures.all);

// Inject the shared services and language-specific services
const { shared } = createReelServices({ connection, ...NodeFileSystem });


// add an action to generate the code from the model
shared.workspace.DocumentBuilder.onBuildPhase(DocumentState.Validated, documents => {

    function replacer(key: string, value: any) {
    if(value instanceof Map) {
        return Array.from(value.entries()).map(([k, v]): { key: string; value: any } => ({
            key: k,
            value: v
        }));
    } else {
        return value;
    }
    }

    connection.onRequest('workspace/executeCommand', async (params) => {
        if (params.command === 'reel.generateJSON') {

            console.log("server got request");

            let [uri]: Array<URI> = params.arguments;

            const document = shared.workspace.LangiumDocuments.all.find(x => x.uri.path === uri.path);
            

            if (!document) {
                console.error(`No document found for URI: ${uri.path}`);
                throw new Error(`No document found for URI: ${uri.path}`);
            }

            // Build the document to make sure it's parsed and validated
            await shared.workspace.DocumentBuilder.build([document]);

            const rootNode = document.parseResult?.value;
            if (!rootNode) {
                console.error(`No root node parsed for URI: ${uri}`);
                throw new Error(`No root node parsed for URI: ${uri}`);
            }

            const jsonObjects = generateJsonObjects(rootNode as Model, []);

            const json = JSON.stringify(jsonObjects, replacer, 2);
            
            return json;
            
        }
        throw new Error(`Command not recognized: ${params.command}`);
    });
})



// Start the language server with the shared services
startLanguageServer(shared);

