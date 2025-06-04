import {
	BinaryExpression,
	Expression,
	isBinaryExpression,
	isPortReference,
	isVariableReference,
	PortReference, PortType, type Variable
} from "./language/generated/ast.js";
import type {Reference, ValidationAcceptor} from "langium";

export class ReelExpressionChecker {


	static inferType(node: Reference<Variable>):  "BooleanExpression" | "ObjectExpression" | "IntegerExpression" | "StringExpression" | "unknown" {
		return node.ref?.$type ?? 'unknown';
	}
	
	public static CheckType(node: Expression | PortReference, illegalPortType?: PortType): "BooleanExpression" | "ObjectExpression" | "IntegerExpression" | "StringExpression" | "unknown" | Error {

		if(isPortReference(node)) {
			
			if(illegalPortType && node.property.ref?.type === illegalPortType) {
				return <Error>{
					error: `Port type '${node.property.ref?.type}' is not allowed here.`,
					node: node,
					property: 'property',
					which: 'left'
				}
			}
			
			switch (node.property.ref?.valueType){
				case "bool":
					return  'BooleanExpression';
				case "int":
					return  'IntegerExpression';

				case "string":
					return  'StringExpression';
			}
		}

		if (isVariableReference(node)){
			// get last element of the path
			return this.inferType(node.property[node.property.length - 1])
		}
		if(isBinaryExpression(node))
		{
			return this.checkBinary(node, illegalPortType)
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

	public static  checkBinary(node: BinaryExpression, illegalPortType?: PortType): Error | "BooleanExpression" | "ObjectExpression" | "IntegerExpression" | "StringExpression" | "unknown" {

		let leftType = this.CheckType(node.left, illegalPortType);

		if (ReelExpressionChecker.isError(leftType)) {
			return {...leftType, which: 'left'};
		}

		let rightType = this.CheckType(node.right, illegalPortType);

		if (ReelExpressionChecker.isError(rightType)) {
			return {...rightType, which: 'right'};
		}
		
		if(node.operator === "and" || node.operator === "or") {
			if(isPortReference(node.right)){
				rightType = 'BooleanExpression';
			}
			if(isPortReference(node.left)){
				leftType = 'BooleanExpression';
			}
		}

		if (leftType !== rightType) {
			return <Error>{
				error: `Type '${leftType}' is not compatible to type '${rightType}'.`,
				node: node,
				property: 'left',
				which: 'left'
			}
		}

		if(this.isComparisonOperator(node.operator)){
			return "BooleanExpression"
		}

		return leftType;
	}


	public static  CompareLeftRightHasError(leftType: "BooleanExpression" | "ObjectExpression" | "IntegerExpression" | "StringExpression" | "unknown" | Error, rightType: "BooleanExpression" | "ObjectExpression" | "IntegerExpression" | "StringExpression" | "unknown" | Error,node:BinaryExpression, accept: ValidationAcceptor): boolean {
		if(ReelExpressionChecker.isError(leftType)) {
			accept('error', `Type '${leftType.node} is not correct'.`, {
				node: leftType.node,
				property: leftType.property
			});
			return true;
		}
		if(ReelExpressionChecker.isError(rightType)) {
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


	public static isError(node: any): node is Error {
		return (node as Error).error !== undefined;
	}
	
	public static GetTopExpression(node: BinaryExpression): BinaryExpression {

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

	public static  isComparisonOperator(operator: "!=" | "*" | "+" | "-" | "/" | "<" | "<=" | "=" | "==" | ">" | ">=" | "and" | "or") {
		return operator === "!=" || operator === "==" || operator === "<" || operator === "<=" || operator === ">" || operator === ">=";
	}


	public static isBinaryOrBoolean(expr: Expression) {
		return isBinaryExpression(expr) || (isVariableReference(expr) && expr.property[expr.property.length - 1].ref?.$type === 'BooleanExpression');
	}

}

export interface Error {
	error: string;
	node: Expression;
	property: string;
	which: 'left' | 'right';
}