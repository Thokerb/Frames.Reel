grammar Reel

entry Model:
    rootElements+=Element+
;

Element:
    AtomicModelWithState
;

AtomicModelWithState:
    rootState=State?
    rootModel=AtomicModel?
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

        '}'
;

//         string input InPort1;
//         string output OutPort1;
Port:
    valueType=('string'|'int'|'bool') type=PortType  name=ID ';'
;

PortType returns string:
    'InPort' | 'OutPort'
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



ConditionExpression:
    ('!'?)'(' 
    ( condition+=ConditionExpression 'and' condition+=ConditionExpression
    | condition+=ConditionExpression 'or' condition+=ConditionExpression
    | condition+=ConditionExpression ')'
    | booleanValue=BooleanValue
    | (variable=[Variable] operator=(BooleanComparisonOperator) value=BooleanValue)
    | (variable=[Variable] operator=(IntegerComparisonOperator) value=INT)
    | (variable=[Variable] operator=(StringComparisonOperator) value=STRING) 
    | (variable=[Variable] operator=(ObjectComparisonOperator) value=OBJECT) // TODO: change
    )
    ')'
;

IntegerComparisonOperator returns string:
    BooleanComparisonOperator | '==' | '!=' | '<' | '<=' | '>' | '>='
;

StringComparisonOperator returns string:
    'is' | 'begins' | 'ends' | 'contains'
;

ObjectComparisonOperator returns string:
    'is' | 'has'
;

BooleanComparisonOperator returns string:
    'is' | 'isNot'
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



Primary infers Expression:
    '(' Expression ')' |
    STRING |
    BooleanValue |
    INT |
    'Infinity' |
    VariableReference
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
