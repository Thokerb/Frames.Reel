import {
	ReferenceInfo, DefaultScopeProvider, Scope, AstNode, AstUtils, UriUtils,
} from 'langium';
import {
	AtomicShortModel,
	isAtomicModel, isAtomicShortModel,
	isExpression, isModelReference, isOBJECT,
	isOBJECT_OVERRIDE,
	isOutputMap, isPortReference,
	isReceiveCase,
	isReceiveCondition, isReceiveCondition2, isStateConfiguration,
	isStateDefinitionOverrides,
	isStateDefinitionOverridesWithBecome,
	isTimeAdvanceCondition,
	isVariableOverride,
	isVariableReference, Model,
	ObjectExpression, Port, PortType, ReelAstType,
	State
} from './language/generated/ast.js';
import {ReelInference} from './reel-infer.js';
import dirname = UriUtils.dirname;
import path from "node:path";

export class ReelScopeProvider extends DefaultScopeProvider {
	override getScope(context: ReferenceInfo): Scope {


		switch(context.container.$type as keyof ReelAstType) {
			case 'ModelImports':
				if(context.property === '') {
					return this.getExportedModelsFromGlobalScope(context);
				}
				break;
			case 'AtomicShortModel':
				 if(context.property === 'stateType') {
				 	return super.getScope(context);
				}else{
					 console.log('context.container', context.container);
					 return this.getImportedModelsFromCurrentFile(context);
				 }
			case 'StateTypes':
				 return this.getImportedStatesFromCurrentFile(context);
				 
		}
		
		// target element of member calls
		if (context.property === 'ref' && isVariableOverride(context.container)) {


			const memberCall = context.container;
			const previous = memberCall.ref;
			if (!previous) {
				return super.getScope(context);
			}

			// get the state type TODO
			if (isAtomicModel(memberCall.$container.$container)) {
				const stateType = memberCall.$container.$container.stateType;
				if (stateType.ref === undefined) {
					return super.getScope(context);
				}

				return this.scopeState(stateType.ref);
			}

			if (isAtomicShortModel(memberCall.$container.$container)) {
				const stateType = memberCall.$container.$container.stateType;
				if (stateType.ref === undefined) {
					return super.getScope(context);
				}

				return this.scopeState(stateType.ref);
			}
			
			if(isModelReference(memberCall.$container.$container)) {
				const atomicModel = memberCall.$container.$container.atomicModel;
				if (atomicModel?.ref?.stateType.ref === undefined) {
					return super.getScope(context);
				}

				return this.scopeState(atomicModel.ref.stateType.ref);
			}


			if (isOBJECT_OVERRIDE(memberCall.$container)) {
				const {state, path} = ReelInference.getStateFromObjectOverride(memberCall.$container);

				if (state.$container?.stateType?.ref === undefined) {
					return super.getScope(context);
				}

				const element = ReelInference.getNestedObjectExpression(state.$container.stateType.ref, path);
				if (element === undefined) {
					return super.getScope(context);
				}

				return this.scopeObjectExpression(element);

			}
		}

		if (isExpression(context.container)) {

			// const state = ReelInference.getStateFromConditionExpression(context.container);
			// if (state === undefined) {
			// 	return super.getScope(context);
			// }

			// return this.scopeState(state);
		}

		if (isVariableReference(context.container)) {
			const variable = context.container;
			console.log('context', context)
			const state = ReelInference.getStateFromVariableReference(variable);
			if (state === undefined) {
				return super.getScope(context);
			}

			// only depth 0 
			if (context.index === 0) {
				return this.scopeState(state);
			}

			// dont take last element of the path
			const path = variable.property.map(x => x.$refText).reverse().slice(variable.property.length - (context.index ?? 0));
			console.log(path)


			if (path.length === 0) {


				return this.scopeState(state);
			}

			const objectExpression = ReelInference.getNestedObjectExpression(state, path);
			if (objectExpression === undefined) {


				return this.scopeAllVariablesOfState(state);
			}
			console.log(objectExpression)

			return this.scopeObjectExpression(objectExpression);
		}

		if (isTimeAdvanceCondition(context.container)) {
			const state = context.container;
			if (state.$container.$container.stateType.ref === undefined) {
				return super.getScope(context);
			}

			return this.createScopeForNodes((context.container.$container.$container.stateType.ref?.stateType?.StateName.map(x => <AstNode>{
				$type: x.$type,
				$containerIndex: x.$containerIndex,
				name: x.name,
				$containerProperty: x.$containerProperty,
				$container: x.$container,
				$containerRef: x.$container,
				$cstNode: x.$cstNode,
				$document: x.$document,
			}) ?? []));
		}


		if (isReceiveCase(context.container)) {
			const state = ReelInference.getAtomicModel(context.container);
			if (state?.stateType.ref === undefined) {
				return super.getScope(context);
			}
			return this.createScopeForNodes((state.stateType.ref?.stateType?.StateName.map(x => <AstNode>{
				$type: x.$type,
				$containerIndex: x.$containerIndex,
				name: x.name,
				$containerProperty: x.$containerProperty,
				$container: x.$container,
				$containerRef: x.$container,
				$cstNode: x.$cstNode,
				$document: x.$document,
			}) ?? []));
		}

		if (isReceiveCondition2(context.container)) {
			const state = ReelInference.getAtomicModel(context.container);
			if (state === undefined) {
				return super.getScope(context);
			}
			return this.createScopeForNodes(state?.ports?.ports?.filter(x => x.type === 'InPort').map(x => {
				return {
					...x,
					$type: x.valueType
				} as AstNode;
			}) ?? []);
		}

		if (isReceiveCondition(context.container)) {

			const state = ReelInference.getAtomicModel(context.container);
			if (state === undefined) {
				return super.getScope(context);
			}
			return this.createScopeForNodes(state?.ports?.ports?.filter(x => x.type === 'InPort').map(x => {
				return {
					...x,
					$type: x.valueType
				} as AstNode;
			}) ?? []);

		}

		if (isOutputMap(context.container)) {
			const state = ReelInference.getAtomicModel(context.container.$container);
			if (state === undefined) {
				return super.getScope(context);
			}
			
			return this.createPortNodes(state?.ports?.ports, 'OutPort');
		}

		if(isStateDefinitionOverrides(context.container) ) {
			const atomicModel = ReelInference.getAtomicModel(context.container);


			if (atomicModel?.stateType.ref === undefined) {
				return super.getScope(context);
			}


			return this.createScopeForNodes((atomicModel.stateType.ref?.stateType?.StateName.map(x => <AstNode>{
				$type: x.$type,
				$containerIndex: x.$containerIndex,
				name: x.name,
				$containerProperty: x.$containerProperty,
				$container: x.$container,
				$containerRef: x.$container,
				$cstNode: x.$cstNode,
				$document: x.$document,
			}) ?? []));
		}


		if (isStateDefinitionOverridesWithBecome(context.container)) {

			const atomicModel = ReelInference.getAtomicModel(context.container);


			if (atomicModel?.stateType.ref === undefined) {
				return super.getScope(context);
			}


			return this.createScopeForNodes((atomicModel.stateType.ref?.stateType?.StateName.map(x => <AstNode>{
				$type: x.$type,
				$containerIndex: x.$containerIndex,
				name: x.name,
				$containerProperty: x.$containerProperty,
				$container: x.$container,
				$containerRef: x.$container,
				$cstNode: x.$cstNode,
				$document: x.$document,
			}) ?? []));
		}


		if (isStateConfiguration(context.container)) {
			const atomicModel = ReelInference.getAtomicModel(context.container);


			if (atomicModel?.stateType.ref === undefined) {
				return super.getScope(context);
			}


			return this.createScopeForNodes((atomicModel.stateType.ref?.stateType?.StateName.map(x => <AstNode>{
				$type: x.$type,
				$containerIndex: x.$containerIndex,
				name: x.name,
				$containerProperty: x.$containerProperty,
				$container: x.$container,
				$containerRef: x.$container,
				$cstNode: x.$cstNode,
				$document: x.$document,
			}) ?? []));
		}

		if (isPortReference(context.container)) {
			const atomicModel = ReelInference.getAtomicModel(context.container.$container);

			if (atomicModel?.stateType.ref === undefined) {
				return super.getScope(context);
			}

			const portType =
				context.container.portType;

			return this.createPortNodes(atomicModel?.ports?.ports,portType);

		}

		if(isModelReference(context.container) && context.property === 'stateType') {
			
			// add scope for models

			if(context.container.atomicModel?.ref?.stateType.$nodeDescription !== undefined) {
				return this.createScope([context.container.atomicModel.ref.stateType.$nodeDescription]);
			}

		}
		
		console.log(context.container.$type)

		return super.getScope(context);
	}

