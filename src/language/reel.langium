grammar Reel

entry Model:
    fileImports+=FileImport*   //NEW: imports per file
    elements+=Element*
;

Element:
    // AtomicModel |
    AtomicShortModel |
    State |
    CoupledModel
;


CoupledModel:
    'coupled' 'model' name=ID '{'  
        (models+=ModelReference)*
        (couplings+=CouplingDefinition)*

    '}'
;

CouplingDefinition:
    'Connect' (sourceModel=[ModelReference:ID] '.' sourcePort=[Port:ID] 'to' targetModel=[ModelReference:ID] '.' targetPort=[Port:ID]) //NEW: source and target ports
;

ModelReference:
    (atomicModel=[AtomicShortModel:ID] name=ID 'with' stateType=[State]  definitionOverrides=StateDefinitionOverrides?)//NEW: reference to AtomicShortModel
    | coupledModel=[CoupledModel:ID] //NEW: reference to CoupledModel
;


FileImport: //NEW: imports of the same file are gathered in a list
    'import' 'model'  
        (modelImports+=ModelImports ('with' 'state' stateImports+=[State])? (',' modelImports+=ModelImports ('with' 'state' stateImports+=[State])?)* )?
        (('as' alias=ID)? 'from')? //NEW: optional alias
    'from' file=STRING
; 

ModelImports:
    model=[AtomicShortModel:ID]
;


AtomicShortModel:
    published?='export'? 'atomic2' 'model' name=ID '{'  
         ('state' ':' stateType=[State]  definitionOverrides=StateDefinitionOverrides? )
         (ports=PortConfiguration)?
        (stateConfiguration+=StateConfiguration)*
    '}'
;

PortConfiguration:
    'section' 'Ports' '{' 
            (ports+=Port)*
        '}'
;

StateConfiguration:
    'stateDefinition' stateRef=[StateName]':' '{'
        (timeAdvance=TimeAdvanceStateConfiguration)
        ('transitions'':''{'
            (transitions+=ReceiveConditionWithOverride2)*
            '}'
            )
        ('output' ':' '{'
            (output += OutputMap)*
        '}')
    '}'
;
 
TimeAdvanceStateConfiguration:
    'time-advance' ':' timeAdvance=Expression 'TimeUnits'
;

AtomicModel:
    'atomic' 'model' name=ID '{'  
         ('state' ':' stateType=[State]  definitionOverrides=StateDefinitionOverrides? )
         (ports=PortConfiguration)?
        ('section' 'TimeAdvance' '{' 
            (timeAdvanceCases+=TimeAdvanceCase)*
        '}')?
        ('section' 'internalTransition' '{'
            (internalTransitionCases+=InternalTransitionCase)*
        '}')
        ('section' 'externalTransition' '{'
            (receiveCase+=ReceiveCase)*
        '}')?
        ('section' 'Output' '{'
            (outputCases+=OutputCase)*
        '}')
    '}'
;


PortType returns string:
    'InPort' | 'OutPort'
;


ReceiveCase:
    'state''.''name' 'is' stateRef=[StateName]'{'
        (receive += ReceiveConditionWithOverride)*
    '}'
;

ReceiveConditionWithOverride:
    (condition=ReceiveCondition '=>' overrides=StateDefinitionOverridesWithBecome )
;


ReceiveConditionWithOverride2:
    (condition=ReceiveCondition2 '=>' overrides=StateDefinitionOverridesWithBecome )
;

ReceiveCondition:
    'receive' (( portRef+=[Port:ID] (',' portRef+=[Port:ID])*)) ('with' expression=Expression )?
;

ReceiveCondition2:
    '('name=ID')' ('with' expression=Expression )?
;


InternalTransitionCase:
    'condition''('(name=ID)?')' ':' condition=TimeAdvanceCondition '=>' overrides=StateDefinitionOverridesWithBecome
;


Port:
    valueType=('string'|'int'|'bool'|OBJECT) type=PortType  name=ID ';'
;



OutputCase:
    condition=TimeAdvanceCondition '=>' '{'
        (output += OutputMap)*
    '}'
;

OutputMap:
    portRef=[Port:ID] ':' expression=Expression ';'
;

TimeAdvanceCase:
    (
        (condition=TimeAdvanceCondition '=>' timeAdvance=Expression 'TimeUnits') |
        ('default' '=>' defaultTimeAdvance=Expression 'TimeUnits')
    )
    ';'
;




TimeAdvanceCondition:
    'state''.''name' 'is' stateRef=[StateName] ('with' expression=Expression )?
;




StateDefinitionOverrides:
    ('{'
        'initial' '=' initialState=[StateName] ';'
        (properties+=PropertiesOverride)* 
    '}')
;



StateDefinitionOverridesWithBecome:
    ('{'
        ('state''.''name' 'becomes' stateRef=[StateName] ';')
        (properties+=Assignment ';')* 
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
        // name: ["on","off","KABUMM"]
        (stateType=StateTypes)?
        (properties+=Properties)*
    '}'
;

StateTypes:
    'states' ':' '['
        (( StateName+=StateName ('|' StateName+=StateName)*)?)
    ']'';'
    'initial' '=' initialState=[StateName] ';'// TODO: use STRING or ID
;

StateName:
    name=ID // TODO: use STRING or ID
;

Properties:
    Variable
;

Variable:
    ( IntegerExpression 
    | BooleanExpression
    | StringExpression
    | ObjectExpression
);



BooleanExpression:
    'bool' name=ID ('=' value=BooleanValue)?';'
;


IntegerExpression:
    'int' name=ID ('=' value=INT)?';'
;

StringExpression:
    'string' name=ID ('=' value=STRING)?';'
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


// expressions
Expression:
    Assignment;

Assignment infers Expression:
    Addition ({infer BinaryExpression.left=current} operator=('=') right=Addition)*;

Addition infers Expression:
    Multiplication ({infer BinaryExpression.left=current} operator=('+' | '-') right=Multiplication)*;

Multiplication infers Expression:
    Logical ({infer BinaryExpression.left=current} operator=('*' | '/') right=Logical)*;

Logical infers Expression:
    Comparison ({infer BinaryExpression.left=current} operator=('and' | 'or') right=Comparison)*;

Comparison infers Expression:
    Primary ({infer BinaryExpression.left=current} operator=('<' | '<=' | '>' | '>=' | '==' | '!=') right=Primary)*;


Primary infers Expression:
    '(' Expression ')' |
    STRING |
    BooleanValue |
    INT |
    'Infinity' |
    VariableReference |
    PortReference
;

PortReference:
    (portType=PortType property=[Port:ID] ('.'selector=('first'|'any'|INT))? )
;



VariableReference:
    property+=[Variable] ('.' property+=[Variable])*
;


hidden terminal WS: /\s+/;
terminal ID: /[_a-zA-Z][\w_]*/;
terminal INT returns number: /[0-9]+/;
terminal STRING: /"(\\.|[^"\\])*"|'(\\.|[^'\\])*'/;

hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;
