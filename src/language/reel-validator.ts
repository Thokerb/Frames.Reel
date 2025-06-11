import type {ValidationAcceptor, ValidationChecks} from 'langium';
import {
	Expression,
	isBinaryExpression,
	isVariableReference,
	OBJECT,
	OBJECT_OVERRIDE,
	ObjectExpression,
	OutputCase,
	OutputMap,
	type ReelAstType,
	State,
	StateDefinitionOverrides,
	type VariableOverride,
	PortReference,
	isPortReference,
	TimeAdvanceStateConfiguration,
	ReceiveCondition2,
	StateDefinitionOverridesWithBecome,
	PortConfiguration,
	Port,
	Properties,
	PropertiesOverride,
	isReceiveConditionWithOverride2,
	CouplingDefinition, isOBJECT
} from './generated/ast.js';
import type {ReelServices} from './reel-module.js';
import {ReelExpressionChecker} from "../reel-expression-checker.js";

/**
 * Register custom validation checks.
 */
export function registerValidationChecks(services: ReelServices) {
	const registry = services.validation.ValidationRegistry;
	const validator = services.validation.ReelValidator;
	const checks: ValidationChecks<ReelAstType> = {
		// AtomicModel: validator.checkPersonStartsWithCapital
		VariableOverride: validator.checkVariableDeclaration,
		State: validator.checkUniqueParams,
		StateDefinitionOverrides: validator.checkUniqueParamsStateOverride,
		OBJECT_OVERRIDE: validator.checkUniqueParamsObjectOverride,
		ObjectExpression: validator.checkUniqueParamsObjectExpression,
		Expression: validator.binaryExpressionCheck,
		OutputMap: validator.outputMapCheck,
		OutputCase: validator.outputCaseCheck,
		TimeAdvanceStateConfiguration: validator.timeAdvanceCaseCheck,
		ReceiveCondition2: validator.receiveCondition2Check,
		StateDefinitionOverridesWithBecome: validator.stateDefinitionOverridesWithBecomeCheck,
		PortConfiguration: validator.portConfigurationCheck,
		CouplingDefinition: validator.couplingDefinitionCheck,
	};
	registry.register(checks, validator);
}

/**
 * Implementation of custom validations.
 */
export class ReelValidator {


	checkUniqueParamsObjectOverride(def: OBJECT_OVERRIDE, accept: ValidationAcceptor): void {
		const reported = new Set();
		def.properties.forEach((p: VariableOverride) => {
			if (reported.has(p.ref.ref?.name)) {
				accept('error', `Param ${p.ref.ref?.name} is non-unique for Def '${p.ref.ref?.name}'`, {
					node: p,
					property: 'ref'
				});
			}
			reported.add(p.ref.ref?.name);
		});
	}

	portConfigurationCheck(def: PortConfiguration, accept: ValidationAcceptor): void {
		const reported = new Set();
		def.ports.forEach((p: Port) => {
			if (reported.has(p?.name)) {
				accept('error', `Param ${p?.name} is non-unique for Def '${p?.name}'`, {
					node: p,
					property: 'name'
				});
			}
			reported.add(p?.name);
		});
	}

	couplingDefinitionCheck(def: CouplingDefinition, accept: ValidationAcceptor): void {

		const leftPortType = def.sourcePort.ref?.valueType;
		const rightPortType = def.targetPort.ref?.valueType;

		if (leftPortType === undefined || rightPortType === undefined) {
			return;
		}

		if (isOBJECT(leftPortType)) {
			if (!isOBJECT(rightPortType)) {
				accept('error', `Type '${rightPortType}' is not assignable to type '${leftPortType}'.`, {
					node: def,
					property: 'targetPort'
				});
			} else if (isOBJECT(rightPortType)) {
				leftPortType.properties.forEach((leftProp) => {
					const rightProp = rightPortType.properties.find(p => p.name === leftProp.name);
					
					const targetModel = def.thisTargetModel ? def.$container.name : def.targetModel?.ref?.name ?? '';
					const sourceModel = def.thisSourceModel ? def.$container.name : def.sourceModel?.ref?.name ?? '';
					
					if (rightProp === undefined) {
						accept('error', `Property '${leftProp.name}'  does not exist in ${targetModel}.${def.targetPort.ref?.name}'.`, {
							node: def,
							property: 'targetPort'
						});
					} else if (leftProp.$type !== rightProp.$type || leftProp.name !== rightProp.name) {
						accept('error', `Property '${leftProp.name}' in ${sourceModel}.${def.sourcePort.ref?.name} is not assignable to property '${rightProp.name}' in ${targetModel}.${def.targetPort.ref?.name}
						Must be of type '${leftProp.$type}' but is of type '${rightProp.$type}'.
						`, {
							node: def,
							property: 'targetPort'
						});
					}
				});
			}
			return;
		}
		if(leftPortType !== rightPortType) {
			accept('error', `Type '${rightPortType}' is not assignable to type '${leftPortType}'.`, {
				node: def,
				property: 'targetPort'
			});
		}

	}

