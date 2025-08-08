import {DocumentState, EmptyFileSystem, URI} from 'langium';
import {startLanguageServer} from 'langium/lsp';
import {BrowserMessageReader, BrowserMessageWriter, createConnection} from 'vscode-languageserver/browser.js';
import {createReelServices} from './reel-module.js';
import {Diagnostic} from "vscode-languageserver-types";
import {NotificationType} from "vscode-languageclient";
import {CodeAction} from "vscode-languageserver";
import {generateJsonObjects} from "../code-generation/json/reel-json-generate.js";
import {Model} from "./generated/ast.js";

declare const self: DedicatedWorkerGlobalScope;

const messageReader = new BrowserMessageReader(self);
const messageWriter = new BrowserMessageWriter(self);

const connection = createConnection(messageReader, messageWriter);

const {shared, Reel} = createReelServices({connection, ...EmptyFileSystem});

startLanguageServer(shared);

// Send a notification with the serialized AST after every document change
type DocumentChange = { uri: string, content: string, diagnostics: Diagnostic[] };
const documentChangeNotification = new NotificationType<DocumentChange>('browser/DocumentChange');
const jsonSerializer = Reel.serializer.JsonSerializer;
shared.workspace.DocumentBuilder.onBuildPhase(DocumentState.Validated, documents => {
	for (const document of documents) {
		const json = jsonSerializer.serialize(document.parseResult.value);
		console.log("y", json);
		connection.sendNotification(documentChangeNotification, {
			uri: document.uri.toString(),
			content: json,
			diagnostics: document.diagnostics ?? []
		});
	}
});

// add an action to generate the code from the model
shared.workspace.DocumentBuilder.onBuildPhase(DocumentState.Validated, documents => {

	connection.onCodeAction((params) => {
		const actions: CodeAction[] = [];

		actions.push({
			title: 'Generate JSON code',
			kind: '',
			command: {
				title: 'Generate JSON',
				command: 'reel.generateJSON',
				arguments: [params.textDocument.uri]
			}
		});


		return actions;
	})

	connection.onRequest('workspace/executeCommand', async (params) => {
		if (params.command === 'reel.generateJSON') {
			const [uri]: Array<URI> = params.arguments;
			

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

			const json = JSON.stringify(generateJsonObjects(rootNode as Model,[]))
			
			return json;
			
		}
		throw new Error(`Command not recognized: ${params.command}`);
	});
})