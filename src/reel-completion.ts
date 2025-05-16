import {MaybePromise} from "langium";
import {CompletionAcceptor, CompletionContext, DefaultCompletionProvider, NextFeature} from "langium/lsp";
import {CompletionItemKind} from "vscode-languageserver";
import {
	isAtomicModel, isOBJECT_OVERRIDE,
	isStateDefinitionOverrides,
	isVariableOverride, isVariableReference,
} from "./language/generated/ast.js";
import {ReelInference} from "./reel-infer.js";


export class ReelCompletionProvider extends DefaultCompletionProvider {
	protected override completionFor(context: CompletionContext, next: NextFeature, acceptor: CompletionAcceptor): MaybePromise<void> {
		// console.log('completionFor', context, next, acceptor);
		// console.log('completionFor', context.document, context.params, context.token);
		// console.log('completionFor', context.document.references[0].$refNode?.astNode.$type);

		// check if the node is a variable override

		const model = context.node?.$container;



		
		if(next.feature.$type === "CrossReference" && next.property === "property"){
			
			const variable= context.node;
			if(variable !== undefined && isVariableReference(variable)){
				const state = ReelInference.getStateFromVariableReference(variable);

				if (state === undefined) {
					return;
				}
				const path = variable.property.map(x => x.$refText).reverse().slice();
				const props = ReelInference.getNestedObjectExpression(state, path)?.value.properties;
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
			
		}

		if (next.type === "VariableOverride" && next.property === "ref") {


			// log type
			// console.log("type: ", model?.$type);

			if (isAtomicModel(model)) {

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
			if (isStateDefinitionOverrides(model)) {
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

			if (isVariableOverride(model)) {
				// get the corresponding State
				
				if(isOBJECT_OVERRIDE(model.$container)){
					const {state, path} = ReelInference.getStateFromObjectOverride(model.$container);

					// get the object in the state
					const stateElement = state.$container.stateType.ref

					if (stateElement === undefined) {
						return;
					}

					// reverse loop through the path to get the object
					let nestedObjectExpression = ReelInference.getNestedObjectExpression(stateElement, path);


					// for each property of the state, create a completion item
					for (const property of nestedObjectExpression?.value.properties ?? []) {
						acceptor(context, {
							label: property.name,
							kind: CompletionItemKind.Field,
						});
					}
					return;
				}
				
				if (isStateDefinitionOverrides(model.$container)) {
				// get the corresponding State
				const props = model.$container.$container.stateType.ref?.properties;

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


			if (isOBJECT_OVERRIDE(model)) {
				// get the corresponding State
				const {state, path} = ReelInference.getStateFromObjectOverride(model);

				// get the object in the state
				const stateElement = state.$container.stateType.ref

				if (stateElement === undefined) {
					return;
				}
				let nestedObjectExpression = ReelInference.getNestedObjectExpression(stateElement, path);
				
				// for each property of the state, create a completion item
				for (const property of nestedObjectExpression?.value.properties ?? []) {
					acceptor(context, {
						label: property.name,
						kind: CompletionItemKind.Field,
					});
				}
				return;
			}

		}else{
			console.log(context, next)
			super.completionFor(context, next, acceptor);
		}

		
	}
}