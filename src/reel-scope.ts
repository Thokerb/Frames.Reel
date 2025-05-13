import {
	ReferenceInfo, DefaultScopeProvider, Scope, AstNode,
	Reference
} from 'langium';
import {
	isAtomicModel,
	isOBJECT_OVERRIDE,
	isVariableOverride,
	ObjectExpression,
	State
} from './language/generated/ast.js';
import {ReelInference} from './reel-infer.js';

export class ReelScopeProvider extends DefaultScopeProvider {
	override getScope(context: ReferenceInfo): Scope {
		// const container = context.container;

		// target element of member calls
		if (context.property === 'ref' && isVariableOverride(context.container)) {


			const memberCall = context.container;
			const previous = memberCall.ref;
			if (!previous) {
				return super.getScope(context);
			}
			// get the state type TODO
			if (isAtomicModel(memberCall.$container.$container)) {
				const stateType = memberCall.$container.$container.stateType;
				return this.scopeState(stateType);
			}
			if (isOBJECT_OVERRIDE(memberCall.$container)) {
				const {state, path} = ReelInference.getStateFromObjectOverride(memberCall.$container);

				if (state.$container.stateType.ref === undefined) {
					return super.getScope(context);
				}

				const element = ReelInference.getNestedObjectExpression(state.$container.stateType.ref, path);

				return this.scopeObjectOverride(element);

			}
		}
		return super.getScope(context);
	}

	private scopeObjectOverride(objectOverride: ObjectExpression): Scope {

		var allMembers: Array<AstNode> = [];

		// add all properties of the class
		if (objectOverride?.value.properties) {
			allMembers = allMembers.concat(objectOverride.value.properties.map((property) => <AstNode>{
				$type: property.$type,
				name: property.name,
				$container: objectOverride,
				$containerRef: objectOverride.value,
				$containerType: objectOverride.$type,
				$containerIndex: objectOverride.$containerIndex,
				$containerProperty: objectOverride.$containerProperty,
				$cstNode: property.$cstNode,
				$document: property.$document,
			}));
		}

		return this.createScopeForNodes(allMembers);
	}

	private scopeState(classItem: Reference<State>): Scope {

		var allMembers: Array<AstNode> = [];

		// add all properties of the class
		if (classItem?.ref?.properties) {
			allMembers = allMembers.concat(classItem.ref.properties.map((property) => <AstNode>{
				$type: property.$type,
				name: property.name,
				$container: classItem.ref,
				$containerRef: classItem,
				$containerType: classItem?.ref?.$type,
				$containerIndex: classItem?.ref?.$containerIndex,
				$containerProperty: classItem?.ref?.$containerProperty,
				$cstNode: property.$cstNode,
				$document: property.$document,
			}));
		}

		return this.createScopeForNodes(allMembers);
	}
}
