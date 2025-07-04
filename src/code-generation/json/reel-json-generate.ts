import {
	AtomicShortModel, CoupledModel, Expression, isAtomicShortModel, isCoupledModel, isOBJECT, isOBJECT_OVERRIDE,
	isObjectExpression, isPortReference,
	isState, isVariableOverride, isVariableReference,
	Model, ModelReference, OBJECT, PortType, PropertiesOverride, ReceiveConditionWithOverride2,
	State, StateConfiguration, Variable, VariableOverride, VariableReference
} from "../../language/generated/ast.js";
import {ReelExpressionChecker} from "../../reel-expression-checker.js";

function generateStateObject(state: State) {
	let stateObject: StateJson = {
		name: state.name,
		properties: flattenStateProperties(state.properties),
		states: state.stateType?.StateName.map(x => x.name) ?? [],
		initialState: state.stateType!.initialState.ref!.name
	}

	return stateObject;
}

export interface ReelJson {
	states: Array<StateJson>;
	atomicModels: Array<AtomicModelJson>;
	coupledModels: Array<CoupledModelJson>;
}

export interface CoupledModelJson {
	name: string;
	ports: Array<PortJson>;
	models: Array<ModelReferenceJson>;
	couplings: Array<{
		sourceModel: string; // 'this' or model name
		sourcePort: string; // Port name
		targetModel: string; // 'this' or model name
		targetPort: string; // Port name
		type: ExpressionValueType; // Type of the port value
	}>;
}

export interface ModelReferenceJson {
	name: string;
	isAtomicModel: boolean;
	modelRef: string; // Reference to the atomic model or coupled model
	modelOverrides?: Array<StatePropertyJson>; // Overrides for the model's state properties
	initialState?: string; // Initial state reference
}

function generateModel(m: ModelReference): ModelReferenceJson {

	const isAtomicModel = m.atomicModel !== undefined;


	return {
		name: m.name,
		isAtomicModel: isAtomicModel,
		modelRef: isAtomicModel ? m.atomicModel!.ref!.name : m.coupledModel!.ref!.name,
		modelOverrides: flattenStateProperties(m.definitionOverrides?.properties ?? []),
		initialState: m.definitionOverrides?.initialState.ref?.name,
	}
}

function generateCoupledModelObject(model: CoupledModel): CoupledModelJson {
	return {
		name: model.name,
		ports: model.ports?.ports?.map(port => ({
			name: port.name,
			type: port.type,
			valueType: MapValueType(port.valueType)
		})) ?? [],
		models: model.models.map(m => generateModel(m)),
		couplings: model.couplings.map(c => {
			return {
				sourceModel: c.thisSourceModel ? 'this' : c.sourceModel!.ref!.name,
				sourcePort: c.sourcePort!.ref!.name,
				targetModel: c.thisTargetModel ? 'this' : c.targetModel!.ref!.name,
				targetPort: c.targetPort!.ref!.name,
				type: MapPortType(c.sourcePort.ref?.valueType)
			}
		})
	}
}

