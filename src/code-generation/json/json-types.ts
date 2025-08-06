import {PortType} from "../../language/generated/ast.js";
import {ExpressionValueType} from "./reel-json-generate.js";

export interface StatePropertyJson {
	name: string;
	type: "BooleanExpression" | "IntegerExpression" | "StringExpression" ;
	value: string | number | boolean | undefined; // This could be more specific based on the type of the property
	// Add other relevant fields as needed
}

export interface StateJson {
	name: string;
	states: Array<string>;
	initialState: string;
	properties: Array<StatePropertyJson>;
}

export interface ExpressionJson {
	expression: string;
	variables: Array<string>;
	isAssignment?: boolean; // Indicates if this expression is an assignment
	returnType?: ExpressionValueType // The type of the expression, e.g., 'int', 'bool', 'string', etc.
}


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

