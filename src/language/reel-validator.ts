import type {Reference, ValidationAcceptor, ValidationChecks} from 'langium';
import {
	BinaryExpression,
	Expression,
	isBinaryExpression,
	isStateDefinitionOverridesWithBecome,
	isTimeAdvanceCase,
	isVariableReference,
	OBJECT,
	OBJECT_OVERRIDE,
	ObjectExpression,
	type ReelAstType,
	State,
	StateDefinitionOverrides,
	type Variable,
	type VariableOverride
} from './generated/ast.js';
import type {ReelServices} from './reel-module.js';

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
	};
	registry.register(checks, validator);
}

/**
 * Implementation of custom validations.
 */
export class ReelValidator {


	checkUniqueParamsObjectOverride(def: OBJECT_OVERRIDE, accept: ValidationAcceptor): void {
		const reported = new Set();
		def.properties.forEach(p => {
			if (reported.has(p.ref.ref?.name)) {
				accept('error', `Param ${p.ref.ref?.name} is non-unique for Def '${p.ref.ref?.name}'`, {
					node: p,
					property: 'ref'
				});
			}
			reported.add(p.ref.ref?.name);
		});
	}
	
	checkUniqueParamsObjectExpression(def: ObjectExpression, accept: ValidationAcceptor): void {
		const reported = new Set();
		def.value.properties.forEach(p => {
			if (reported.has(p.name)) {
				accept('error', `Param ${p.name} is non-unique for Def '${p.name}'`, {node: p, property: 'name'});
			}
			reported.add(p.name);
		});
	}

	checkUniqueParams(def: State, accept: ValidationAcceptor): void {
		const reported = new Set();
		def.properties.forEach(p => {
			if (reported.has(p.name)) {
				accept('error', `Param ${p.name} is non-unique for Def '${def.name}'`, {node: p, property: 'name'});
			}
			reported.add(p.name);
		});
	}

