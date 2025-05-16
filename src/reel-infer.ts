import {
	BinaryExpression,
	ConditionExpression, isBinaryExpression,
	isObjectExpression,
	isState, isStateDefinitionOverrides, isTimeAdvanceCase, isTimeAdvanceCondition,
	OBJECT_OVERRIDE,
	ObjectExpression,
	State, StateDefinitionOverrides, TimeAdvanceCase, TimeAdvanceCondition,
	Variable, VariableReference
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

	static getStateFromConditionExpression(container: ConditionExpression): State | undefined {
		
		return undefined;
		// let current = container.$container;
		
		// while (true){
		// 	if(isConditionExpression(current)) {
		// 		current = current.$container;
		// 	}
		// 	if(isTimeAdvanceCondition(current)){
		// 		break;
		// 	}
		// }
		// return current.$container.$container.stateType.ref;
		
	}

	static getStateFromVariableReference(variable: VariableReference): State | undefined  {
		
		let current: BinaryExpression | TimeAdvanceCase | TimeAdvanceCondition = variable.$container;

		while (true){
			if(isBinaryExpression(current)) {
				current = current.$container;
			}
			if(isTimeAdvanceCase(current)){
				break;
			}
			if(isTimeAdvanceCondition(current)){
				break;
			}
		}
		
		if(isTimeAdvanceCase(current)){
			return current.$container.stateType.ref;
		}
		if(isTimeAdvanceCondition(current)){
			return current.$container.$container.stateType.ref;
		}
		
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
}