export function generateJsonObjects(model: Model, otherModel: Array<Model>): ReelJson {


	const importedAtomicModels: Array<AtomicShortModel> = [model, ...otherModel].map(model => model.fileImports.filter(x => x.modelImport.atomicModel !== undefined).map(x => x.modelImport.atomicModel!.ref!) ?? []).flat();
	const importedCoupledModels: Array<CoupledModel> = [model, ...otherModel].map(model => model.fileImports.filter(x => x.modelImport.coupledModel !== undefined).map(x => x.modelImport.coupledModel!.ref!) ?? []).flat();
	const importedStates: Array<State> = [model, ...otherModel].map(model => model.fileImports.filter(x => x.modelImport.atomicModel !== undefined).map(x => x.modelImport.atomicModel!.ref!.stateType.ref!) ?? []).flat();

	const states: Array<State> = model.elements.filter(p => isState(p)) as Array<State>;
	// Include imported states, but avoid duplicates
	for (const importedState of importedStates) {
		if (!states.some(s => s.name === importedState.name)) {
			states.push(importedState);
		}
	}
	const atomicModels: Array<AtomicShortModel> = model.elements.filter(p => isAtomicShortModel(p)) as Array<AtomicShortModel>;
	// Include imported atomic models, but avoid duplicates
	for (const importedModel of importedAtomicModels) {
		if (!atomicModels.some(m => m.name === importedModel.name)) {
			atomicModels.push(importedModel);
		}
	}
	const coupledModels = model.elements.filter(p => isCoupledModel(p)) as Array<CoupledModel>;
	// Include imported coupled models, but avoid duplicates
	for (const importedModel of importedCoupledModels) {
		if (!coupledModels.some(m => m.name === importedModel.name)) {
			coupledModels.push(importedModel);
		}
	}

	const stateJson = states.map(state => generateStateObject(state));
	const atomicModelsJson = atomicModels.map(model => generateAtomicModelObject(model));
	console.log(atomicModelsJson)
	const coupledModelsJson = coupledModels.map(model => generateCoupledModelObject(model));

	var result: ReelJson = {
		states: stateJson,
		atomicModels: atomicModelsJson,
		coupledModels: coupledModelsJson
	}
	return result;
}


export interface StatePropertyJson {
	name: string;
	type: string;
	value: any; // This could be more specific based on the type of the property
	// Add other relevant fields as needed
}

export interface StateJson {
	name: string;
	states: Array<string>;
	initialState: string;
	properties: Array<StatePropertyJson>;
}

function flattenStateProperties(
	properties: Array<Variable | VariableOverride | PropertiesOverride>,
	parentPath: string[] = []
): Array<StatePropertyJson> {
	const result: StatePropertyJson[] = [];

	properties.forEach(prop => {

		const varName = isVariableOverride(prop) ? prop.ref.ref?.name : prop.name;
		
		const name = [...parentPath, varName].join('.');


		if (isObjectExpression(prop)) {
			result.push(...flattenStateProperties(prop.value.properties, [...parentPath, name]));
		} else {
			if (isOBJECT_OVERRIDE(prop.value) && isVariableOverride(prop)) {
				result.push(...flattenStateProperties(prop.value.properties, [...parentPath, name]))
			} else {
				
				if(!isOBJECT(prop.value) && ! isOBJECT_OVERRIDE(prop.value)) {
					result.push(
						{
							name: name,
							type: prop.$type,
							value: prop.value
						}
					);
				}
				

			}
		}
	});

	return result;
}

export interface ExpressionJson {
	expression: string;
	isAssignment?: boolean; // Indicates if this expression is an assignment
	returnType?: ExpressionValueType // The type of the expression, e.g., 'int', 'bool', 'string', etc.
}

export type ExpressionValueType = 'BooleanExpression' | 'IntegerExpression' | 'ObjectExpression' | 'StringExpression';

export interface OutputJson {
	port: string; // Name of the port
	value: ExpressionJson;
}

export interface TransitionJson {
	name?: string;
	transitionCondition: ExpressionJson;
	transitionNewStateTypeRef: string;
	transitionStateModifications: Array<ExpressionJson>;
}

export interface StateConfigurationJson {
	stateTypeRef: string;

	timeAdvanceExpression: ExpressionJson;
	output: Array<OutputJson>;

	transitions: Array<TransitionJson>;
}

// TODO: use cstNode or reflect the variable name
function GetVariableName(ref: VariableReference): string {
	return ref.$cstNode!.text
}

function GetVariable(ref: VariableReference): Variable | undefined {
	// return last variable, which is not object but variable
	return ref.property[ref.property.length - 1].ref;

}

function MapPortType(valueType: "bool" | "int" | "string" | OBJECT | undefined): ExpressionValueType {
	if (valueType === undefined) {
		throw new Error("Value type is undefined");
	}

	switch (valueType) {
		case "bool":
			return 'BooleanExpression';
		case "int":
			return 'IntegerExpression';
		case "string":
			return 'StringExpression';
		default:
			return 'ObjectExpression'; // For OBJECT or any other type, default to ObjectExpression
	}
}

