var directionaggregates = {
	'horizontal' : ['left', 'right'],
	'vertical' : ['up', 'down'],
	'moving' : ['up', 'down', 'left', 'right', 'action'],
	'orthogonal' : ['up', 'down', 'left', 'right'],
	'perpendicular' : ['^','v'],
	'parallel' : ['<','>']
};

var relativeDirections = ['^', 'v', '<', '>','horizontal','vertical'];
var simpleAbsoluteDirections = ['up', 'down', 'left', 'right'];
var simpleRelativeDirections = ['^', 'v', '<', '>'];
var reg_directions_only = /^(\>|\<|\^|v|up|down|left|right|moving|stationary|no|randomdir|random|horizontal|vertical|orthogonal|perpendicular|parallel|action)$/;

function* objectConstraint_iterator(rule)
{
	for (const side of [rule.lhs, rule.rhs])
		for (const cell_row of side)
			for (const cell of cell_row)
				for (const object_constraint of cell)
					if (object_constraint !== null)
						yield object_constraint
}

function directionalRule(identifiers, rule)
{
	if ( rule.lhs.some( cellrow => (cellrow.length > 1) ) || rule.rhs.some( cellrow => (cellrow.length > 1) ) )
		return true
	for (const oc of objectConstraint_iterator(rule))
	{
		if (oc === null)
			continue
		// TODO: should'nt it also include 'perpendicular' and 'parallel' but exclude 'horizontal' and 'vertical'?
		if ( relativeDirections.includes(oc.dir) || identifiers.has_directional_tag_mapping(oc.ii) )
			return true
	}
	return false
}

function findIndexAfterToken(str, tokens, tokenIndex)
{
	str = str.toLowerCase();
	var curIndex = 0;
	for (var i=0; i<=tokenIndex; i++)
	{
		const token = tokens[i];
		curIndex = str.indexOf(token, curIndex) + token.length;
	}
	return curIndex;
}


//read initial directions
// syntax is ("+")? (!"+"|"direction"|"late"|"rigid"|"random")+  ("["), where 'direction' is itself (directionaggregate|simpleAbsoluteDirection|!simpleRelativeDirection)
// (I use the ! here to denote something that is recognized by the parser but wrong)
function parseRuleDirections(state, tokens, lineNumber)
{
	var directions = [];
	var tag_classes = new Set();
	var properties = new Set();
	var late = false;
	var rigid = false;
	var randomRule = false;
	var has_plus = false;

	for (var i = 0; i < tokens.length; i++)
	{
		const token = tokens[i];
		if (token === '+')
		{
			if (i !== 0)
			{
				if (has_plus) {
					logError('Two "+"s ("append to previous rule group" symbol) applied to the same rule.', lineNumber);
				} else {
					logError('The "+" symbol, for joining a rule with the group of the previous rule, must be the first symbol on the line ');
				}
			}
			has_plus = true;
		}
		else if (token in directionaggregates) {
			directions.push(...directionaggregates[token]);
		} else if (token === 'late') {
			late = true;
		} else if (token === 'rigid') {
			rigid = true;
		} else if (token === 'random') {
			if (has_plus)
			{
				logError(['random_on_nonfirst_group_rule'], lineNumber)
			}
			randomRule = true;
		} else if (simpleAbsoluteDirections.indexOf(token) >= 0) {
			directions.push(token);
		} else if (simpleRelativeDirections.indexOf(token) >= 0) {
			logError('You cannot use relative directions (\"^v<>\") to indicate in which direction(s) a rule applies.  Use absolute directions indicators (Up, Down, Left, Right, Horizontal, or Vertical, for instance), or, if you want the rule to apply in all four directions, do not specify directions', lineNumber);
		}
		else if (token === '[')
		{
			if (directions.length == 0) {
				directions.push(...directionaggregates['orthogonal']); // it's not actually about orthogonality, it's just that this word contains the four directions and only that
			}
			return [ directions, tag_classes, properties, late, rigid, randomRule, has_plus, i ];
		}
		else if (state.identifiers.checkIdentifierIsKnownWithType(token, [identifier_type_tagset, identifier_type_property], false, state) >= 0) // we do that last because '+' and ']' may be used as identifiers (synonyms)
		{
			const identifier_index = state.identifiers.names.indexOf(token);
			const identifier_type =  state.identifiers.comptype[identifier_index];
			switch (identifier_type)
			{
				case identifier_type_tagset:
					if (tag_classes.has(identifier_index))
					{
						logWarning('Dupplicate specification of tag class '+token.toUpperCase()+' as rule parameter.', lineNumber);
						break;
					}
					tag_classes.add(identifier_index);
					break;
				case identifier_type_property:
					if (properties.has(identifier_index))
					{
						logWarning('Dupplicate specification of property '+token.toUpperCase()+' as rule parameter.', lineNumber);
						break;
					}
					properties.add(identifier_index);
					break;
				default:
					logError('Cannot use '+token.toUpperCase()+' as a rule parameter: it is defined as '+identifier_type_as_text(identifier_type)+', but only tag classes and object properties can be used as rule parameters.', lineNumber);
			}
		}
		else
		{
			logError("The start of a rule must consist of some number of directions (possibly 0), before the first bracket, specifying in what directions to look (with no direction specified, it applies in all four directions).  It seems you've just entered \"" + token.toUpperCase() + '\".', lineNumber);
		}
	}

	// We would get there by reading the whole line without encountering a [, but we probably don't need to deal with it
	return [ directions, tag_classes, properties, late, rigid, randomRule, has_plus, tokens.length ];

}