	checkUniqueParamsStateOverride(def: StateDefinitionOverrides, accept: ValidationAcceptor): void {
		const reported = new Set();
		def.properties.forEach(p => {
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
			const left = this.inferType(decl.ref);
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

	inferRightType(node: string | number | boolean | OBJECT_OVERRIDE | OBJECT ): string {
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

	inferType(node: Reference<Variable>):  "BooleanExpression" | "ObjectExpression" | "IntegerExpression" | "StringExpression" | "unknown" {
		return node.ref?.$type ?? 'unknown';
	}

	binaryExpressionCheck(node: Expression, accept: ValidationAcceptor) {
		function isBinaryOrBoolean(left: Expression) {
			return isBinaryExpression(left) || (isVariableReference(left) && left.property[left.property.length - 1].ref?.$type === 'BooleanExpression');
		}

		// we always check the top node down
		
		
		if (isVariableReference(node)) {
			return;
		}

		if (isStateDefinitionOverridesWithBecome(node.$container)) {

			const topExpression = this.GetTopExpression(node);
			
			// operator must be = 
			if (node.operator === undefined) {
				accept('error', `Required value 'operator' is missing.`, {
					node: node,
					property: 'operator'
				});
			}
			if (topExpression.operator !== '=') {
				accept('error', `Type '${node.operator}' is not assignable to type 'StateDefinitionOverridesWithBecome'.`, {
					node: node,
					property: 'operator'
				});
			}

			const leftType = this.CheckType(node.left);
			const rightType = this.CheckType(node.right);

			if (this.CompareLeftRightHasError(leftType, rightType, node, accept)) {
				return;
			}

			return;

		}


		if (isTimeAdvanceCase(node.$container)) {

			if (node.$cstNode?.text === 'Infinity') {
				return;
			}

			if (node.operator === undefined && node?.$cstNode?.text !== undefined) {
				return;
			} else {
				if (node.operator === undefined) {
					accept('error', `Required value 'TimeValue' is missing.`, {
						node: node,
						property: 'operator'
					});
				}
			}

			if (node.operator !== '+' && node.operator !== '-') {
				accept('error', `Type '${node.operator}' is not assignable to type 'isTimeAdvanceCase'.`, {
					node: node,
					property: 'operator'
				});
			} else {
				return;
			}
		}


		if (node.left === undefined || node.right === undefined) {
			return;
		}


		const leftType = this.CheckType(node.left);
		const rightType = this.CheckType(node.right);

		if (node.operator === "and" || node.operator === "or") {
			if (isBinaryOrBoolean(node.left) && isBinaryOrBoolean(node.right)) {
				return;
			}
		}

		if (this.CompareLeftRightHasError(leftType, rightType, node, accept)) {
			return;
		}


		let isNoError = true;


		switch (leftType) {
			case "BooleanExpression":
				isNoError = node.operator === "==" || node.operator === "!=";
				break;
			case "ObjectExpression":
				isNoError = true;
				break;
			case "IntegerExpression":
				isNoError = node.operator === "==" || node.operator === "!=" || node.operator === "<" || node.operator === "<=" || node.operator === ">" || node.operator === ">=";
				break;
			case "StringExpression":
				isNoError = node.operator === "==" || node.operator === "!=";
				break;
			case "unknown":
				isNoError = true;
				break;
		}

		const rootNode = this.GetTopExpression(node);
		const isAssignment = rootNode.operator === "=";


		if (!isNoError && !isAssignment) {
			accept('error', `Type '${node.operator}' is not assignable to type '${leftType} for comparison'.`, {
				node: node,
				property: 'operator'
			});
		}
	}
	
	
	private CheckType(node: Expression): "BooleanExpression" | "ObjectExpression" | "IntegerExpression" | "StringExpression" | "unknown" | Error {
		
		if (isVariableReference(node)){
			// get last element of the path
			return this.inferType(node.property[node.property.length - 1])
		}
		if(isBinaryExpression(node))
		{
			return this.checkBinary(node)
		}
		
		// in this case node is a literal
		// force get node.cstNode.text
		const text = (node as any).$cstNode.text;
		
		if (text === undefined) {
			return <Error>{
				error: `Type '${node}' is not correct`,
				node: node,
				property: 'left'
			}
		}
		
		// check if text is a number
		if (!isNaN(text)) {
			return 'IntegerExpression';
		}
		// check if text is a boolean
		if (text === 'true' || text === 'false') {
			return 'BooleanExpression';
		}
		// check if text is a string
		return "StringExpression";
	}
	
	private checkBinary(node: BinaryExpression): Error | "BooleanExpression" | "ObjectExpression" | "IntegerExpression" | "StringExpression" | "unknown" {

		const leftType = this.CheckType(node.left);
		
		if (isError(leftType)) {
			return leftType;
		}
		
		const rightType = this.CheckType(node.right);
		
		if (isError(rightType)) {
			return rightType;
		}
		
		if (leftType !== rightType) {
			return <Error>{
				error: `Type '${leftType}' is not compatible to type '${rightType}'.`,
				node: node,
				property: 'left'
			}
		}
		
		if(this.isComparisonOperator(node.operator)){
			return "BooleanExpression"
		}
		
		return leftType;
	}


	private CompareLeftRightHasError(leftType: "BooleanExpression" | "ObjectExpression" | "IntegerExpression" | "StringExpression" | "unknown" | Error, rightType: "BooleanExpression" | "ObjectExpression" | "IntegerExpression" | "StringExpression" | "unknown" | Error,node:BinaryExpression, accept: ValidationAcceptor): boolean {
		if(isError(leftType)) {
			accept('error', `Type '${leftType.node} is not correct'.`, {
				node: leftType.node,
				property: leftType.property
			});
			return true;
		}
		if(isError(rightType)) {
			accept('error', `Type '${rightType.error}' is not compatible to type '${rightType.node}'.`, {
				node: rightType.node,
				property: rightType.property
			});
			return true;
		}

		if (leftType !== rightType) {
			accept('error', `Type '${leftType}' is not compatible to type '${rightType}'.`, {
				node: node,
				property: 'left'
			});
			return true;
		}
		
		return false;
	}

	private GetTopExpression(node: BinaryExpression): BinaryExpression {
		
		let current = node;
		while (true){
			
			if(isBinaryExpression(current.$container)){
				current = current.$container;
			}else{
				break;
			}
		}
		return current;
	}

	private isComparisonOperator(operator: "!=" | "*" | "+" | "-" | "/" | "<" | "<=" | "=" | "==" | ">" | ">=" | "and" | "or") {
		return operator === "!=" || operator === "==" || operator === "<" || operator === "<=" || operator === ">" || operator === ">=";
	}
}

function isError(node: any): node is Error {
	return (node as Error).error !== undefined;
}
interface Error {
	error: string;
	node: Expression;
	property: string;
}