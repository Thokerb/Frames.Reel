import {
	AtomicShortModel, CoupledModel, Expression, isAtomicShortModel, isCoupledModel, isOBJECT, isOBJECT_OVERRIDE,
	isObjectExpression, isPortReference,
	isState, isVariableOverride, isVariableReference,
	Model, ModelReference, OBJECT, PropertiesOverride, ReceiveConditionWithOverride2,
	State, StateConfiguration, Variable, VariableOverride, VariableReference
} from "../../language/generated/ast.js";
import {ReelExpressionChecker} from "../../reel-expression-checker.js";
import {
	AtomicModelJson, CoupledModelJson,
	ExpressionJson, ModelReferenceJson,
	PortObjectMap, ReelJson,
	StateConfigurationJson, StateJson,
	StatePropertyJson,
	TransitionJson
} from "./json-types.js";

function generateStateObject(state: State) {
	let stateObject: StateJson = {
		name: state.name,
		properties: flattenStateProperties(state.properties),
		states: state.stateType?.StateName.map(x => x.name) ?? [],
		initialState: state.stateType!.initialState.ref!.name
	}

	return stateObject;
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




function flattenStateProperties(
	properties: Array<Variable | VariableOverride | PropertiesOverride>,
	parentPath: string[] = []
): Array<StatePropertyJson> {
	const result: StatePropertyJson[] = [];

	properties.forEach(prop => {

		const varName = isVariableOverride(prop) ? prop.ref.ref?.name ?? '' : prop.name;
		


		if (isObjectExpression(prop)) {
			result.push(...flattenStateProperties(prop.value.properties, [...parentPath, varName]));
		} else {
			if (isOBJECT_OVERRIDE(prop.value) && isVariableOverride(prop)) {
				result.push(...flattenStateProperties(prop.value.properties, [...parentPath, varName]))
			} else {
				
				if(!isOBJECT(prop.value) && !isOBJECT_OVERRIDE(prop.value)) {
					
					let t: "ObjectExpression" | "BooleanExpression" | "IntegerExpression"  | "StringExpression" | undefined = isVariableOverride(prop)  ? prop.ref.ref?.$type : prop.$type;
					if(t === "ObjectExpression" || t === undefined) {
						throw new Error("ObjectExpression is not supported in this context");
					}
					const name = [...parentPath, varName].join('.');

					result.push(
						{
							name: name,
							type: t,
							value: prop.value
						}
					);
				}
				

			}
		}
	});

	return result;
}

export type ExpressionValueType = 'BooleanExpression' | 'IntegerExpression' | 'ObjectExpression' | 'StringExpression';



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
			variables: [GetVariableName(expr)],
			isAssignment: false,
			returnType: GetVariable(expr)?.$type
		}
	}

	if (isPortReference(expr)) {
		return {
			expression: expr.property.ref?.name ?? '',
			variables: [expr.property.ref?.name ?? ''],
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
		variables: ReelExpressionChecker.GetVariables(expr),
		isAssignment: isAssignment,
		expression: expr.$cstNode!.text
	}
}

function generateTransition(tr: ReceiveConditionWithOverride2): TransitionJson {
	return {
		name: tr.condition.name,
		transitionCondition: tr.condition.expression !== undefined ? ToExpressionJson(tr.condition.expression) : {
			expression: '',
			variables: [],
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

