import {
	AtomicShortModel,
	BinaryExpression,
	isAtomicShortModel,
	isBinaryExpression, isModelReference,
	isObjectExpression, isOutputMap, isReceiveCondition2,
	isState, isStateConfiguration,
	isStateDefinitionOverrides,
	isStateDefinitionOverridesWithBecome,
	isTimeAdvanceStateConfiguration,
	OBJECT_OVERRIDE,
	ObjectExpression,  OutputMap, ReceiveCondition2,
	State,
	StateConfiguration,
	StateDefinitionOverrides,
	StateDefinitionOverridesWithBecome, TimeAdvanceStateConfiguration,
	Variable,
	VariableReference
} from "./language/generated/ast.js";
import {ReelExpressionChecker} from "./reel-expression-checker.js";

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
		
		let current  = variable.$container;

		while (true){
			if(isBinaryExpression(current)) {
				current = current.$container;
			}else{
				break;
			}
		}
		
		return ReelInference.getAtomicModel(current)?.stateType.ref;
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
	
	
	public static getAtomicModel(container:  StateDefinitionOverridesWithBecome | StateDefinitionOverrides | BinaryExpression | OutputMap | TimeAdvanceStateConfiguration | ReceiveCondition2 | StateConfiguration): AtomicShortModel | undefined {

		
		if(isStateDefinitionOverrides(container)) {
			switch (container.$container.$type) {
				case "ModelReference":
					if(isModelReference(container.$container)) {
						if(container.$container.atomicModel !== undefined) {
							return container.$container.atomicModel.ref;
						}
						if(container.$container.coupledModel !== undefined) {
							return undefined;
						}
					}
					break;
				case "AtomicShortModel":
					if(isAtomicShortModel(container.$container)) {
						return container.$container;
					}
					break;

			}

		}
		
		if(isTimeAdvanceStateConfiguration(container)){
			return container.$container.$container;
		}
	
		if(isStateDefinitionOverridesWithBecome(container)){
			return container.$container.$container.$container;
		}
		
		if(isOutputMap(container)){
			return container.$container.$container;
		}

		if(isReceiveCondition2(container)){
			return container.$container.$container.$container;
		}
		
		if(isStateConfiguration(container)){
			return container.$container;
		}
		
		
		if(isBinaryExpression(container)){
			const topExpression = ReelExpressionChecker.GetTopExpression(container);
			if(isBinaryExpression(topExpression.$container) ){
				throw new Error("Top expression is not a state configuration");
			}
			return this.getAtomicModel(topExpression.$container);
		}
		
		return undefined;
		
		
	}
}