// TODO: it should be in parser.js?
function parseRuleString(rule, state, curRules) 
{
/*
	intermediate structure
		dirs: Directions[]
		pre : CellMask[]
		post : CellMask[]

		//pre/post pairs must have same lengths
	final rule structure
		dir: Direction
		pre : CellMask[]
		post : CellMask[]
*/
	var [line, lineNumber, origLine] = rule;
	state.lineNumber = lineNumber // TODO: inelegant. Just to report errors.

//	STEP ONE, TOKENIZE
	line = line.replace(/\[/g, ' [ ').replace(/\]/g, ' ] ').replace(/\|/g, ' | ').replace(/\-\>/g, ' -> ');
	line = line.trim();
	if (line[0] === '+')
	{
		line = line.substring(0,1) + " " + line.substring(1,line.length);
	}
	var tokens = line.split(/\s/).filter(function(v) {return v !== ''});

	if (tokens.length == 0)
	{
		logError('Spooky error!  Empty line passed to rule function.', lineNumber);
	}


// STEP TWO, READ DIRECTIONS

	if (tokens.length === 1)
	{
		const bracket = ({startloop: 1, endloop: -1})[tokens[0]];
		if ( bracket !== undefined )
		{
			return {
				bracket: bracket
			}
		}
	}

	if (tokens.indexOf('->') == -1)
	{
		logError(['rule_without_arrow'], lineNumber)
	}

	const [ directions, tag_classes, properties, late, rigid, randomRule, has_plus, nb_tokens_in_rule_directions ] = parseRuleDirections(state, tokens, lineNumber);

	var groupNumber = lineNumber;
	if (has_plus)
	{
		if (curRules.length == 0)
		{
			logError('The "+" symbol, for joining a rule with the group of the previous rule, needs a previous rule to be applied to.');							
		}
		groupNumber = curRules[curRules.length-1].groupNumber; // TODO: curRules is only provided to this function for that, it would be beter to provide directly the last groupNumber.
	}

	var curcellrow = []; // [  [up, cat]  [ down, mouse ] ] -> a cell row is everything betwen [ and ], it is an array of cells
	var curcell = [] // [up, cat, down mouse] -> a cell is everything between [or| and |or], it is '...' or an array of object conditions.
	var curobjcond = { dir: null, ii: null, no: false, random: false } // -> an object condition is a sequence "direction? identifier", it is a pair [ direction or null, identifier_index ]
	var should_close_cellrow = false;
	var should_close_cell = false;
	var should_close_objcond = false;
	var cell_contains_ellipses = false;
	var should_add_ellipses = false;

	var incellrow = false;

	var rhs = false;
	var lhs_cells = [];
	var rhs_cells = [];
	var commands = new CommandsSet()

	var bracketbalance = 0;
	for (var i = nb_tokens_in_rule_directions; i < tokens.length; i++)
	{
		const token = tokens[i];

		// reading cell contents LHS
		// the syntax for the rule is: rule_directions (cellrow)+ "->" (cellrow)* commands
		// where cellrow is: "[" (cell "|")* cell "]"
		// and cell is: ( (single_direction_or_action)? identifier )* | "...", but the "..." cannot appear as a first or last cell in a cellrow
		// and commands is: ( commandword | ("message" everything_to_the_end_of_line) )*
		// but if any token that is allowed elsewhere in the rule is seen where it should not be, this is reported (with different messages depending on where it it seen)
		if (token == '[')
		{
			bracketbalance++;
			if (bracketbalance > 1) {
				logWarning(['rule_open_open_brackets'], lineNumber)
			}
			if (curcell.length > 0) { // TODO: isn't that dupplicating what the bracketbalance test does?
				logError('Error, malformed cell rule - encountered a "["" before previous bracket was closed', lineNumber);
			}
			incellrow = true;
			curcell = [];
		} else if (reg_directions_only.exec(token)) {
			if (!incellrow) {
				logWarning(['directions_outside_cellrows'], lineNumber);
			} else if (curobjcond.no || curobjcond.random) {
				// TODO: it would be nice to allow "no up crate" to match cells that have either no crate or a crate that does not move up. But it requires changes in the engine.
				logError(['no_or_random_followed_by_direction', tokens[i-1]], lineNumber)
			} else if (token === 'random') {
				if ( ! rhs )
				{
					logError(['random_in_LHS', token], rule.lineNumber)
				}
				curobjcond.random = true
			} else if (token === 'no') {
				if (curobjcond.dir !== null)
				{
					logError(['direction_NO_object'], lineNumber)
				}
				curobjcond.no = true
			} else if (late) {
				logWarning(['movements_in_laterule'], lineNumber)
			} else if (curobjcond.dir !== null) {
				// TODO: fix bug https://github.com/increpare/PuzzleScript/issues/395
				//       Basically, we need to replace directions words with 'direction' flags (including 'no' and 'random' that are not directions) and check
				//       there is no more than one direction? (relative directions should not yet be resolved, however)
				//       the idea behind the error message is that the direction words would be and-ed, which is certainly coherent with the idea that they define
				//       additional constraints on the matching but is also incompatible with the use of some words like 'parallel' that present an alternative (< or >).
				//       And we clearly want the ability to have alternatives, but it's just a shortcut to avoid making multiple rules instead.
				logError("Error, an item can only have one direction/action at a time, but you're looking for several at once!", lineNumber);
			} else if ( ! rhs && token === 'randomdir' ) {
				logError(['random_in_LHS', token], lineNumber)
			} else {
				curobjcond.dir = token
			}
		} else if (token == '|') {
			if (!incellrow) {
				logWarning('Janky syntax.  "|" should only be used inside cell rows (the square brackety bits).', lineNumber);
			} else {
				should_close_cell = true;
			}
		} else if (token === ']') {
			bracketbalance--;
			if (bracketbalance < 0) {
				logWarning(['rule_close_close_brackets'], lineNumber)
			}
			should_close_cellrow = true; // TODO: should it be "should_close_cellrow = (bracketbalance == 0)"?
		} else if (token === '->') {
			if (incellrow) {
				logError(['rule_arrow_in_cell'], lineNumber)
			} else if (rhs) {
				logError('Error, you can only use "->" once in a rule; it\'s used to separate before and after states.', lineNumber);
			} else {
				rhs = true;
			}
		} else if (state.identifiers.checkKnownIdentifier(token, true, state) >= 0) { // TODO: we need to check if it can be an object identifier without triggering errors
			                                                                 // especially, it should reject command keywords without loging an error...
			if (!incellrow) {
				logWarning("Invalid token "+token.toUpperCase() +". Object names should only be used within cells (square brackets).", lineNumber);
			}
			curobjcond.ii = state.identifiers.checkKnownIdentifier(token, true, state) // TODO: we should not search it twice...
			should_close_objcond = true;
		} else if (token === '...') {
			if (!incellrow) {
				logWarning("Invalid syntax, ellipses should only be used within cells (square brackets).", lineNumber);
			}
			else if (curcellrow.length == 0)
			{
				logError('You cannot start a cell row (the square brackety things) with ellipses.', lineNumber);
			}
			else
			{
				should_add_ellipses = true;
			}
		} else if (CommandsSet.prototype.is_command(token)) {
			if (rhs === false) {
				logError("Commands cannot appear on the left-hand side of the arrow.", lineNumber);
			}
			if (incellrow)
			{
				logError(['commands_in_cellrow'], lineNumber)
			}
			if (token === 'message')
			{
				var messageIndex = findIndexAfterToken(origLine, tokens, i);
				var messageStr = origLine.substring(messageIndex).trim();
				if (messageStr === '')
				{
					messageStr = ' ';
					//needs to be nonempty or the system gets confused and thinks it's a whole level message rather than an interstitial.
				}
				commands.setMessage(messageStr)
				i=tokens.length;
			} else {
				commands.addCommand(token)
			}
		} else {
			logError('Error, malformed cell rule - was looking for cell contents, but found "' + token + '".  What am I supposed to do with this, eh, please tell me that.', lineNumber);
		}

		if (should_close_objcond || should_add_ellipses || should_close_cell || should_close_cellrow)
		{
			// close the current object condition / ellipsis
			if (curobjcond.ii === null)
			{
				if ( (curobjcond.dir) !== null || curobjcond.no || curobjcond.random )
				{
					// TODO: this error message should not be triggered when something was provided but was not a valid object name.
					// TODO: the error message is a little bit misleading as it would also be trigered by 'no' or 'random' not being followed by an identifier.
					logError('In a rule, if you specify a force, it has to act on an object.', lineNumber)
				}
			}
			else
			{
				if (curobjcond.dir === null)
					curobjcond.dir = ''
				curcell.push(curobjcond)
			}
			curobjcond = { dir: null, ii: null, no: false, random: false }
			should_close_objcond = false;
		}

		if (should_add_ellipses)
		{
			curcell.push(null)
			cell_contains_ellipses = true;
			should_add_ellipses = false;
		}

		if (should_close_cell || should_close_cellrow)
		{
			// close the current cell
			if ( cell_contains_ellipses && (curcell.length > 1) )
			{
				logError(['ellipses_not_alone'], lineNumber)
			}
			curcellrow.push(curcell);
			curcell = [];
			should_close_cell = false;
			cell_contains_ellipses = false;
		}

		if (should_close_cellrow)
		{
			if ( (curcellrow.length == 0) && (!rhs) )
			{
				logError("You have an totally empty pattern on the left-hand side.  This will match *everything*.  You certainly don't want this.");
			}
			if ( (curcellrow.length > 0) && (curcellrow[curcellrow.length - 1] === null)) {
				logError('You cannot end a bracket with ellipses.', lineNumber);
			}
			else 
			{
				(rhs ? rhs_cells : lhs_cells).push(curcellrow);
				curcellrow = [];
			}
			incellrow = false;
			should_close_cellrow = false;
		}
	}

	// Check the coherence between LHS and RHS
	if (lhs_cells.length != rhs_cells.length) {
		if ( (commands.nb_commands === 0) || (rhs_cells.length > 0) )
		{
			logError(['different_nb_cellrows'], lineNumber)
		}
	} else {
		for (const [i, lhs_cell] of lhs_cells.entries())
		{
			if (lhs_cell.length != rhs_cells[i].length)
			{
				logError(['different_nb_cells'], lineNumber)
				return null // ignoring the rule because it would cause bugs later in the code.
			}
		}
	}

	var rule_line = {
		lineNumber: lineNumber,
		groupNumber: groupNumber,
		directions: directions,
		tag_classes: tag_classes,
		parameter_properties: properties,
		late: late,
		rigid: rigid,
		randomRule: randomRule,
		lhs: lhs_cells,
		rhs: rhs_cells,
		commands: commands
	};

	rule_line.is_directional = directionalRule(state.identifiers, rule_line)
	if (rule_line.is_directional === false)
	{
		rule_line.directions = ['up'];
	}

	//next up - replace relative directions with absolute direction
	return rule_line;
}
