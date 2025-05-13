import type { Reference, ValidationAcceptor, ValidationChecks } from 'langium';
import { type ReelAstType, type Variable, type VariableOverride } from './generated/ast.js';
import type { ReelServices } from './reel-module.js';

/**
 * Register custom validation checks.
 */
export function registerValidationChecks(services: ReelServices) {
    const registry = services.validation.ValidationRegistry;
    const validator = services.validation.ReelValidator;
    const checks: ValidationChecks<ReelAstType> = {
        // AtomicModel: validator.checkPersonStartsWithCapital
        VariableOverride: validator.checkVariableDeclaration
    };
    registry.register(checks, validator);
}

/**
 * Implementation of custom validations.
 */
export class ReelValidator {
    
        checkVariableDeclaration(decl: VariableOverride, accept: ValidationAcceptor): void {
            if (decl.ref !== undefined && decl.value !== undefined) {
            const left = this.inferType(decl.ref);
            const right = this.inferRightType(decl.value);

            
            if(right === 'unknown' || left === 'unknown') { 
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

    inferRightType(node: string | number | boolean): string {
        if (typeof node === 'string') {
            return 'StringExpression';
        } else if (typeof node === 'number') {
            return 'IntegerExpression';
        } else if (typeof node === 'boolean') {
            return 'BooleanExpression';
        }
        return 'unknown';

    }

    inferType(node: Reference<Variable>): string {
        return node.ref?.$type ?? 'unknown';
    }

}
