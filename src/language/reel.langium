grammar Reel

entry Model:
    rootElements+=Element+
;

Element:
    AtomicModelWithState
;

AtomicModelWithState:
    rootState=State
    rootModel=AtomicModel
;

AtomicModel:
    'atomic' 'model' name=ID '{' 
         ('state' ':' stateType=[State]  definitionOverrides=StateDefinitionOverrides? )
    
    '}'
;

StateDefinitionOverrides:
    ('{'
        (properties+=PropertiesOverride)* 
    '}')
;

PropertiesOverride:
    VariableOverride
;

VariableOverride:
    (ref=[Variable] '=' value=INT';'
    |ref=[Variable] '=' value=BooleanValue';'
    |ref=[Variable] '=' value=STRING';'
    |ref=[Variable] '=' value=OBJECT_OVERRIDE
);

OBJECT_OVERRIDE:
    '{' 
        (properties+=PropertiesOverride)*
    '}'
;

State:
    'state' name=ID '{' 
        (properties+=Properties)*
    '}'
;

Properties:
    Variable
;

Variable:
    ( IntegerExpression 
    | BooleanExpression
    | StringExpression
    | ObjectExpression
)
;

BooleanExpression:
    'bool' name=ID '=' value=BooleanValue';'
;

IntegerExpression:
    'int' name=ID '=' value=INT';'
;

StringExpression:
    'string' name=ID '=' value=STRING';'
;

ObjectExpression:
    'object' name=ID '=' value=OBJECT
;

OBJECT:
    '{' 
        (properties+=Properties)*
    '}'
;
BooleanValue returns boolean:
    'true' | 'false' // Only accepts 'true' or 'false'
;


hidden terminal WS: /\s+/;
terminal ID: /[_a-zA-Z][\w_]*/;
terminal INT returns number: /[0-9]+/;
terminal STRING: /"(\\.|[^"\\])*"|'(\\.|[^'\\])*'/;

hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;