function ToExpressionJson(expr: Expression): ExpressionJson {

	if (isVariableReference(expr)) {
		return {
			expression: GetVariableName(expr),
			isAssignment: false,
			returnType: GetVariable(expr)?.$type
		}
	}

	if (isPortReference(expr)) {
		return {
			expression: expr.property.ref?.name ?? '',
			isAssignment: false,
			returnType: MapPortType(expr.property.ref?.valueType)
		}
	}

	let returnType = ReelExpressionChecker.CheckType(expr);
	if (ReelExpressionChecker.isError(returnType) || returnType === 'unknown') {
		throw returnType;
	}

	const topExpression = ReelExpressionChecker.GetTopExpression(expr);
	const isAssignment = topExpression.operator === '=';
	return {
		returnType: returnType,
		isAssignment: isAssignment,
		expression: expr.$cstNode!.text
	}
}

function generateTransition(tr: ReceiveConditionWithOverride2): TransitionJson {
	return {
		name: tr.condition.name,
		transitionCondition: tr.condition.expression !== undefined ? ToExpressionJson(tr.condition.expression) : {
			expression: '',
			returnType: 'BooleanExpression',
			isAssignment: false
		},
		transitionNewStateTypeRef: tr.overrides.stateRef.ref!.name,
		transitionStateModifications: tr.overrides.properties.map(mod => ToExpressionJson(mod))

	}
}

function generateStateConfiguration(sc: StateConfiguration): StateConfigurationJson {
	return {
		stateTypeRef: sc.stateRef.ref!.name,
		timeAdvanceExpression: ToExpressionJson(sc.timeAdvance.timeAdvance),
		transitions: sc.transitions.map(tr => generateTransition(tr)),
		output: sc.output.map(out => ({
			port: out.portRef.ref!.name,
			value: ToExpressionJson(out.expression)
		}))
	}
}

function MapValueType(valueType: "bool" | "int" | "string" | OBJECT): Array<PortObjectMap> | 'bool' | 'int' | 'string' {
	if(isOBJECT(valueType)) {
		return valueType.properties.map(prop => {
			
			if(isOBJECT(prop.value)){
				throw new Error("OBJECT type is not supported in this context");
			}
			
			let valueTypeMapped: 'bool' | 'int' | 'string';
			if(prop.$type === 'BooleanExpression') {
				valueTypeMapped = 'bool';
			}else if(prop.$type === 'IntegerExpression') {
				valueTypeMapped = 'int';
			}
			else if(prop.$type === 'StringExpression') {
				valueTypeMapped = 'string';
			}
			else {
				throw new Error("Unsupported value type: " + prop.$type);
			}
			
			return {
				name: prop.name,
				valueType: valueTypeMapped
			}
		})
	}else{
		return valueType;
	}
	
}

function generateAtomicModelObject(model: AtomicShortModel) {
	const atomicModelObject: AtomicModelJson = {
		name: model.name,
		ports: model.ports?.ports?.map(port => ({
			name: port.name,
			type: port.type,
			valueType: MapValueType(port.valueType)
		})) ?? [],
		stateRef: model.stateType.ref!.name,
		stateDefinitions: flattenStateProperties(model.definitionOverrides?.properties ?? []),
		initialState: model.definitionOverrides?.initialState.ref?.name,
		states:  model.stateConfiguration.map(sc => generateStateConfiguration(sc)),
	}

	return atomicModelObject;


}

export interface PortJson {
	name: string;
	type: PortType;
	valueType: 'bool' | 'int' | 'string' | Array<PortObjectMap>
}

export interface PortObjectMap {
	name: string;
	valueType: 'bool' | 'int' | 'string';
}

export interface AtomicModelJson {
	// Define the structure of the atomic model JSON object
	// For example:
	name: string;
	stateRef: string; // Reference to the state type
	ports: Array<PortJson>;
	states: Array<StateConfigurationJson>;
	stateDefinitions: Array<StatePropertyJson>; // Assuming state definitions are similar to states
	initialState?: string; // Optional initial state
	// Add other relevant fields as needed
}