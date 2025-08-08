import {DocumentState, EmptyFileSystem} from 'langium';
import { startLanguageServer } from 'langium/lsp';
import { BrowserMessageReader, BrowserMessageWriter, createConnection } from 'vscode-languageserver/browser.js';
import { createReelServices } from './reel-module.js';
import {Diagnostic} from "vscode-languageserver-types";
import {NotificationType} from "vscode-languageclient";

declare const self: DedicatedWorkerGlobalScope;

const messageReader = new BrowserMessageReader(self);
const messageWriter = new BrowserMessageWriter(self);

const connection = createConnection(messageReader, messageWriter);

const { shared, Reel } = createReelServices({ connection, ...EmptyFileSystem });

startLanguageServer(shared);

// Send a notification with the serialized AST after every document change
type DocumentChange = { uri: string, content: string, diagnostics: Diagnostic[] };
const documentChangeNotification = new NotificationType<DocumentChange>('browser/DocumentChange');
const jsonSerializer = Reel.serializer.JsonSerializer;
shared.workspace.DocumentBuilder.onBuildPhase(DocumentState.Validated, documents => {
	for (const document of documents) {
		const json = jsonSerializer.serialize(document.parseResult.value);
		connection.sendNotification(documentChangeNotification, {
			uri: document.uri.toString(),
			content: json,
			diagnostics: document.diagnostics ?? []
		});
	}
});