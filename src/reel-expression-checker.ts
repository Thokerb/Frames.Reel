import {
	BinaryExpression,
	Expression, isArrayExpression,
	isBinaryExpression, isOBJECT,
	isPortReference,
	isVariable,
	isVariableReference,
	PortReference, PortType, Variable, VariableReference
} from "./language/generated/ast.js";
import type { ValidationAcceptor} from "langium";
import {ExpressionValueType} from "./code-generation/json/reel-json-generate.js";

function MapExpressionValueType(type: "bool" | "int" | "string"): ExpressionValueType {
	switch (type) {
		case "bool":
			return 'BooleanExpression';
		case "int":
			return 'IntegerExpression';
		case "string":
			return 'StringExpression';
	}
}

export class ReelExpressionChecker {


	static inferType(nodeRef: VariableReference | Variable): ExpressionValueType | "unknown" {


		if(isVariable(nodeRef)) {
			const node = nodeRef;
			return node.$type;
		}

		const node = nodeRef.property[nodeRef.property.length - 1];
		
		if(isArrayExpression(node.ref) && nodeRef.propertyArrayAccess !== undefined) {
			switch (nodeRef.propertyArrayAccess.type) {
				case "append":
					return "VoidExpression"
				case "get":
					return MapExpressionValueType(node.ref.type)
				case "length":
					return "IntegerExpression";
				case "push":
					return "VoidExpression"
				case "remove":
					return "VoidExpression"
			}
		}
		
		return node.ref?.$type ?? 'unknown';
	}
	
	public static CheckType(node?: Expression | PortReference, illegalPortType?: PortType): ExpressionValueType | "unknown" | Error {

		if(node === undefined) {
			return <Error>{
				error: `Expression is undefined.`,
				node: node as any,
				property: 'left'
			}
		}
		
		if(isPortReference(node)) {
			
			if(illegalPortType && node.property?.ref?.type === illegalPortType) {
				return <Error>{
					error: `Port type '${node.property.ref?.type}' is not allowed here.`,
					node: node,
					property: 'property',
					which: 'left'
				}
			}

			if(node?.selector === "any"){
				return "BooleanExpression";
			}
			
			switch (node.property?.ref?.valueType){
				case "bool":
					return  'BooleanExpression';
				case "int":
					return  'IntegerExpression';

				case "string":
					return  'StringExpression';
			}
			
			if(isOBJECT(node.property?.ref?.valueType)){

				const ref = node.objectProperty?.ref;

				if(ref === undefined){
					return <Error>{
						error: `Object property is undefined.`,
						node: node,
						property: 'objectProperty',
						which: 'left'
					}
				}

				return this.inferType(ref);
			}
		}

		if (isVariableReference(node)){
			// get last element of the path
			return this.inferType(node)
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

		if(text === 'CurrentTime'){
			return 'IntegerExpression';
		}
		if(text === 'Infinity'){
			return 'IntegerExpression';
		}

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

	public static  checkBinary(node: BinaryExpression, illegalPortType?: PortType): Error | ExpressionValueType | "unknown" {

		let leftType = this.CheckType(node.left, illegalPortType);

		if (ReelExpressionChecker.isError(leftType)) {
			return {...leftType, which: 'left'};
		}

		if(node.operator === "?"){
			if(leftType !== 'BooleanExpression'){
				return <Error>{
					error: `Type '${leftType}' is not compatible to type 'BooleanExpression' for operator '?'.`,
					node: node,
					property: 'left',
					which: 'left'
				}
			}
			return this.CheckType(node.right, illegalPortType);
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
				error: `Type '${leftType}' is not compatible to type '${rightType}' 22.`,
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

	public static  isComparisonOperator(operator: "!=" | "*" | "+" | "-" | "/" | "<" | "<=" | "=" | "==" | ">" | ">=" | "and" | "or" | "?" | ":"): boolean {
		return operator === "!=" || operator === "==" || operator === "<" || operator === "<=" || operator === ">" || operator === ">=";
	}


	public static isBinaryOrBoolean(expr: Expression) {
		return isBinaryExpression(expr) || (isVariableReference(expr) && expr.property[expr.property.length - 1].ref?.$type === 'BooleanExpression');
	}

	static GetUsedPorts(expression: Expression | undefined): Array<PortReference> | undefined {
		if (expression === undefined) {
			return undefined;
		}

		if (isPortReference(expression)) {
			return [expression];
		}

		if (isBinaryExpression(expression)) {
			const leftPorts = this.GetUsedPorts(expression.left);
			const rightPorts = this.GetUsedPorts(expression.right);
			return [...(leftPorts ?? []), ...(rightPorts ?? [])];
		}

		if (isVariableReference(expression)) {
			return [];
		}

		return undefined;
	}

	static AllowedPortTypes(expression: Expression, ports: Array<PortReference> | undefined, accept: ValidationAcceptor) {
		if( ports === undefined || ports.length === 0) {
			return;
		}
		
		if(isPortReference(expression)) {
			if (!ports.some(port => port.property?.ref?.name === expression.property?.ref?.name)) {
				accept('error', `Port '${expression.property?.ref?.name}' is not allowed here. Port must be asserted in condition.`, {
					node: expression,
					property: 'property'
				});
			}
			return;
		}
		if (isBinaryExpression(expression)) {
			this.AllowedPortTypes(expression.left, ports, accept);
			this.AllowedPortTypes(expression.right, ports, accept);
			return;
		}
	}

	static GetVariables(expr: Expression): Array<string> {
		const result: Array<string> = [];
		
		if(isBinaryExpression(expr)){
			result.push(...this.GetVariables(expr.left));
			result.push(...this.GetVariables(expr.right));
		}
		if(isVariableReference(expr)){
			let joinedVarName = expr.property.map(p => p.ref?.name ?? '').join('.');
			result.push(joinedVarName)
		}
		
		if(isPortReference(expr)){
			result.push(expr.property?.ref?.name ?? '');
		}
		
		
		return result;
	}
}

export interface Error {
	error: string;
	node: Expression;
	property: string;
	which: 'left' | 'right';
}