import type {Reference, ValidationAcceptor, ValidationChecks} from 'langium';
import {
	ConditionExpression, isBooleanComparisonOperator, isIntegerComparisonOperator, isObjectComparisonOperator, OBJECT,
	OBJECT_OVERRIDE, ObjectExpression,
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
		ConditionExpression: validator.checkComparisonOperator,
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

	checkComparisonOperator(def: ConditionExpression, accept: ValidationAcceptor): void {
		if(def.variable?.ref !== undefined) {
			const left = this.inferType(def.variable);
			const comparisonOperator = def.operator
			let isNoError = true;
			
			switch (left){
				case "BooleanExpression":
					isNoError = isBooleanComparisonOperator(comparisonOperator);
					break;
				case "ObjectExpression":
					isNoError = isObjectComparisonOperator(comparisonOperator);
					break;
				case "IntegerExpression":
					isNoError = isIntegerComparisonOperator(comparisonOperator);
					break;
				case "StringExpression":
					isNoError = isIntegerComparisonOperator(comparisonOperator);
					break;
				case "unknown":
					isNoError = true;
					break;
			}
			if (!isNoError) {
				accept('error', `Type '${comparisonOperator}' is not assignable to type '${left}'.`, {
					node: def,
					property: 'operator'
				});
			}

			if(def.value !== undefined) {
				const right = this.inferRightType(def.value);
				if (right !== left) {
					accept('error', `Type '${right}' is not assignable to type '${left}'.`, {
						node: def,
						property: 'value'
					});
					return;
				}

			}
			
		}
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

}
