import {
	ArrayExpression,
	AtomicShortModel, BinaryExpression,
	CoupledModel,
	Expression,
	ExpressionMap,
	isAtomicShortModel,
	isCoupledModel,
	isOBJECT,
	isOBJECT_OVERRIDE,
	isPortReference,
	isState, isVariable,
	isVariableReference,
	Model,
	ModelReference,
	OBJECT, PortReference,
	PropertiesOverride,
	ReceiveConditionWithOverride,
	State,
	StateConfiguration,
	Variable,
	VariableOverride,
	VariableReference,
} from "../../language/generated/ast.js";
import {
	AtomicModelJson, CoupledModelJson,
	ExpressionTreeJson, ModelReferenceJson,
	PortObjectMap, ReelJson,
	StateConfigurationJson, StateJson,
	StatePropertyJson, StatePropValueType,
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


	const importedAtomicModels: Array<AtomicShortModel> = [model, ...otherModel].map(model => model?.fileImports.filter(x => x.modelImport.atomicModel !== undefined).map(x => x.modelImport.atomicModel!.ref!) ?? []).flat();
	const importedCoupledModels: Array<CoupledModel> = [model, ...otherModel].map(model => model?.fileImports.filter(x => x.modelImport.coupledModel !== undefined).map(x => x.modelImport.coupledModel!.ref!) ?? []).flat();
	const importedStates: Array<State> = [model, ...otherModel].map(model => model?.fileImports.filter(x => x.modelImport.atomicModel !== undefined).map(x => x.modelImport.atomicModel!.ref!.stateType.ref!) ?? []).flat();

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


function GetValues(arrayValues: ArrayExpression):  boolean[] | number[] | string[] {
	switch (arrayValues.type) {
		case "bool":
			return arrayValues.BoolElements;
		case "int":
			return arrayValues.IntElements;
		case "string":
			return arrayValues.stringElements;

	}
}


function flattenStateProperties(
	properties: Array<Variable | VariableOverride | PropertiesOverride>,
	parentPath: string[] = []
): Array<StatePropertyJson> {
	const result: StatePropertyJson[] = [];

	properties.forEach(prop => {

		// const varName = isVariableOverride(prop) ? prop.ref.ref?.name ?? '' : prop.name;
		// const name = [...parentPath, varName].join('.');


		switch (prop.$type) {
			case "BooleanExpression":
			case "IntegerExpression":
			case "StringExpression":{
				const name = [...parentPath, prop.name].join('.');
				result.push(
					{
						name: name,
						type: prop.$type,
						value: prop.value
					}
				);
			}
				break;
			case "ArrayExpression":{
				const name = [...parentPath, prop.name].join('.');
				result.push(
					{
						name: name,
						type: MapArrayType(prop.type),
						isArray: true,
						value: GetValues(prop)
					}
				);
			}
				break;
			case "ObjectExpression":
				result.push(...flattenStateProperties(prop.value.properties, [...parentPath, prop.name]));
				break;
			case "VariableOverride":{
				if (isOBJECT_OVERRIDE(prop.value) ) {
					result.push(...flattenStateProperties(prop.value.properties, [...parentPath, prop.ref.ref!.name]));
				} else {
					
					const prop2 = {...prop.ref.ref!, value: prop.value} as Variable;

					// TODO check
					result.push(...flattenStateProperties([prop2], [...parentPath]));
				}
			}
			break;
		}
		
		
		// if (isObjectExpression(prop)) {
		// 	result.push(...flattenStateProperties(prop.value.properties, [...parentPath, varName]));
		// } else {
		// 	if (isVariableOverride(prop) && isOBJECT_OVERRIDE(prop.value) ) {
		// 		result.push(...flattenStateProperties(prop.value.properties, [...parentPath, varName]))
		// 	} else {
		//		
		// 		if(!isOBJECT(prop.value) && !isOBJECT_OVERRIDE(prop.value)) {
		//			
		// 			let t: "ObjectExpression" | "BooleanExpression" | "IntegerExpression"  | "StringExpression" | undefined = isVariableOverride(prop)  ? prop.ref.ref?.$type : prop.$type;
		// 			if(t === "ObjectExpression" || t === undefined) {
		// 				throw new Error("ObjectExpression is not supported in this context");
		// 			}
		// 			const name = [...parentPath, varName].join('.');
		//
		// 			result.push(
		// 				{
		// 					name: name,
		// 					type: t,
		// 					value: prop.value
		// 				}
		// 			);
		// 		}
		//		
		//
		// 	}
		// }
	});

	return result;
}

export type ExpressionValueType = 'BooleanExpression' | 'IntegerExpression' | 'ObjectExpression' | 'StringExpression' | 'ArrayExpression' | 'VoidExpression';




// // TODO: use cstNode or reflect the variable name
// function GetVariableNames(ref: VariableReference): Array<string> {
//	
// 	const result: Array<string> = [];
// 	const prop = ref.property[ref.property.length - 1].ref;
// 	if(isArrayExpression(prop) && ref.propertyArrayAccess?.index !== undefined) {
// 		result.push(...ReelExpressionChecker.GetVariables(ref.propertyArrayAccess.index));
// 	}
// 	if(isArrayExpression(prop) && ref.propertyArrayAccess?.value !== undefined) {
// 		result.push(...ReelExpressionChecker.GetVariables(ref.propertyArrayAccess.value));
// 	}
//	
// 	return [...result, ref.property.map(x => x.ref!.name).join('.')];
// 	// return ref.$cstNode!.text
// }
// TODO: use cstNode or reflect the variable name
// function GetReturnType(ref: VariableReference): ExpressionValueType | undefined {
//	
// 	const prop = ref.property[ref.property.length - 1].ref;
// 	if(isArrayExpression(prop)) {
// 		let arrayElem = ReelInference.getAtomicModel(ref.$container)?.stateType.ref?.properties.find(x => x.name === prop.name)?.$type;
// 		if(arrayElem === undefined) {
// 			throw new Error("Array element type is undefined for "+prop.name);
// 		}
// 		return arrayElem;
// 	}
//	
// 	return prop?.$type;
// 	// return ref.$cstNode!.text
// }

// function GetExpressionValueType(ref: VariableReference):  ExpressionValueType | undefined {
// 	// return last variable, which is not object but variable
// 	const prop = ref.property[ref.property.length - 1].ref;
// 	if(prop === undefined) {
// 		return undefined;
// 	}
// 	if(prop.$type === "ArrayExpression") {
// 		return MapPortType(prop.type)
// 	}
// 	return prop.$type;
//
// }

function MapPortType(valueType: "bool" | "int" | "string" | OBJECT | undefined): ExpressionValueType {
	if (valueType === undefined) {
		throw new Error("Value type is undefined"+JSON.stringify(valueType));
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

function MapArrayType(valueType: "bool" | "int" | "string" ): StatePropValueType {
	if (valueType === undefined) {
		throw new Error("Value type is undefined");
	}

	switch (valueType) {
		case "bool":
			return "BooleanExpression";
		case "int":
			return "IntegerExpression";
		case "string":
			return "StringExpression";
	}
}


function GetValueType(variable: ArrayExpression) {
	switch (variable.type) {
		case "bool":
			return 'BooleanExpression';
		case "int":
			return 'IntegerExpression';
		case "string":
			return 'StringExpression';

	}
}

function ArrayExpressionToExpressionTreeJson(variable: ArrayExpression, expr: VariableReference, name: string): ExpressionTreeJson {
	if(expr.propertyArrayAccess === undefined) {
		return <ExpressionTreeJson> {
			operator: "Literal",
			valueType: GetValueType(variable),
			isLeaf: true,
			value: GetValues(variable),
			variableName: name,
		}
	}
	
	switch (expr.propertyArrayAccess.type) {
		case "append":
			return <ExpressionTreeJson> {
				valueType: "VoidExpression",
				isLeaf: false,
				variableName: name,
				operator: "ArrayAppend",
				left: <ExpressionTreeJson> {
					operator: "Literal",
					valueType: GetValueType(variable),
					isLeaf: true,
					value: GetValues(variable),
					variableName: name,
				},
				right: ToExpressionTreeJson(expr.propertyArrayAccess.value!)
			}
		case "get":
			return <ExpressionTreeJson> {
				valueType: GetValueType(variable),
				isLeaf: false,
				variableName: name,
				operator: "ArrayGet",
				left: <ExpressionTreeJson> {
					operator: "Literal",
					valueType: GetValueType(variable),
					isLeaf: true,
					value: GetValues(variable),
					variableName: name,
				},
				right: ToExpressionTreeJson(expr.propertyArrayAccess.index!)
			}
		case "length":
			return <ExpressionTreeJson> {
				valueType: 'IntegerExpression',
				isLeaf: true,
				variableName: name, // I think variable name is not needd for non Literal nodes, but keeping for now
				operator: "ArrayLength",
				left: <ExpressionTreeJson> {
					operator: "Literal",
					valueType: GetValueType(variable),
					isLeaf: true,
					value: GetValues(variable),
					variableName: name,
				}
			}
		case "push":
			return <ExpressionTreeJson> {
				valueType: "VoidExpression",
				isLeaf: false,
				variableName: name,
				operator: "ArrayPrepend",
				left: <ExpressionTreeJson> {
					operator: "Literal",
					valueType: GetValueType(variable),
					isLeaf: true,
					value: GetValues(variable),
					variableName: name,
				},
				right: ToExpressionTreeJson(expr.propertyArrayAccess.value!)
			}
		case "remove":
			return <ExpressionTreeJson> {
				valueType: "VoidExpression",
				isLeaf: false,
				variableName: name,
				operator: "ArrayRemove",
				left: <ExpressionTreeJson> {
					operator: "Literal",
					valueType: GetValueType(variable),
					isLeaf: true,
					value: GetValues(variable),
					variableName: name,
				},
				right: ToExpressionTreeJson(expr.propertyArrayAccess.index!)
			}
			break;

	}
}

function VariableReferenceToExpressionTreeJson(expr: VariableReference): ExpressionTreeJson {
	let variable = expr.property[expr.property.length - 1].ref;
	if(variable === undefined) {
		throw new Error("Variable reference is undefined");
	}
	const name = expr.property.map(x => x.ref!.name).join('.');
	switch (variable.$type){
		case "BooleanExpression":
		case "StringExpression":
		case "IntegerExpression":
			return <ExpressionTreeJson> {
				operator: "Literal",
				value: variable.value,
				valueType: variable.$type,
				isLeaf: true,
				variableName: name,
			}
		case "ArrayExpression":
			return ArrayExpressionToExpressionTreeJson(variable, expr,name);
		case "ObjectExpression":
			throw new Error("ObjectExpression type is undefined for "+variable.$type);
		
	}
	
}

function getPortObjectPropertyName(expr: PortReference): string | undefined {
    if (expr === undefined) return undefined;

    const ref = expr.objectProperty?.ref;

    if (ref?.$type === "VariableReference") {
        return ref.property[0].ref?.name;
    }
	return ref?.name;
}

function mapSelector(selector: "any" | "first" | 'all' | number) {
	
	if (selector === "any" || selector === "first" || selector === 'all') {
		return selector;
	}
	return "index";
}

function MapValueTypeForPort(expr: PortReference) {
	const port = expr.property.ref;
	if(port === undefined) {
		throw new Error("Port reference is undefined");
	}
	const selector = expr.selector;
	
	if(selector === "any"){
		return "BooleanExpression";
	}
	
	if(isOBJECT(port.valueType)){
		return port.valueType.properties.find(x => x.name === getPortObjectPropertyName(expr))?.$type
	}

	switch (port.valueType){
		case "bool":
			return 'BooleanExpression';
		case "int":
			return 'IntegerExpression';
		case "string":
			return 'StringExpression';
		default:
			throw new Error("Unsupported port value type: "+port.valueType);
	}
}

function PortReferenceToExpressionTreeJson(expr: PortReference): ExpressionTreeJson {
	const port = expr.property.ref;
	if(port === undefined) {
		throw new Error("Port reference is undefined");
	}

	return <ExpressionTreeJson>{
		operator: "Literal",
		valueType: MapValueTypeForPort(expr),
		isLeaf: true,
		portObjectPropertyName: getPortObjectPropertyName(expr),
		portAccessor: mapSelector(expr.selector),
		portAccessorIndex: mapSelector(expr.selector) === "index" ? expr.selector as number : undefined,
		variableName: port.name,
		isPort: true
	};
}

function BinaryExpressionToExpressionTreeJson(expr: BinaryExpression): ExpressionTreeJson {
	const left = ToExpressionTreeJson(expr.left);
	const right = ToExpressionTreeJson(expr.right);

	return {
		operator: expr.operator,
		isLeaf: false,
		valueType: "VoidExpression",
		left: left,
		right: right
	};
}

function ParseLiteral(expr: BinaryExpression) : ExpressionTreeJson{
	let value = expr.$cstNode?.text;
	if(value === undefined) {
		throw new Error("Literal value is undefined");
	}
	
	if(value === "Infinity") {
		return <ExpressionTreeJson>{
			operator: "Literal",
			valueType: 'IntegerExpression',
			isLeaf: true,
			value: 'Infinity'
		};
	}
	if(value === "CurrentTime") {
		return <ExpressionTreeJson>{
			operator: "Literal",
			valueType: 'IntegerExpression',
			isLeaf: true,
			value: 'CurrentTime'
		};
	}
	
	if(value === 'true' || value === 'false') {
		return <ExpressionTreeJson>{
			operator: "Literal",
			valueType: 'BooleanExpression',
			isLeaf: true,
			value: value
		};
	}
	
	if(isNaN(Number(value))) {
		// not a number, treat as string
		return <ExpressionTreeJson>{
			operator: "Literal",
			valueType: 'StringExpression',
			isLeaf: true,
			value: value
		};
	}
	
	
	return <ExpressionTreeJson>{
		operator: "Literal",
		valueType: 'IntegerExpression',
		isLeaf: true,
		value: Number(value)
	};
}

function ToExpressionTreeJson(expr: Expression): ExpressionTreeJson {

	if (isVariableReference(expr)) {
		return VariableReferenceToExpressionTreeJson(expr);
		
		// return {
		// 	expression: expr.$cstNode?.text ?? '',
		// 	variables: GetVariableNames(expr),
		// 	isAssignment: false,
		// 	returnType: GetReturnType(expr)
		// }
	}

	if (isPortReference(expr)) {
		return PortReferenceToExpressionTreeJson(expr);
	}

	// let returnType = ReelExpressionChecker.CheckType(expr);
	// if (ReelExpressionChecker.isError(returnType) || returnType === 'unknown') {
	// 	throw returnType;
	// }
	console.log(expr);
	
	// special case catch constant Infinity
	
	if(expr.left === undefined && expr.right === undefined){
		// this happens for literals
		return ParseLiteral(expr)
	}
	
	return BinaryExpressionToExpressionTreeJson(expr);

	// const topExpression = ReelExpressionChecker.GetTopExpression(expr);
	// const isAssignment = topExpression.operator === '=';
	// return {
	// 	returnType: returnType,
	// 	variables: ReelExpressionChecker.GetVariables(expr),
	// 	isAssignment: isAssignment,
	// 	expression: expr.$cstNode!.text
	// }
}

function generateTransition(tr: ReceiveConditionWithOverride): TransitionJson {
	return {
		name: tr.condition.name,
		transitionCondition: tr.condition.expression !== undefined ? ToExpressionTreeJson(tr.condition.expression) : <ExpressionTreeJson>{
			operator: "Literal",
			valueType: 'BooleanExpression',
			isLeaf: true,
			value: true
		},
		transitionNewStateTypeRef: tr.overrides.stateRef.ref!.name,
		transitionStateModifications: tr.overrides.properties.map(mod => ToExpressionTreeJson(mod))

	}
}

function MapToExpressionTreeJson(expressionMap: ExpressionMap): Map<string, ExpressionTreeJson> {
	const result = new Map<string, ExpressionTreeJson>();
	expressionMap.mapEntries.forEach(entry => {
		// property must only have one elem since this variable reference is to a port

		const key = isVariable(entry.key.ref) ? entry.key.ref?.name : entry.key.ref!.property[0].ref!.name;
		result.set(key, ToExpressionTreeJson(entry.value));
	});
	return result;
}

function generateStateConfiguration(sc: StateConfiguration): StateConfigurationJson {
	return {
		stateTypeRef: sc.stateRef.ref!.name,
		timeAdvanceExpression: ToExpressionTreeJson(sc.timeAdvance.timeAdvance),
		transitions: sc.transitions.map(tr => generateTransition(tr)),
		output: sc.output.map(out => ({
			port: out.portRef.ref!.name,
			value: out.expressionMap !== undefined  ? MapToExpressionTreeJson(out.expressionMap) : new Map<string,ExpressionTreeJson>([["",ToExpressionTreeJson(out.expression!)]])
		}))
	}
}

function MapValueType(valueType: "bool" | "int" | "string" | OBJECT): Array<PortObjectMap> | 'bool' | 'int' | 'string' {
	
	if(isOBJECT(valueType)) {
		return valueType.properties.map(prop => {


			let valueTypeMapped: 'bool' | 'int' | 'string';

			switch (prop.$type){
				case "BooleanExpression":
					valueTypeMapped = 'bool';
					break;
				case "ArrayExpression":
					valueTypeMapped = prop.type;
					break;
				case "IntegerExpression":
					valueTypeMapped = 'int';
					break;
				case "ObjectExpression":
					throw new Error("OBJECT type is not supported in this context");
				case "StringExpression":
					valueTypeMapped = 'string';
					break;
			}
			return <PortObjectMap>{
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

