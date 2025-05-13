import {
	isObjectExpression,
	isState, isStateDefinitionOverrides,
	OBJECT_OVERRIDE,
	ObjectExpression,
	State, StateDefinitionOverrides,
	Variable
} from "./language/generated/ast.js";

export class ReelInference{

	static getNestedObjectExpression(stateElement: State, path: Array<string>): ObjectExpression {
		// reverse loop through the path to get the object
		let current: State | ObjectExpression = stateElement;
		for (let i = path.length - 1; i >= 0; i--) {

			let element: Variable | undefined;
			if (isState(current)) {
				element = current?.properties.find((prop) => prop.name === path[i]);
			} else if (isObjectExpression(current)) {
				element = current.value.properties.find((prop) => prop.name === path[i]);
			}

			if (element && (isObjectExpression(element) || isState(element))) {
				current = element;
			}
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
}