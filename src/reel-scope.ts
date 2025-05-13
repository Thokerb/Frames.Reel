import {
	ReferenceInfo, DefaultScopeProvider, Scope, AstNode,
	Reference
} from 'langium';
import {isVariableOverride, State} from './language/generated/ast.js';

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
			// get the state type
			const stateType = memberCall.$container.$container.stateType;
			return this.scopeClassMembers(stateType);

			// When the target of our member call isn't a class
			// This means it is either a primitive type or a type resolution error
			// Simply return an empty scope
			// return EMPTY_SCOPE;
		}
		return super.getScope(context);
	}

	private scopeClassMembers(classItem: Reference<State>): Scope {

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
