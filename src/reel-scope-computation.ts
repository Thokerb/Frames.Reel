import {AstNode, AstNodeDescription, DefaultScopeComputation, LangiumDocument} from "langium";
import {isAtomicShortModel, isCoupledModel, isState, Model} from "./language/generated/ast.js";

export class ReelScopeComputation extends DefaultScopeComputation {
    override async computeExports(document: LangiumDocument<AstNode>): Promise<AstNodeDescription[]> {
        const model = document.parseResult.value as Model;
        
        console.log(model.elements)
        
        // export models
        const models = model.elements
            .filter(p => (isAtomicShortModel(p) || isCoupledModel(p)) && p.published)
            .map(p => this.descriptions.createDescription(p, p.name));
        
        
        const modelStateNames = model.elements.filter(p => isAtomicShortModel(p) && p.published).map(p => 
        isAtomicShortModel(p)  ? p.stateType.$refText : undefined).filter((p): p is string => p !== undefined);
        
        // automatically export corresponding states (TODO: the explicit export of states is ignored ??)
        const states = model.elements.filter(p => isState(p)).filter(p => modelStateNames.includes(p.name))
            .map(p => 
                isState(p) ?
                this.descriptions.createDescription(p, p.name) : undefined).filter((p): p is AstNodeDescription => p !== undefined);
        

        return [...models, ...states];
        
    }
}