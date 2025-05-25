import {
	AtomicModel,
	BinaryExpression, isAtomicModel,
	isBinaryExpression,
	isObjectExpression, isOutputCase, isOutputMap, isReceiveCase, isReceiveCondition,
	isState,
	isStateDefinitionOverrides,
	isStateDefinitionOverridesWithBecome,
	isTimeAdvanceCase,
	isTimeAdvanceCondition,
	OBJECT_OVERRIDE,
	ObjectExpression, OutputCase, OutputMap, ReceiveCase, ReceiveCondition,
	State,
	StateDefinitionOverrides,
	StateDefinitionOverridesWithBecome,
	TimeAdvanceCase,
	TimeAdvanceCondition,
	Variable,
	VariableReference
} from "./language/generated/ast.js";

export class ReelInference{

	static getNestedObjectExpression(stateElement: State, path: Array<string>): ObjectExpression | undefined {
		// reverse loop through the path to get the object
		let current: State | ObjectExpression | undefined = stateElement;
		for (let i = path.length - 1; i >= 0; i--) {

			let element: Variable | undefined;
			if (isState(current)) {
				element = current?.properties.find((prop) => prop.name === path[i]);
			} else if (isObjectExpression(current)) {
				element = current.value.properties.find((prop) => prop.name === path[i]);
			}
			
			if(!(isObjectExpression(element) || isState(element))) {
				return undefined;
			}
			
			current = element;

		}

		if (isObjectExpression(current)) {
			return current;
		}else{
			throw new Error("No object expression found");
		}
	}

	static getStateFromObjectOverride(model: OBJECT_OVERRIDE): { state: StateDefinitionOverrides; path: Array<string> } {

		// object expression is either in an object or in a state
		// bubble up the tree until we find a state
		// save the path to the state so we can use it later
		let path: Array<string> = [];
		let current: StateDefinitionOverrides | OBJECT_OVERRIDE = model;

		while (!isStateDefinitionOverrides(current)) {
			path.push(current.$container.ref.$nodeDescription?.name ?? '');
			current = current.$container.$container;
		}

		if (isStateDefinitionOverrides(current)) {
			return {
				state: current,
				path: path
			}
		}
		throw new Error("No state found for object expression");
	}


	static getStateFromVariableReference(variable: VariableReference): State | undefined  {
		
		let current:  BinaryExpression | StateDefinitionOverridesWithBecome | TimeAdvanceCase | TimeAdvanceCondition | ReceiveCondition | OutputMap= variable.$container;

		while (true){
			if(isBinaryExpression(current)) {
				current = current.$container;
			}else{
				break;
			}
		}
		
		if(isTimeAdvanceCase(current)){
			return current.$container.stateType.ref;
		}
		if(isTimeAdvanceCondition(current)){
			return current.$container.$container.stateType.ref;
		}
		
		if(isStateDefinitionOverridesWithBecome(current)){
			return ReelInference.getAtomicModel(current)?.stateType.ref;
		}
		
		if(isReceiveCondition(current)){
			return ReelInference.getAtomicModel(current.$container.$container)?.stateType.ref;
		}
		
		console.error("getStateFromVariableReference: No state found for variable reference", variable);		
		return undefined;
	}

	static getAllVariables(state: State): Array<Variable> {
		
		const result: Array<Variable> = [];
		
		let current: Array<Variable> = state.properties;
		for (const variable of current) {
			result.push(variable);
			
			if (isObjectExpression(variable)) {
				current = variable.value.properties;
				result.push(...this.getAllVariablesFromObjectExpre(variable));
			}
		}
		return result;
		
	}

	private static getAllVariablesFromObjectExpre(variable: ObjectExpression): Array<Variable> {
		const result: Array<Variable> = [];
		
		for (const prop of variable.value.properties) {
			result.push(prop);

			if (isObjectExpression(prop)) {
				result.push(...this.getAllVariablesFromObjectExpre(prop));
			}
		}
		return result;
	}
	
	
	public static getAtomicModel(container:  StateDefinitionOverridesWithBecome | ReceiveCondition | ReceiveCase | OutputMap | OutputCase): AtomicModel | undefined {

		if(isReceiveCase(container)) {
			return container.$container;
		}
		
		if(isReceiveCondition(container)){
			return container.$container.$container.$container;
		}
		
		if(isStateDefinitionOverridesWithBecome(container)){
			return isAtomicModel(container.$container.$container) ? container.$container.$container : container.$container.$container.$container;
		}
		
		if(isOutputMap(container)){
			return container.$container.$container;
		}
		
		if(isOutputCase(container)){
			return container.$container;
		}
		
		return undefined;
		
		
	}
}