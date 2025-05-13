import {LangiumDocument, MaybePromise} from "langium";
import {CompletionAcceptor, CompletionContext, DefaultCompletionProvider, NextFeature} from "langium/lsp";
import {CompletionParams, CompletionList, CancellationToken, CompletionItemKind} from "vscode-languageserver";
import {isAtomicModel, isStateDefinitionOverrides} from "./language/generated/ast.js";


export class ReelCompletionProvider extends DefaultCompletionProvider {


	override async getCompletion(document: LangiumDocument, params: CompletionParams, _cancelToken?: CancellationToken): Promise<CompletionList | undefined> {
		// console.log('getCompletion', document, params);
		// var result = super.getCompletion(document, params, _cancelToken);

		// const node = document.references[0].$refNode;
		// console.log(node?.astNode.$type)
		// console.log("types: ", document.references.map(ref => ref.$refNode?.astNode.$type));

		// // check if the node is a variable override
		// console.log(document)
		// if (node && node.astNode.$type === 'AtomicModel') {
		// 	// check if 
		// 	const reference = document.references[0].ref;
		// 	if (reference?.$type === 'State' && isState(reference)) {
		// 		var result = CompletionList.create(
		// 			reference.properties.map((property) => (<CompletionItem>{
		// 					label: property.name,
		// 					kind: 1,
		// 					data: {
		// 						$refNode: reference,
		// 						$property: property,
		// 						$container: node.astNode,
		// 						$containerRef: document.references[0],
		// 					},
		// 				} as CompletionItem
		// 			)),
		// 			false,
		// 		);
		// 		console.log("result: ", result);
				
				
		// 		return super.getCompletion(document, params, _cancelToken).then((completionList) => {
		// 			// if (completionList) {
		// 			// 	// add the new items to the completion list
		// 			// 	completionList.items = completionList.items.concat(result.items);
		// 			// }
		// 			return completionList;
		// 		});
		// 	}
		// }

		return super.getCompletion(document, params, _cancelToken);
	}

	protected override completionFor(context: CompletionContext, next: NextFeature, acceptor: CompletionAcceptor): MaybePromise<void> {
		console.log('completionFor', context, next, acceptor);
		// console.log('completionFor', context.document, context.params, context.token);
		// console.log('completionFor', context.document.references[0].$refNode?.astNode.$type);

		// check if the node is a variable override

		const model = context.node?.$container;

		if(next.type === "VariableOverride" && next.property === "ref") {
			
			if(isAtomicModel(model)){

				// get the corresponding State
				const props = model.stateType.ref?.properties;

				// for each property of the state, create a completion item
				for (const property of props ?? []) {
					acceptor(context, {
						label: property.name,
						detail: property.$type,
						kind: CompletionItemKind.Field,
					});
				}
				return;
			}
			if(isStateDefinitionOverrides(model)){
				// get the corresponding State
				const props = model.$container.stateType.ref?.properties;

				// for each property of the state, create a completion item
				for (const property of props ?? []) {
					acceptor(context, {
						label: property.name,
						kind: CompletionItemKind.Field,
					});
				}
				return;
			}
		}
		

		
	}
}