	checkUniqueParamsObjectExpression(def: ObjectExpression, accept: ValidationAcceptor): void {
		const reported = new Set();
		def.value.properties.forEach((p: Properties) => {
			if (reported.has(p.name)) {
				accept('error', `Param ${p.name} is non-unique for Def '${p.name}'`, {node: p, property: 'name'});
			}
			reported.add(p.name);
		});
	}

	outputCaseCheck(def: OutputCase, accept: ValidationAcceptor): void {
		const reported = new Set();
		def.output.forEach((p: OutputMap) => {
			if (p.portRef.ref?.name && reported.has(p.portRef.ref?.name)) {
				accept('error', `Param ${p.portRef.ref?.name} is non-unique for Def '${p.portRef.ref?.name}'`, {
					node: p,
					property: 'portRef'
				});
			}
			if (p.portRef.ref?.name) {
				reported.add(p.portRef.ref?.name);
			}
		});
	}

	outputMapCheck(def: OutputMap, accept: ValidationAcceptor): void {
		const port = def.portRef.ref;
		if (port === undefined) {
			return;
		}
		const rightType = ReelExpressionChecker.CheckType(def.expression);
		if (rightType === 'unknown') {
			accept('error', `Type '${rightType}' is not assignable to type '${port.$type}'.`, {
				node: def,
				property: 'expression'
			});
			return;
		}
		if (ReelExpressionChecker.isError(rightType)) {
			accept('error', `Type '${rightType.error}' is not compatible to type '${rightType.node}'.`, {
				node: rightType.node,
				property: rightType.property
			});
			return;
		}

		let isNoError = true;

		switch (port.valueType) {
			case "bool":
				isNoError = rightType === 'BooleanExpression';
				break;
			case "int":
				isNoError = rightType === 'IntegerExpression';
				break;
			case "string":
				isNoError = rightType === 'StringExpression';
				break;
		}
		if (!isNoError) {
			accept('error', `Type '${rightType}' is not assignable to type '${port.valueType}'.`, {
				node: def,
				property: 'expression'
			});
		}
	}

	checkUniqueParams(def: State, accept: ValidationAcceptor): void {
		const reported = new Set();
		def.properties.forEach((p: Properties) => {
			if (reported.has(p.name)) {
				accept('error', `Param ${p.name} is non-unique for Def '${def.name}'`, {node: p, property: 'name'});
			}
			reported.add(p.name);
		});
	}

	checkUniqueParamsStateOverride(def: StateDefinitionOverrides, accept: ValidationAcceptor): void {
		const reported = new Set();
		def.properties.forEach((p: PropertiesOverride) => {
			if (reported.has(p.ref.ref?.name)) {
				accept('error', `Param ${p.ref.ref?.name} is non-unique for Def '${p.ref.ref?.name}'`, {
					node: p,
					property: 'ref'
				});
			}
			reported.add(p.ref.ref?.name);
		});
	}

	checkVariableDeclaration(decl: VariableOverride, accept: ValidationAcceptor): void {
		if (decl.ref !== undefined && decl.value !== undefined) {
			const left = ReelExpressionChecker.inferType(decl.ref);
			const right = this.inferRightType(decl.value);

			if (right === 'unknown' || left === 'unknown') {
				accept('error', `Type '${right}' is not assignable to type '${left}'.`, {
					node: decl,
					property: 'value'
				});
				return;
			}

			if (right !== left) {
				accept('error', `Type '${right}' is not assignable to type '${left}'.`, {
					node: decl,
					property: 'value'
				});
				return;
			}
		}
	}

