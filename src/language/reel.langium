grammar Reel

entry Model:
    rootElements+=Element+
;

Element:
    AtomicModel |
    AtomicShortModel |
    State
;


AtomicShortModel:
    'atomic2' 'model' name=ID '{'  
         ('state' ':' stateType=[State]  definitionOverrides=StateDefinitionOverrides? )
         ('section' 'Ports' '{' 
            (ports+=Port)*
        '}')?
        (stateConfiguration+=StateConfiguration)*
    '}'
;

StateConfiguration:
    'stateDefinition' stateRef=[StateName]':' '{'
        ('time-advance' ':' timeAdvance=Expression 'TimeUnits')
        ('transitions'':''{'
            (transitions+=ReceiveConditionWithOverride2)*
            '}'
            )
        ('output' ':' '{'
            (output += OutputMap)*
        '}')
    '}'
;
         

AtomicModel:
    'atomic' 'model' name=ID '{'  
         ('state' ':' stateType=[State]  definitionOverrides=StateDefinitionOverrides? )
         ('section' 'Ports' '{' 
            (ports+=Port)*
        '}')?
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


// (( portRef+=[Port:ID] (',' portRef+=[Port:ID])*)?)

ReceiveCondition:
    'receive' (( portRef+=[Port:ID] (',' portRef+=[Port:ID])*)) ('with' expression=Expression )?
;

ReceiveCondition2:
    '('name=ID')'(OptionalReceiveCondition)? ('with' expression=Expression )?
;


OptionalReceiveCondition:
    'receive' (( portRef+=PortComparison (',' portRef+=PortComparison)*))? ('with' expression=Expression )?
;

InternalTransitionCase:
    'condition''('(name=ID)?')' ':' condition=TimeAdvanceCondition '=>' overrides=StateDefinitionOverridesWithBecome
;


Port:
    valueType=('string'|'int'|'bool') type=PortType  name=ID ';'
;



OutputCase:
    condition=TimeAdvanceCondition '=>' '{'
        (output += OutputMap)*
    '}'
;

OutputMap:
    portRef=[Port:ID] ':' expression=Expression ';'
;

/**
 *     section timeAdvance {
        state.name "on" => 5 TU;
        state.name "off" => 12 TU;
        state.name "off" with (state.engine == "power") => 1 TU;
        state.name "on" with Blinked8Times => 3 TU;
        state.name "KABUMM" => state.count TU;
        state.name "KABUMM2" => state.count*state.power TU;
    }
 * 
 */

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

// name: ["on","off","KABUMM"]
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

PortComparison infers Expression:
    PortReference ({infer BinaryExpression.left=current} operator=('<' | '<=' | '>' | '>=' | '==' | '!=') right=Primary)*;



Primary infers Expression:
    '(' Expression ')' |
    STRING |
    BooleanValue |
    INT |
    'Infinity' |
    VariableReference
;

PortReference:
    property=[Port:ID]
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