	private scopeObjectExpression(objectOverride: ObjectExpression): Scope {

		var allMembers: Array<AstNode> = [];

		// add all properties of the class
		if (objectOverride?.value.properties) {
			allMembers = allMembers.concat(objectOverride.value.properties.map((property) => <AstNode>{
				$type: property.$type,
				name: property.name,
				$container: property,
				$containerRef: property.value,
				$containerType: property.$type,
				$containerIndex: property.$containerIndex,
				$containerProperty: property.$containerProperty,
				$cstNode: property.$cstNode,
				$document: property.$document,
			}));
		}
		return this.createScopeForNodes(allMembers);
	}

	private scopeState(classItem: State): Scope {

		var allMembers: Array<AstNode> = [];

		// add all properties of the class
		if (classItem.properties) {
			allMembers = allMembers.concat(classItem.properties.map((property) => <AstNode>{
				$type: property.$type,
				name: property.name,
				$container: classItem,
				$containerRef: classItem,
				$containerType: classItem?.$type,
				$containerIndex: property?.$containerIndex,
				$containerProperty: property?.$containerProperty,
				$cstNode: property.$cstNode,
				$document: property.$document,
			}));
		}


		return this.createScopeForNodes(allMembers);
	}

	// for the current variable we want to get all relevant variables or nested variables (with var.var as a prefix)
	private scopeAllVariablesOfState(state: State): Scope {

		var allMembers: Array<AstNode> = [];

		// flatten all nested variables by going into ObjectExpression
		const nestedVariables = ReelInference.getAllVariables(state);
		// add all properties of the class
		allMembers = allMembers.concat(nestedVariables.map((property) => <AstNode>{
			$type: property.$type,
			name: property.name,
			$container: property.$container,
			$containerRef: property.$container,
			$containerType: property?.$type,
			$containerIndex: property?.$containerIndex,
			$containerProperty: property?.$containerProperty,
			$cstNode: property.$cstNode,
			$document: property.$document,
		}));


		return this.createScopeForNodes(allMembers);

	}