	inferRightType(node: string | number | boolean | OBJECT_OVERRIDE | OBJECT): string {
		if (typeof node === 'string') {
			return 'StringExpression';
		} else if (typeof node === 'number') {
			return 'IntegerExpression';
		} else if (typeof node === 'boolean') {
			return 'BooleanExpression';
		} else if (typeof node === 'object') {
			return 'ObjectExpression';
		}
		return typeof node;

	}

	// we only check that it is a valid binary expression
	binaryExpressionCheck(node: Expression | PortReference, accept: ValidationAcceptor) {

		if (isPortReference(node)) {
			return;
		}

		if (isVariableReference(node)) {
			return;
		}

		const topExpression = ReelExpressionChecker.GetTopExpression(node);
		const isAssignment = topExpression.operator === '=';
		if (isAssignment) {

			if (!isVariableReference(topExpression.left)) {
				accept('error', `Left side of assignment must be a VariableReference.`, {
					node: topExpression.left,
					property: 'left'
				});
				return;
			}

			// if(isPortReference(topExpression.right)){
			// 	accept('error', `PortReference is not allowed on the right side of an assignment.`, {
			// 		node: topExpression.right,
			// 		property: 'property'
			// 	});
			// 	return;
			// }

			const rightType = ReelExpressionChecker.CheckType(topExpression.right);
			const leftType = ReelExpressionChecker.CheckType(topExpression.left);
			if (ReelExpressionChecker.isError(rightType)) {
				accept('error', `Type '${rightType.error}' is not compatible to type '${rightType.node}' in assignment.`, {
					node: rightType.node,
					property: rightType.property
				});
				return;
			}
			if (leftType !== rightType) {
				accept('error', `Type '${rightType}' is not assignable to type '${leftType}' in assignment.`, {
					node: node,
					property: 'right'
				});
				return;
			}
		}


		//
		// if (isStateDefinitionOverridesWithBecome(node.$container)) {
		//
		// 	const topExpression = ReelExpressionChecker.GetTopExpression(node);
		//
		// 	// operator must be = 
		// 	if (node.operator === undefined) {
		// 		accept('error', `Required value 'operator' is missing.`, {
		// 			node: node,
		// 			property: 'operator'
		// 		});
		// 	}
		// 	if (topExpression.operator !== '=') {
		// 		accept('error', `Type '${node.operator}' is not assignable to type 'StateDefinitionOverridesWithBecome'.`, {
		// 			node: node,
		// 			property: 'operator'
		// 		});
		// 	}
		//
		// 	const leftType = ReelExpressionChecker.CheckType(node.left);
		// 	const rightType = ReelExpressionChecker.CheckType(node.right);
		//
		// 	if (ReelExpressionChecker.CompareLeftRightHasError(leftType, rightType, node, accept)) {
		// 		return;
		// 	}
		//
		// 	return;
		//
		// }
		//
		//
		// if (isTimeAdvanceCase(node.$container)) {
		//
		// 	if (node.$cstNode?.text === 'Infinity') {
		// 		return;
		// 	}
		//
		// 	if (node.operator === undefined && node?.$cstNode?.text !== undefined) {
		// 		return;
		// 	} else {
		// 		if (node.operator === undefined) {
		// 			accept('error', `Required value 'TimeValue' is missing.`, {
		// 				node: node,
		// 				property: 'operator'
		// 			});
		// 		}
		// 	}
		//
		// 	if (node.operator !== '+' && node.operator !== '-') {
		// 		accept('error', `Type '${node.operator}' is not assignable to type 'isTimeAdvanceCase'.`, {
		// 			node: node,
		// 			property: 'operator'
		// 		});
		// 	} else {
		// 		return;
		// 	}
		// }
		//
		// if(isTimeAdvanceStateConfiguration(node.$container)) {
		// 	return;
		// }
		//
		//
		//
		// if (node.left === undefined || node.right === undefined) {
		// 	return;
		// }
		//
		//
		// const leftType = ReelExpressionChecker.CheckType(node.left);
		// const rightType = ReelExpressionChecker.CheckType(node.right);
		//
		//
		// if (ReelExpressionChecker.CompareLeftRightHasError(leftType, rightType, node, accept)) {
		// 	return;
		// }
		//
		//
		// let isNoError = true;
		//
		//
		// switch (leftType) {
		// 	case "BooleanExpression":
		// 		isNoError = node.operator === "==" || node.operator === "!=";
		// 		break;
		// 	case "ObjectExpression":
		// 		isNoError = true;
		// 		break;
		// 	case "IntegerExpression":
		// 		isNoError = node.operator === "==" || node.operator === "!=" || node.operator === "<" || node.operator === "<=" || node.operator === ">" || node.operator === ">=";
		// 		break;
		// 	case "StringExpression":
		// 		isNoError = node.operator === "==" || node.operator === "!=";
		// 		break;
		// 	case "unknown":
		// 		isNoError = true;
		// 		break;
		// }
		//
		// const rootNode = ReelExpressionChecker.GetTopExpression(node);
		// const isAssignment = rootNode.operator === "=";
		//
		//
		// if (!isNoError && !isAssignment) {
		// 	accept('error', `Type '${node.operator}' is not assignable to type '${leftType} for comparison'.`, {
		// 		node: node,
		// 		property: 'operator'
		// 	});
		// }
	}


