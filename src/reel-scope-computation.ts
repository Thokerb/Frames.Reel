import {AstNode, AstNodeDescription, DefaultScopeComputation, LangiumDocument} from "langium";
import {isAtomicShortModel, Model} from "./language/generated/ast.js";

export class ReelScopeComputation extends DefaultScopeComputation {
    override async computeExports(document: LangiumDocument<AstNode>): Promise<AstNodeDescription[]> {
        const model = document.parseResult.value as Model;
        
        // export models
        const models = model.elements
            .filter(p => isAtomicShortModel(p) && p.published)
            .map(p => this.descriptions.createDescription(p, p.name));
        
        
        // automatically export corresponding states (TODO: the explicit export of states is ignored ??)
        const states = model.elements
            .filter(p => isAtomicShortModel(p) && p.stateType.ref)
            .map(p => 
                isAtomicShortModel(p) && p.stateType.ref ?
                this.descriptions.createDescription(p.stateType.ref, p.stateType.ref.name) : undefined).filter((p): p is AstNodeDescription => p !== undefined);
        
        return [...models, ...states];
        
    }
}