	private createPortNodes(ports: Array<Port> | undefined, portType: PortType) {
		return this.createScopeForNodes(ports?.filter(x => x.type === portType).map(x => {
			
			let type = isOBJECT(x.valueType) ? 'ObjectExpression' : x.valueType;
			
			return {
				...x,
				$type: type
			} as AstNode;
		}) ?? []);
	}


	private getExportedModelsFromGlobalScope(context: ReferenceInfo): Scope {
		//get document for current reference
		const document = AstUtils.getDocument(context.container);
		//get model of document
		const model = document.parseResult.value as Model;
		//get URI of current document
		const currentUri = document.uri;
		//get folder of current document
		const currentDir = dirname(currentUri);
		const uris = new Set<string>();
		//for all file imports of the current file
		for (const fileImport of model.fileImports) {
			//resolve the file name relatively to the current file
			const filePath = path.join(currentDir.path, fileImport.file);
			//create back an URI
			const uri = currentUri.with({ path: filePath });
			//add the URI to URI list
			uris.add(uri.toString());
		}
		//get all possible persons from these files
		const astNodeDescriptions = this.indexManager.allElements(AtomicShortModel, uris).toArray();
		//convert them to descriptions inside of a scope
		return this.createScope(astNodeDescriptions);
	}

	private getImportedModelsFromCurrentFile(context: ReferenceInfo) {
		//get current document of reference
		const document = AstUtils.getDocument(context.container);
		//get current model
		const model = document.parseResult.value as Model;
		//go through all imports
		const descriptions = model.fileImports.flatMap(fi => fi.modelImports.map(pi => {
			
			//if import references to a person, return that person
			if (pi.model.ref) {
				return this.descriptions.createDescription(pi.model.ref, pi.model.ref.name);
			}
			
			//otherwise return nothing
			return undefined;
		}).filter(d => d != undefined)).map(d => d!);
		
		const localDescriptions = model.elements.filter(x => isAtomicShortModel(x)).map(x => this.descriptions.createDescription(x, x.name));
		
		return this.createScope([...descriptions,...localDescriptions]);
	}
	
	private getImportedStatesFromCurrentFile(context: ReferenceInfo) {

		//get current document of reference
		const document = AstUtils.getDocument(context.container);
		//get current model
		const model = document.parseResult.value as Model;
		

		const importedStates = model.fileImports.flatMap(fi => fi.stateImports.map(pi => {

			//if import references to a person, return that person
			if (pi.ref) {
				return this.descriptions.createDescription(pi.ref, pi.ref.name);
			}

			//otherwise return nothing
			return undefined;
		}).filter(d => d != undefined)).map(d => d!);
		
		
		// get all states from the current model
		const localStates = model.elements.filter(x => isAtomicShortModel(x)).flatMap(x => (x as AtomicShortModel).stateType?.ref?.stateType?.StateName.map(y => this.descriptions.createDescription(y, y.name)) ?? []);
	
		return this.createScope([...importedStates,...localStates]);
	}
	
	
	
}