	timeAdvanceCaseCheck(conf: TimeAdvanceStateConfiguration, accept: ValidationAcceptor) {
		if (isPortReference(conf.timeAdvance)) {
			accept('error', `PortReference is not allowed in TimeAdvanceStateConfiguration.`, {
				node: conf.timeAdvance,
				property: 'property'
			});
			return;
		}

		if (conf.timeAdvance === undefined) {
			accept('error', `Required value 'timeAdvance' is missing.`, {
				node: conf,
				property: 'timeAdvance'
			});
			return;
		}

		if (conf.timeAdvance.$cstNode?.text === 'Infinity') {
			return;
		}

		if (isVariableReference(conf.timeAdvance)) {
			const type = ReelExpressionChecker.CheckType(conf.timeAdvance);
			if (type !== 'IntegerExpression') {
				accept('error', `Type '${type}' is not assignable to type 'IntegerExpression'.`, {
					node: conf.timeAdvance,
					property: 'property'
				});
			}
			return;
		}

		if (isBinaryExpression(conf.timeAdvance)) {
			const topExpression = ReelExpressionChecker.GetTopExpression(conf.timeAdvance);
			const type = ReelExpressionChecker.CheckType(topExpression);
			if (type !== 'IntegerExpression') {
				accept('error', `Type '${type}' is not assignable to type 'IntegerExpression'.`, {
					node: conf.timeAdvance,
					property: 'operator'
				});
			}
		}

	}


	stateDefinitionOverridesWithBecomeCheck(condition: StateDefinitionOverridesWithBecome, accept: ValidationAcceptor) {

		condition.properties?.forEach((prop: Expression) => {
			let type = ReelExpressionChecker.CheckType(prop, "OutPort")
			if (ReelExpressionChecker.isError(type)) {
				accept('error', type.error, {
					node: type.node,
					property: 'PortType'
				});
				return;
			}
		});

		// set allowed Inports, whic are only these checked in the expression
		if (isReceiveConditionWithOverride2(condition.$container)) {
			const ports: Array<PortReference> | undefined = ReelExpressionChecker.GetUsedPorts(condition.$container.condition.expression)
			condition.properties.forEach(prop => {
				ReelExpressionChecker.AllowedPortTypes(prop, ports, accept);
			})
		}


	}


	receiveCondition2Check(condition: ReceiveCondition2, accept: ValidationAcceptor) {

		const expression = condition.expression;
		if (expression === undefined) {
			return;
		}


		if (isPortReference(expression) && expression.portType === "OutPort") {
			accept('error', `OutPort is not valid in transition condition.`, {
				node: expression,
				property: 'property'
			});
			return;
		}

		if (isVariableReference(expression)) {
			const type = ReelExpressionChecker.CheckType(expression);
			if (type !== 'BooleanExpression') {
				accept('error', `Type '${type}' is not assignable to type 'BooleanExpression'.`, {
					node: expression,
					property: 'property'
				});
			}
			return;
		}

		if (isBinaryExpression(expression)) {
			const topExpression = ReelExpressionChecker.GetTopExpression(expression);
			const type = ReelExpressionChecker.CheckType(topExpression, "OutPort");
			if (type !== 'BooleanExpression') {

				const errMessage = ReelExpressionChecker.isError(type) ? type.error : `Type '${type}' is not assignable to type 'BooleanExpression'.`;

				accept('error', errMessage, {
					node: expression,
					property: ReelExpressionChecker.isError(type) ? type.which : 'operator'
				});
			}
		}

	}
}

