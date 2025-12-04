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
    published?='export'? 'coupled' 'model' name=ID '{'  
        (ports=PortConfiguration)?
        (models+=ModelReference)*
        (couplings+=CouplingDefinition)*

    '}'
;

CouplingDefinition:
    'Connect' ( (thisSourceModel?='this'|sourceModel=[ModelReference:ID]) '.' sourcePort=[Port:ID] 'to' (targetModel=[ModelReference:ID] | thisTargetModel?='this') '.' targetPort=[Port:ID]) //NEW: source and target ports
;

ModelReference:
    (atomicModel=[AtomicShortModel:ID] name=ID 'with' stateType=[State]  definitionOverrides=StateDefinitionOverrides?)//NEW: reference to AtomicShortModel
    |( coupledModel=[CoupledModel:ID] name=ID)//NEW: reference to CoupledModel
;


FileImport: //NEW: imports of the same file are gathered in a list
    'import'  
        modelImport=ModelImports
    'from' file=STRING
; 

ModelImports:
    ('atomic' atomicModel=[AtomicShortModel:ID]) |('coupled' coupledModel=[CoupledModel:ID]) //NEW: reference to AtomicShortModel or CoupledModel
;


AtomicShortModel:
    published?='export'? 'atomic' 'model' name=ID '{'  
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
            (transitions+=ReceiveConditionWithOverride)*
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


PortType returns string:
    'InPort' | 'OutPort'
;


ReceiveConditionWithOverride:
    (condition=ReceiveCondition '=>' overrides=StateDefinitionOverridesWithBecome )
;

ReceiveCondition:
    '('name=ID')' ('with' expression=Expression )?
;

Port:
    valueType=('string'|'int'|'bool'|OBJECT) type=PortType  name=ID ';'
;

OutputMap:
    portRef=[Port:ID] '=' (expression=Expression| expressionMap=ExpressionMap) ';'
;

ExpressionMap:
    '{' (mapEntries+=MapEntry (',' mapEntries+=MapEntry)*)? '}'
;
MapEntry:
    key=[VariableType:ID] ':' value=Expression
;

// this is because it is a lot easier to provide custom variable scope
VariableType:
    Variable | VariableReference
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
        (properties+=Expression ';')* 
    '}')
;


PropertiesOverride:
    VariableOverride
;

VariableOverride:
    (ref=[Variable] '=' value=(INT|'Infinity')';'
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
    | ArrayExpression
    | ObjectExpression
);



BooleanExpression:
    'bool' name=ID ('=' value=BooleanValue)?';'
;


IntegerExpression:
    'int' name=ID ('=' value=(INT|'Infinity'))?';'
;

StringExpression:
    'string' name=ID ('=' value=STRING)?';'
;

ObjectExpression:
    'object' name=ID '=' value=OBJECT
;


ArrayExpression: 
  'array'
   ((type='string' name=ID '=' '[' (stringElements+=(STRING) (',' stringElements+=(STRING))*)? ']')  |
   (type='int' name=ID '=' '[' (IntElements+=(INT) (',' IntElements+=(INT))*)? ']') |
   (type='bool' name=ID '=' '[' (BoolElements+=(BooleanValue) (',' BoolElements+=(BooleanValue))*)? ']'))
  ';'
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
Expression:    Assignment | Primary;

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
    'CurrentTime' |
    'Infinity' |
    VariableReference |
    PortReference
;

PortReference:
    (portType=PortType property=[Port:ID] ('.'selector=('first'|'any'|'all'|INT)) ('.'objectProperty=[VariableType:ID])? )
;



VariableReference:
    property+=[Variable] ('.' property+=[Variable])* 
    propertyArrayAccess=PropertyArrayAccess?
;

PropertyArrayAccess:
    
    ("." type='get' '(' index=Expression ')' ) |
    ("." type='remove' '(' index=Expression ')') |
    ("." type='length' '(' ')') |
    ("." type='append' '(' value=Expression ')') |
    ("." type='push' '(' value=Expression ')')
;



hidden terminal WS: /\s+/;
terminal ID: /[_a-zA-Z][\w_]*/;
terminal INT returns number: /[0-9]+/;
terminal STRING: /"(\\.|[^"\\])*"|'(\\.|[^'\\])*'/;

hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;
