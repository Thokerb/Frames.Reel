import {
	ReferenceInfo, DefaultScopeProvider, Scope, AstNode, AstUtils, UriUtils,
} from 'langium';
import {
	AtomicShortModel,
	CoupledModel,
	isAtomicModel, isAtomicShortModel, isCoupledModel, isCouplingDefinition,
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
					 return this.getImportedModelsFromCurrentFile(context, 'AtomicShortModel');
				 }
			case 'CoupledModel':
				return this.getImportedModelsFromCurrentFile(context, 'CoupledModel');					
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
			// console.log('context', context)
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
		
		if(isCouplingDefinition(context.container)) {

			if(context.property === 'sourcePort' || context.property === 'targetPort') {
				let sourceModel =  context.container.sourceModel?.ref?.atomicModel?.ref ?? context.container.sourceModel?.ref?.coupledModel?.ref;
				let targetModel = context.container.targetModel?.ref?.atomicModel?.ref ?? context.container.targetModel?.ref?.coupledModel?.ref;
				
				if(context.container.thisTargetModel && context.property === 'targetPort') {
					targetModel = context.container.$container;
				}
				if(context.container.thisSourceModel && context.property === 'sourcePort') {
					sourceModel = context.container.$container;
				}

				const model = context.property === 'sourcePort' ? sourceModel : targetModel;
				
				if (model === undefined) {
					return super.getScope(context);
				}
				const sourcePorts = model.ports?.ports ?? [] 
				
				let allowedPortType: PortType = context.property === 'sourcePort' ? 'OutPort' : 'InPort';
				
				// flip allowedPortType when linking within coupledmodel within 
				if(context.container.thisTargetModel && context.property === 'targetPort' ||
					context.container.thisSourceModel && context.property === 'sourcePort'
				) {
					allowedPortType = allowedPortType === 'InPort' ? 'OutPort' : 'InPort';
				}
				
				return this.createPortNodes( sourcePorts, allowedPortType);
			}
			
		}
		
		console.log('default: ',context.container.$type)

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
			const filePath = this.pathJoin([currentDir.path, fileImport.file]);
			//create back an URI
			const uri = currentUri.with({ path: filePath });
			//add the URI to URI list
			uris.add(uri.toString());
		}
		//get all possible persons from these files
		const astNodeDescriptions = this.indexManager.allElements(AtomicShortModel, uris).toArray();
		const astNodeDescriptions2 = this.indexManager.allElements(CoupledModel, uris).toArray();
		//convert them to descriptions inside of a scope
		return this.createScope([...astNodeDescriptions, ...astNodeDescriptions2]);
	}
	private pathJoin(parts: string[]){
	var separator = '/';
	var replace   = new RegExp(separator+'{1,}', 'g');
	return parts.join(separator).replace(replace, separator);
	}
	private getImportedModelsFromCurrentFile(context: ReferenceInfo, modelType: 'AtomicShortModel' | 'CoupledModel'): Scope {
		//get current document of reference
		const document = AstUtils.getDocument(context.container);
		//get current model
		const model = document.parseResult.value as Model;
		//go through all imports
		const descriptions = model.fileImports.flatMap(fi => {
			
			const pi = fi.modelImport;
			
			//if import references to a person, return that person
			if (modelType === 'AtomicShortModel' && pi.atomicModel?.ref) {
				return this.descriptions.createDescription(pi.atomicModel.ref, pi.atomicModel.ref.name);
			}
			if (modelType === 'CoupledModel' && pi.coupledModel?.ref) {
				return this.descriptions.createDescription(pi.coupledModel.ref, pi.coupledModel.ref.name);
			}
			
			//otherwise return nothing
			return undefined;
		}).filter(d => d != undefined).map(d => d!);
		
		const localDescriptions = model.elements.filter(x => isAtomicShortModel(x) || isCoupledModel(x)).map(x => this.descriptions.createDescription(x, x.name));
		
		return this.createScope([...descriptions,...localDescriptions]);
	}
	
	
	
	
}
