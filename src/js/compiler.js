'use strict';

/* TODO REFACTORING
- idDict is likely not needed, unless the fact it's sorted by layers is important.
   -> it is used in debug.js where it is not important because the identifiers are then sorted by name)
      That appart, it is only used in engine_base.js/getLayersOfMask where it is used to get the object matching a given bit in the mask returned by Level.getCell,
      which is the same use as in debug.js. Indeed, level cells are created in levelFromString here, using the order of bits defined in glyphDict.
      -> for now, changed to contain identifier_indexes rather than names.
- state.glyphDict -> also, why do we have that thing contain a different kind of mask than bitvec?
                     also, we want the bits in these masks to be in the order of objects in state.objects rather than in the order of idDict?
*/

function isColor(str)
{
	str = str.trim();
	if (str in colorPalettes.arnecolors)
		return true;
	if (/^#([0-9A-F]{3}){1,2}$/i.test(str))
		return true;
	if (str === "transparent")
		return true;
	return false;
}

function colorToHex(palette,str) {
	str = str.trim();
	if (str in palette) {
		return palette[str];
	}

	return str;
}


function generateSpriteMatrix(dat) {

	var result = [];
	for (var i = 0; i < dat.length; i++) {
		var row = [];
		for (var j = 0; j < dat.length; j++) {
			var ch = dat[i].charAt(j);
			if (ch == '.') {
				row.push(-1);
			} else {
				row.push(ch);
			}
		}
		result.push(row);
	}
	return result;
}

var debugMode;
var colorPalette;



function generateExtraMembers(state)
{

	if (state.collisionLayers.length === 0)
	{
		logError("No collision layers defined.  All objects need to be in collision layers.");
	}

	//annotate objects with layers
	//assign ids at the same time
	// TODO: This could be done directly in the parser -- ClementSparrow
	state.idDict = []; // TODO: this is a bad name...
	for (var [layerIndex, layer] of state.collisionLayers.entries())
	{
		for (const object_index of layer)
		{
			var o = state.objects[object_index];
			o.id = state.idDict.length;
			state.idDict.push(object_index);
		}
	}

	//set object count
	state.objectCount = state.idDict.length;

	//calculate blank mask template
	const layerCount = state.collisionLayers.length;
	var blankMask = Array(layerCount).fill(-1)

	// how many words do our bitvecs need to hold?
	STRIDE_OBJ = Math.ceil(state.objectCount/32)|0;
	STRIDE_MOV = Math.ceil(layerCount/5)|0;
	state.STRIDE_OBJ=STRIDE_OBJ;
	state.STRIDE_MOV=STRIDE_MOV;
	
	debugMode = ('debug' in state.metadata)
	verbose_logging = ('verbose_logging' in state.metadata)
	throttle_movement = ('throttle_movement' in state.metadata)
	if (debugMode||verbose_logging)
	{
		cache_console_messages = true;
	}

	// get colorpalette name
	// TODO: move that in the parser so that it can display the exact colors
	if ('color_palette' in state.metadata)
	{
		var val = state.metadata.color_palette
		if (val in colorPalettesAliases)
		{
			val = colorPalettesAliases[val];
		}
		if (colorPalettes[val] === undefined)
		{
			logError('Palette "'+val+'" not found, defaulting to arnecolors.',0);
		} else {
			colorPalette = colorPalettes[val];
		}
	}
	else
	{
		colorPalette = colorPalettes.arnecolors;
	}

	//convert colors to hex
	// TODO: since this can generate errors that could be highlighted, it should be done in the parser
	for (var o of state.objects)
	{
		if (o.colors.length>10) {
			logError("a sprite cannot have more than 10 colors.  Why you would want more than 10 is beyond me.", state.identifiers_lineNumbers[o.identifier_index]+1); // TODO: Seriously??? Just remind that the bitmap definition uses digits for colors, which limits them to ten -- ClementSparrow
		}
		for (var i=0; i<o.colors.length; i++)
		{
			var c = o.colors[i];
			if (isColor(c))
			{
				c = colorToHex(colorPalette,c);
				o.colors[i] = c;
			} else {
				logError('Invalid color specified for object "' + o.name + '", namely "' + c + '".', state.identifiers_lineNumbers[o.identifier_index] + 1);
				o.colors[i] = '#ff00ff'; // magenta error color
			}
		}
	}

	//generate sprite matrix
	// TODO: since this can generate errors that could be highlighted, it should be done in the parser
	for (var o of state.objects)
	{
		if (o.colors.length == 0)
		{
			// TODO: We may want to silently use transparency in that case, considering how frequent it is to use transparent markers in PuzzleScript...
			logError('color not specified for object "' + o.name +'".', state.identifiers_lineNumbers[o.identifier_index]);
			o.colors=["#ff00ff"];
		}
		if (o.spritematrix.length === 0)
		{
			o.spritematrix = [[0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0]];
		}
		else
		{
			if ( o.spritematrix.length !==5 || o.spritematrix.some( line => (line.length !== 5) ) )
			{
				logWarning("Sprite graphics must be 5 wide and 5 high exactly.", state.identifiers_lineNumbers[o.identifier_index]);
			}
			o.spritematrix = generateSpriteMatrix(o.spritematrix);
		}
	}


	//calculate glyph dictionary
	state.glyphDict = state.identifiers.map(
		function(identifier, identifier_index)
		{
			var mask = blankMask.concat([]);
			for (const object_pos of state.getObjectsForIdentifier(identifier_index))
			{
				const o = state.objects[object_pos];
				mask[o.layer] = o.id;
			}
			return mask;
		}
	);

	/* determine which properties specify objects all on one layer */
	state.single_layer_property = state.identifiers_comptype.map(
		function (comptype, i)
		{
			if (comptype != identifier_type_property)
				return -1
			const layers = new Set( Array.from( state.getObjectsForIdentifier(i), j => state.objects[j].layer ) );
			return (layers.size == 1) ? layers.values().next().value : -1;
		}
	);

	if ( (state.idDict[0] === undefined) && (state.collisionLayers.length > 0))
	{
		logError('You need to have some objects defined');
	}

	//set default background object
	const background_identifier_index = state.identifiers.indexOf('background');
	if (background_identifier_index < 0)
	{
		logError("you have to define something to be the background");
		state.background_index = state.idDict[0];
	}
	else if (state.identifiers_comptype[background_identifier_index] == identifier_type_aggregate)
	{
		logError("background cannot be an aggregate (declared with 'and'), it has to be a simple type, or property (declared in terms of others using 'or').");
		state.background_index = state.idDict[0];
	}
	else
	{
		state.background_index = state.getObjectsAnIdentifierCanBe('background').values().next().value;
	}
	state.backgroundid = state.objects[state.background_index].id
	state.backgroundlayer = state.objects[state.background_index].layer
}


Level.prototype.calcBackgroundMask = function(state)
{
	if (state.backgroundlayer === undefined)
	{
		logError("you have to have a background layer");
	}

	var backgroundMask = state.layerMasks[state.backgroundlayer];
	for (var i=0; i<this.n_tiles; i++)
	{
		var cell=this.getCell(i);
		cell.iand(backgroundMask);
		if (!cell.iszero())
			return cell;
	}
	cell = new BitVec(STRIDE_OBJ);
	cell.ibitset(state.backgroundid);
	return cell;
}




function makeMaskFromGlyph(glyph)
{
	var glyphmask = new BitVec(STRIDE_OBJ);
	for (const id of glyph)
	{
		if (id >= 0)
		{
			glyphmask.ibitset(id);
		}			
	}
	return glyphmask;
}

function levelFromString(state, level)
{
	const backgroundlayer = state.backgroundlayer;
	const backgroundid = state.backgroundid;
	const backgroundLayerMask = state.layerMasks[backgroundlayer];
	var o = new Level(level[0], level[1].length, level.length-1, state.collisionLayers.length, null);
	o.objects = new Int32Array(o.width * o.height * STRIDE_OBJ);

	for (var i = 0; i < o.width; i++)
	{
		for (var j = 0; j < o.height; j++)
		{
			var ch = level[j+1].charAt(i);
			if (ch.length == 0) // TODO: why is it possible to have that from the parser?
			{
				ch = level[j+1].charAt(level[j+1].length-1);
			}

			const identifier_index = state.identifiers.indexOf(ch); // TODO: this should be done in the parser
			if (identifier_index < 0)
			{
				logError('Error, symbol "' + ch + '", used in map, not found.', level[0]+j);
				continue;
			}
			else if (state.identifiers_comptype[identifier_index] == identifier_type_property)
			{
				logError('Error, symbol "' + ch + '" is defined using \'or\', and therefore ambiguous - it cannot be used in a map. Did you mean to define it in terms of \'and\'?', level[0]+j);
				continue;
			}

			const maskint = makeMaskFromGlyph( state.glyphDict[identifier_index].concat([]) );
			for (var w = 0; w < STRIDE_OBJ; ++w)
			{
				o.objects[STRIDE_OBJ * (i * o.height + j) + w] = maskint.data[w];
			}
		}
	}

	var levelBackgroundMask = o.calcBackgroundMask(state);
	for (var i=0; i<o.n_tiles; i++)
	{
		var cell = o.getCell(i);
		if ( ! backgroundLayerMask.anyBitsInCommon(cell) )
		{
			cell.ior(levelBackgroundMask);
			o.setCell(i, cell);
		}
	}
	return o;
}

//also assigns glyphDict
function levelsToArray(state)
{
	var levels = state.levels;
	var processedLevels = [];

	for (var level of levels)
	{
		if (level.length == 0) // TODO: how could we get this result from the parser? If it's actually impossible, the whole loop could be simply a call to state.levels.map.
			continue;

		if (level[0] == '\n')
		{
			var o = {
				message: level[1]
			};
			splitMessage = wordwrap(o.message, intro_template[0].length);
			if (splitMessage.length > 12)
			{
				logWarning('Message too long to fit on screen.', level[2]);
			}
			processedLevels.push(o);
		}
		else
		{
			var o = levelFromString(state, level);
			processedLevels.push(o);
		}

	}
	state.levels = processedLevels;
}

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


function isCellRowDirectional(cellRow)
{
	if (cellRow.length > 1)
		return true;
	for (var cell of cellRow)
	{
		for (const [dir, identifier_index] of cell)
		{
			if (relativeDirections.indexOf(dir) >= 0) // TODO: should'nt it also include 'perpendicular' and 'parallel' but exclude 'horizontal' and 'vertical'?
			{
				return true;
			}
		}
	}
	return false;
}

function directionalRule(rule)
{
	return rule.lhs.some( isCellRowDirectional ) || rule.rhs.some( isCellRowDirectional )
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
			randomRule = true;
		} else if (simpleAbsoluteDirections.indexOf(token) >= 0) {
			directions.push(token);
		} else if (simpleRelativeDirections.indexOf(token) >= 0) {
			logError('You cannot use relative directions (\"^v<>\") to indicate in which direction(s) a rule applies.  Use absolute directions indicators (Up, Down, Left, Right, Horizontal, or Vertical, for instance), or, if you want the rule to apply in all four directions, do not specify directions', lineNumber);
		}
		else if (token == '[')
		{
			if (directions.length == 0) {
				directions.push(...directionaggregates['orthogonal']); // it's not actually about orthogonality, it's just that this word contains the four directions and only that
			}
			return [ directions, tag_classes, properties, late, rigid, randomRule, has_plus, i ];

		}
		else if (state.checkKnownIdentifier(token)) // we do that last because '+' and ']' may be used as identifiers (synonyms)
		{
			const identifier_index = state.identifiers.indexOf(token);
			const identifier_type =  state.identifiers_comptype[identifier_index];
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
		logError("A rule has to have an arrow in it.  There's no arrow here! Consider reading up about rules - you're clearly doing something weird", lineNumber);
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
	var curcell = null; // [up, cat, down mouse] -> a cell is everything between [or| and |or], it is '...' or an array of object conditions.
	var curobjcond = null; // -> an object condition is a sequence "direction? identifier", it is a pair [ direction or null, identifier_index ]
	var should_close_cellrow = false;
	var should_close_cell = false;
	var should_close_objcond = false;
	var cell_contains_ellipses = false;
	var should_add_ellipses = false;

	var incellrow = false;

	var rhs = false;
	var lhs_cells = [];
	var rhs_cells = [];
	var commands = [];

	var curcell = [];
	var curobjcond = [];
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
				logWarning("Multiple opening brackets without closing brackets.  Something fishy here.  Every '[' has to be closed by a ']', and you can't nest them.", lineNumber);
			}
			if (curcell.length > 0) { // TODO: isn't that dupplicating what the bracketbalance test does?
				logError('Error, malformed cell rule - encountered a "["" before previous bracket was closed', lineNumber);
			}
			incellrow = true;
			curcell = [];
		} else if (reg_directions_only.exec(token)) {
			if (curobjcond.length == 1) {
				// TODO: fix bug https://github.com/increpare/PuzzleScript/issues/395
				//       Basically, we need to replace directions words with 'direction' flags (including 'no' and 'random' that are not directions) and check
				//       there is no more than one direction? (relative directions should not yet be resolved, however)
				//       the idea behind the error message is that the direction words would be and-ed, which is certainly coherent with the idea that they define
				//       additional constraints on the matching but is also incompatible with the use of some words like 'parallel' that present an alternative (< or >).
				//       And we clearly want the ability to have alternatives, but it's just a shortcut to avoid making multiple rules instead.
				logError("Error, an item can only have one direction/action at a time, but you're looking for several at once!", lineNumber);
			} else if (!incellrow) {
				logWarning("Invalid syntax. Directions should be placed at the start of a rule.", lineNumber);
			} else {
				curobjcond.push(token);
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
				logWarning("Multiple closing brackets without corresponding opening brackets.  Something fishy here.  Every '[' has to be closed by a ']', and you can't nest them.", lineNumber);
			}
			should_close_cellrow = true; // TODO: should it be "should_close_cellrow = (bracketbalance == 0)"?
		} else if (token === '->') {
			if (incellrow) {
				logError('Encountered an unexpected "->" inside square brackets.  It\'s used to separate states, it has no place inside them >:| .', lineNumber);
			} else if (rhs) {
				logError('Error, you can only use "->" once in a rule; it\'s used to separate before and after states.', lineNumber);
			} else {
				rhs = true;
			}
		} else if (state.checkKnownIdentifier(token) >= 0) {
			if (!incellrow) {
				logWarning("Invalid token "+token.toUpperCase() +". Object names should only be used within cells (square brackets).", lineNumber);
			}
			else if (curobjcond.length == 0) {
				curobjcond.push('');
			}
			curobjcond.push(state.checkKnownIdentifier(token)); // TODO: we should not search it twice...
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
		} else if (commandwords.indexOf(token) >= 0) {
			if (rhs === false) {
				logError("Commands cannot appear on the left-hand side of the arrow.", lineNumber);
			}
			if (incellrow)
			{
				logError('Commands must appear at the end of the rule, outside the cell rows (square brackety things).', lineNumber);
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
				commands.push([token, messageStr]);
				i=tokens.length;
			} else {
				commands.push([token]);
			}
		} else {
			logError('Error, malformed cell rule - was looking for cell contents, but found "' + token + '".  What am I supposed to do with this, eh, please tell me that.', lineNumber);
		}

		if (should_close_objcond || should_add_ellipses || should_close_cell || should_close_cellrow)
		{
			// close the current object condition / ellipsis
			if (curobjcond.length == 1)
			{
				// TODO: this error message should not be triggered when something was provided but was not a valid object name.
				logError('In a rule, if you specify a force, it has to act on an object.', lineNumber);
			}
			else if (curobjcond.length == 2)
			{
				curcell.push(curobjcond)
			}
			curobjcond = [];
			should_close_objcond = false;
		}

		if (should_add_ellipses)
		{
			curcell.push([token, token]);
			cell_contains_ellipses = true;
			should_add_ellipses = false;
		}

		if (should_close_cell || should_close_cellrow)
		{
			// close the current cell
			if ( cell_contains_ellipses && (curcell.length > 1) )
			{
				logError('Ellipses shoud be alone in their own cell, like that: |...|', lineNumber);
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
			if ( (curcellrow.length > 0) && (curcellrow[curcellrow.length - 1][0] == '...')) {
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
		if (commands.length > 0 && rhs_cells.length == 0) {
			//ok
		} else {
			logError('Error, when specifying a rule, the number of matches (square bracketed bits) on the left hand side of the arrow must equal the number on the right', lineNumber);
		}
	} else {
		for (const [i, lhs_cell] of lhs_cells.entries())
		{
			if (lhs_cell.length != rhs_cells[i].length) {
				logError('In a rule, each pattern to match on the left must have a corresponding pattern on the right of equal length (number of cells).', lineNumber);
				return null; // ignoring the rule because it would cause bugs later in the code.
			}
		}
	}

	// if (lhs_cells.length == 0) {
	// 	logError('This rule refers to nothing.  What the heck? :O', lineNumber);
	// }

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

	rule_line.is_directional = directionalRule(rule_line)
	if (rule_line.is_directional === false)
	{
		rule_line.directions = ['up'];
	}

	//next up - replace relative directions with absolute direction
	return rule_line;
}

function deepCloneCellRow(cellrow)
{
	return cellrow.map(
		cell =>  cell.map( ([dir, object_index]) => [dir, object_index] )
	);
}

function deepCloneHS(HS)
{
	return HS.map( deepCloneCellRow );
}

function deepCloneRule(rule)
{
	return {
		lineNumber: rule.lineNumber,
		groupNumber: rule.groupNumber,
		direction: rule.direction,
		late: rule.late,
		rigid: rule.rigid,
		randomRule:rule.randomRule,
		lhs: deepCloneHS(rule.lhs),
		rhs: deepCloneHS(rule.rhs),
		commands: rule.commands, // should be deepCloned too?
		is_directional: rule.is_directional
	};
}

function* generateDirections(directions)
{
	for (const dirword of directions)
	{
		for (const dir of (dirword in directionaggregates) ? directionaggregates[dirword] : [dirword])
		{
			yield dir;
		}
	}
}

function* generateRulesExpansions(state, rules)
{
	for (const rule of rules)
	{
		const directions = new Set( generateDirections(rule.directions) );
		const parameter_sets = Array.from(
			[...rule.tag_classes, ...rule.parameter_properties],
			identifier_index => Array.from(state.identifiers_objects[identifier_index], object_index => [identifier_index, object_index] )
		);
		for (const parameters of cartesian_product(directions, ...parameter_sets))
		{
			yield [rule, rule.tag_classes.size, ...parameters];
		}
	}
}

function expandRule(state, original_rule, nbtags, dir, ...parameters)
{
	var rule = deepCloneRule(original_rule);

	rule.direction = dir; // we have rule.directions (plural) before this loop, but rule.direction (singular) after the loop.
	rule.tag_classes = parameters.slice(1, nbtags+1);
	rule.parameter_properties = parameters.slice(nbtags+1);

//	Remove relative directions
	convertRelativeDirsToAbsolute(rule);
//	Optional: replace up/left rules with their down/right equivalents
	rewriteUpLeftRules(rule);
//	Replace aggregates and synonyms with what they mean
	atomizeAggregatesAndSynonyms(state, rule);
	return rule;
}

function rulesToArray(state)
{
	var oldrules = state.rules;
	var rules = [];
	var loops = [];
	for (const oldrule of oldrules)
	{
		var lineNumber = oldrule[1];
		var newrule = parseRuleString(oldrule, state, rules);
		if (newrule === null)
			continue;
		if (newrule.bracket !== undefined)
		{
			loops.push( [lineNumber, newrule.bracket] );
			continue;
		}
		rules.push(newrule);
	}
	state.loops = loops;

	//now expand out rules with multiple directions
	const rules2 = Array.from( generateRulesExpansions(state, rules), rule_expansion => expandRule(state, ...rule_expansion) );

	var rules3 = [];
	//expand property rules
	for (const rule of rules2)
	{
		rules3 = rules3.concat(concretizeMovingRule(state, rule, rule.lineNumber));
	}

	var rules4 = [];
	for (const rule of rules3)
	{
		rules4 = rules4.concat(concretizePropertyRule(state, rule, rule.lineNumber));
	}

	state.rules = rules4;
}

function containsEllipsis(rule)
{
	return rule.lhs.some( cellrow => cellrow.some( cell => cell[1] === '...' ) );
}

function rewriteUpLeftRules(rule)
{
	if (containsEllipsis(rule)) // TODO: What's wrong with reversing a rule that contains ellipses?
		return;

	if (rule.direction == 'up')
	{
		rule.direction = 'down';
	}
	else if (rule.direction == 'left')
	{
		rule.direction = 'right';
	}
	else
	{
		return;
	}

	for (var cellrow of rule.lhs)
	{
		cellrow.reverse();
	}
	if (rule.rhs.length === 0) // TODO: I guess reversing an empty array works well, so this test should not be necessary
		return
	for (var cellrow of rule.rhs)
	{
		cellrow.reverse();
	}
}

function getPropertiesFromCell(state, cell)
{
	var result = [];
	for (const [dir, identifier_index] of cell)
	{
		if (dir == "random")
			continue;
		if (state.identifiers_comptype[identifier_index] === identifier_type_property)
		{
			result.push(identifier_index);
		}
	}
	return result;
}

//returns you a list of object names in that cell that're moving -> actually, it only returns those moving with a directionaggregate...
function getMovings(cell)
{
	return cell.filter( ([dir, identifier_index]) => (dir in directionaggregates) );
}

function concretizePropertyInCell(cell, property, concreteType)
{
	for (var objcond of cell)
	{
		if (objcond[1] === property && objcond[0]!=="random")
		{
			objcond[1] = concreteType;
		}
	}
}

function concretizeMovingInCell(cell, ambiguousMovement, idToMove, concreteDirection)
{
	for (var objcond of cell)
	{
		if (objcond[0] === ambiguousMovement && objcond[1] === idToMove)
		{
			objcond[0] = concreteDirection;
		}
	}
}

function concretizeMovingInCellByAmbiguousMovementName(cell, ambiguousMovement, concreteDirection)
{
	for (var objcond of cell)
	{
		if (objcond[0] === ambiguousMovement)
		{
			objcond[0] = concreteDirection;
		}
	}
}

// TODO: this function does something very similar to what atomizeCellAggregatesAndSynonyms does, so the two functions should be merged
function expandNoPrefixedProperties(state, cell)
{
	var expanded = [];
	for (const [dir, identifier_index] of cell)
	{
		if ( (dir === 'no') && (state.identifiers_comptype[identifier_index] === identifier_type_property) )
		{
			expanded.push(...Array.from(state.getObjectsForIdentifier(identifier_index), object_index => [dir, state.objects[object_index].identifier_index] ) );
		}
		else
		{
			expanded.push( [dir, identifier_index] );
		} 
	}
	return expanded;
}

function expandNoPrefixedPropertiesForCellRow(state, cellrows)
{
	for (const [i, cur_cellrow] of cellrows.entries())
	{
		cellrows[i] = cur_cellrow.map( cur_cell => expandNoPrefixedProperties(state, cur_cell) )
	}
}

// TODO: this function and concretizeMovingRule have a very similar structure and should probably be merged.
/* Expands the properties on the LHS of a rule and disambiguates those on the RHS.
 * The rules for the expansion on the LHS are:
 * - properties prefixed by "no" are replaced by the set of objects they can be, all prefixed by "no".
 *   (De Morgan's law: no (A or B or C) = (no A) and (no B) and (no C).)
 * - new rules are created for every possible object each property can be.
 *   (i.e., the cartesian product of the sets of objects for each occurance of a property).
 * The disambiguation rules are:
 * - if the property has a single occurence in the LHS, its concrete remplacement will be used for all the
 *   occurences of this property in the RHS.
 * - if a property appearing in a cell of the RHS appears also in the same cell of the LHS, then the concrete
 *   replacement of the latter will be used for the former.
 */
function concretizePropertyRule(state, rule, lineNumber)
{	
	//step 1, rephrase rule to change "no flying" to "no cat no bat"
	expandNoPrefixedPropertiesForCellRow(state, rule.lhs);
	expandNoPrefixedPropertiesForCellRow(state, rule.rhs);

	//are there any properties we could avoid processing?
	// e.g. [> player | movable] -> [> player | > movable],
	// 		doesn't need to be split up (assuming single-layer player/block aggregates)

	// we can't manage this if they're being used to disambiguate
	var ambiguousProperties = {}; // properties that appear in the RHS but not in the same cell of the LHS.

	for (var j = 0; j < rule.rhs.length; j++)
	{
		var row_l = rule.lhs[j];
		var row_r = rule.rhs[j];
		for (var k = 0; k < row_r.length; k++)
		{
			const properties_l = getPropertiesFromCell(state, row_l[k]);
			const properties_r = getPropertiesFromCell(state, row_r[k]);
			for (const property of properties_r)
			{
				if (properties_l.indexOf(property) == -1)
				{
					ambiguousProperties[property] = true;
				}
			}
		}
	}

	var result = [rule];

	var shouldremove;
	var modified = true;
	while (modified)
	{
		modified = false;
		for (var i = 0; i < result.length; i++)
		{
			//only need to iterate through lhs
			const cur_rule = result[i];
			shouldremove = false;
			for (var j = 0; j < cur_rule.lhs.length && !shouldremove; j++)
			{
				const cur_rulerow = cur_rule.lhs[j];
				for (var k = 0; k < cur_rulerow.length && !shouldremove; k++)
				{
					for (const property of getPropertiesFromCell(state, cur_rulerow[k]))
					{
						// ambiguousProperties[property] !== true means that either the property does not appear on the RHS
						// or it will be disambiguated because whenever it appears in the RHS it also appears in the matching
						// cell of the RHS.
						if ( (state.single_layer_property[property] >= 0) && (ambiguousProperties[property] !== true) )
							continue; // we don't need to explode this property

						shouldremove = true;
						modified = true;

						//just do the base property, let future iterations take care of the others
						// TODO: we currently replace a property by all the objects it can be, but if instead we replaced it by the properties/objects appearing in its
						// definition, it would allow to stop the replacements when one of the replacement is a single-layer property, creating less rules.
						// an alternative would be to split each property into its single-layer subsets, but that could introduce new bugs easily. -- ClementSparrow
						const aliases = Array.from(state.getObjectsForIdentifier(property), object_index => state.objects[object_index].identifier_index );
						for (const concreteType of aliases)
						{
							var newrule = deepCloneRule(cur_rule);

							// also clone the propertyReplacements of the rule
							newrule.propertyReplacement = (cur_rule.propertyReplacement === undefined) ? [] : cur_rule.propertyReplacement.map( x => Array.from(x) );

							concretizePropertyInCell(newrule.lhs[j][k], property, concreteType);
							if (newrule.rhs.length > 0)
							{
								// this disambiguates the property appearing in the same cell of the RHS, if any
								concretizePropertyInCell(newrule.rhs[j][k], property, concreteType);//do for the corresponding rhs cell as well
							}
							// note that after that, the property and the concreteType can still appear in other cells
							
							if (newrule.propertyReplacement[property] === undefined)
							{
								newrule.propertyReplacement[property] = [concreteType, 1];
							}
							else
							{
								newrule.propertyReplacement[property][1] += 1;
							}

							result.push(newrule);
						}

						break;
					}
				}
			}
			if (shouldremove)
			{
				result.splice(i, 1);
				i--;
			}
		}
	}

	
	for (var cur_rule of result)
	{
		//for each rule
		if (cur_rule.propertyReplacement === undefined)
			continue;
		
		//for each property replacement in that rule
		for (const [property, propDat] of cur_rule.propertyReplacement.entries())
		{
			if (propDat !== undefined)
			{
				const [concreteType, occurrenceCount] = propDat;

				if (occurrenceCount === 1) // the property appears only once on the LHS, so it can be used to disambiguate all the occurences of the property on the RHS.
				{
					//do the replacement
					for (var cellRow_rhs of cur_rule.rhs)
					{
						for (var cell of cellRow_rhs)
						{
							concretizePropertyInCell(cell, property, concreteType);
						}
					}
					// TODO: we could also remove the property from ambiguousProperties now, since it has
					// just been disambiguated. It would allow to just test that ambiguousProperties is
					// empty instead of doing the loop below.
				}
			}
		}
		delete cur_rule.propertyReplacement; // not used anymore
	}

	// if any properties remain on the RHSes, bleep loudly
	// TODO: why only log the last one found and not all of them?
	var rhsPropertyRemains = '';
	for (const cur_rule of result)
	{
		for (const cur_rulerow of cur_rule.rhs)
		{
			for (const cur_cell of cur_rulerow)
			{
				for (const prop of getPropertiesFromCell(state, cur_cell))
				{
					if (ambiguousProperties.hasOwnProperty(prop))
					{
						rhsPropertyRemains = prop;
					}
				}
			}
		}
	}


	if (rhsPropertyRemains.length > 0)
	{
		logError('This rule has a property on the right-hand side, \"'+ state.identifiers[rhsPropertyRemains].toUpperCase() + "\", that can't be inferred from the left-hand side.  (either for every property on the right there has to be a corresponding one on the left in the same cell, OR, if there's a single occurrence of a particular property name on the left, all properties of the same name on the right are assumed to be the same).",lineNumber);
	}

	return result;
}


function concretizeMovingRule(state, rule, lineNumber) // a better name for this function would be concretizeDirectionAggregatesInRule?
{
	var result = [rule];

//	Generate rules in which "directionaggregate identifier" instances are replaced with concrete directions for all occurences of the same directionaggregate and identifier
	
	// Note that 'parallel' and 'perpendicular' have already been replaced by 'horizontal'/'vertical' in convertRelativeDirsToAbsolute,
	// so the directionaggregates here can only be 'horizontal', 'vertical', 'moving', or 'orthogonal'.
	// Similarly, identifiers that are aggregates or synonyms have already been replaced with objects in atomizeAggregatesAndSynonyms,
	// so the identifiers here can only be objects or properties.
	
	var shouldremove;
	var modified = true;
	while (modified)
	{
		modified = false;
		for (var i = 0; i < result.length; i++)
		{
			//only need to iterate through lhs
			var cur_rule = result[i];
			shouldremove = false;
			for (var j = 0; j < cur_rule.lhs.length; j++)
			{
				const cur_rulerow = cur_rule.lhs[j];
				for (var k = 0; k < cur_rulerow.length; k++)
				{
					var movings = getMovings(cur_rulerow[k]); // TODO: this seems an inneficient way to find a list of all movings just to change one...
					if (movings.length > 0)
					{
						shouldremove = true;
						modified = true;

						//just do the base directionaggregate, let future iterations take care of the others
						//(since all occurences of the base directionaggregate will be replaced by atomic directions, it will not reappear here)
						const [ambiguous_dir, identifier_index] = movings[0];
						for (const concreteDirection of directionaggregates[ambiguous_dir])
						{
							var newrule = deepCloneRule(cur_rule);

							// also clone the movingReplacements of the rule
							newrule.movingReplacement = (cur_rule.movingReplacement === undefined) ? [] : cur_rule.movingReplacement.map( x => Array.from(x) );

							concretizeMovingInCell(newrule.lhs[j][k], ambiguous_dir, identifier_index, concreteDirection);
							if (newrule.rhs.length > 0) // desambiguate a directionaggregate in the RHS if it also appears on the same identifier in the same LHS cell.
							{
								// note that there is no guaranty that the same [ambiguous_dir, identifier] appears in the same cell of the RHS...
								concretizeMovingInCell(newrule.rhs[j][k], ambiguous_dir, identifier_index, concreteDirection);//do for the corresponding rhs cell as well
							}
							
							if (newrule.movingReplacement[identifier_index] === undefined)
							{
								newrule.movingReplacement[identifier_index] = [concreteDirection, 1, ambiguous_dir];
							}
							else
							{
								newrule.movingReplacement[identifier_index][1] += 1; // counts how man different ambiguous_dir are used for this identifier in the rule
							}

							result.push(newrule);
						}
					}
				}
			}
			if (shouldremove)
			{
				result.splice(i, 1);
				i--;
			}
		}
	}

	for (var cur_rule of result)
	{
		//for each rule
		if (cur_rule.movingReplacement === undefined)
			continue;

		var ambiguous_movement_dict = {};
		//strict first - matches movement direction to objects
		//for each property replacement in that rule
		for (const [cand_index, movingDat] of cur_rule.movingReplacement.entries())
		{
			if (movingDat !== undefined)
			{
				const [concreteMovement, occurrenceCount, ambiguousMovement] = movingDat;

				// invalidates an ambiguous movement that appears multiple times in the LHS, whether it's used with different identifiers or multiple occurences of a same identifier.
				ambiguous_movement_dict[ambiguousMovement] = ( (ambiguousMovement in ambiguous_movement_dict) || (occurrenceCount !== 1) ) ? "INVALID" : concreteMovement;

				if (occurrenceCount === 1)
				{
					//do the replacement in the RHS
					// all the direction aggregates of the RHS with this identifier gets disambiguated.
					for (const cellRow_rhs of cur_rule.rhs)
					{
						for (var cell of cellRow_rhs)
						{
							concretizeMovingInCell(cell, ambiguousMovement, cand_index, concreteMovement);
						}
					}
				}
			}
		}
		delete cur_rule.movingReplacement; // not used anymore

		//for each ambiguous word, if there was a single occurence of it in the whole lhs, then replace it also everywhere it appears in the RHS (whatever the identifier)
		for(var ambiguousMovement in ambiguous_movement_dict)
		{
			if (ambiguous_movement_dict.hasOwnProperty(ambiguousMovement) && ambiguousMovement!=="INVALID")
			{
				const concreteMovement = ambiguous_movement_dict[ambiguousMovement];
				if (concreteMovement === "INVALID")
					continue;
				// the direction aggregate has been seen exactly once in the LHS
				for (var cellRow_rhs of cur_rule.rhs)
				{
					for (var cell of cellRow_rhs)
					{
						concretizeMovingInCellByAmbiguousMovementName(cell, ambiguousMovement, concreteMovement);
					}
				}
			}
		}
	}

	// if any direction aggregate remain on the RHSes, bleep loudly
	// TODO: why only log the last one found and not all of them?
	var rhsAmbiguousMovementsRemain = '';
	for (const cur_rule of result)
	{
		for (const cur_rulerow of cur_rule.rhs)
		{
			for (const cur_cell of cur_rulerow)
			{
				const movings = getMovings(cur_cell);
				if (movings.length > 0)
				{
					rhsAmbiguousMovementsRemain = movings[0][0];
				}
			}
		}
	}
	if (rhsAmbiguousMovementsRemain.length > 0)
	{
		logError('This rule has an ambiguous movement on the right-hand side, \"'+ rhsAmbiguousMovementsRemain + "\", that can't be inferred from the left-hand side.  (either for every ambiguous movement associated to an entity on the right there has to be a corresponding one on the left attached to the same entity, OR, if there's a single occurrence of a particular ambiguous movement on the left, all properties of the same movement attached to the same object on the right are assumed to be the same (or something like that)).",lineNumber);
	}

	return result;
}

// replaces aggregates and synonyms appearing in a rule by the list of all objects they are aggregates/synonyms of, i.e. objects they must be.
// each new objects has the same motion/action words than the replaced one.
// -> a possible generalization could be to use more qualifier words beyond motion/action words, and then replace the aggregate/synonym by a list, propagating the qualifier to the objects of the list that support them.
function atomizeAggregatesAndSynonyms(state, rule)
{
	atomizeHSAggregatesAndSynonyms(state, rule.lhs, rule.lineNumber)
	atomizeHSAggregatesAndSynonyms(state, rule.rhs, rule.lineNumber)
}

function atomizeHSAggregatesAndSynonyms(state, hs, lineNumber)
{
	for (const cellrow of hs)
	{
		for (const cell of cellrow)
		{
			atomizeCellAggregatesAndSynonyms(state, cell, lineNumber);
		}
	}
}

function atomizeCellAggregatesAndSynonyms(state, cell, lineNumber)
{
	for (var i = 0; i < cell.length; i += 1)
	{
		const [dir, c] = cell[i];

		if (dir === '...')
			continue;

		const identifier_comptype = state.identifiers_comptype[c];
		if (identifier_comptype != identifier_type_object) // not an object nor the synonym of an object
		{
			if (identifier_comptype != identifier_type_aggregate) // not an aggregate or the synonym of an aggregate
				continue;
			// aggregate or synonym of an aggregate
			if (dir === 'no')
			{
				logError("You cannot use 'no' to exclude the aggregate object " +c.toUpperCase()+" (defined using 'AND'), only regular objects, or properties (objects defined using 'OR').  If you want to do this, you'll have to write it out yourself the long way.", lineNumber);
			}
		}

		const equivs = Array.from( state.getObjectsForIdentifier(c), p => [dir, state.objects[p].identifier_index] );
		cell.splice(i, 1, ...equivs);
		i += equivs.length-1;
	}
}

// TODO: that's just applying a direction function and should probably be implemented as such.
// It means that each entry of relativeDirs should be a direction function, and
// that "const index = relativeDirs.indexOf(c)" should become "const ruledir_function = ruledir_function_names.indexOf(c)"
// and "cell[i] = relativeDict[forward][index]" should be replaced with "cell[i] = ruledir_functions[index][forward]"
// where each ruledir_function is a array giving the result of the function for each rule direction.
function convertRelativeDirsToAbsolute(rule)
{
	const forward = rule.direction;
	absolutifyRuleHS(rule.lhs, forward);
	absolutifyRuleHS(rule.rhs, forward);
}

function absolutifyRuleHS(hs, forward)
{
	for (const cellrow of hs)
	{
		for (const cell of cellrow)
		{
			absolutifyRuleCell(forward, cell);
		}
	}
}

var relativeDirs = ['^','v','<','>','parallel','perpendicular'];//used to index the following
var relativeDict = {
	'right': ['up', 'down', 'left', 'right','horizontal','vertical'],
	'up': ['left', 'right', 'down', 'up','vertical','horizontal'],
	'down': ['right', 'left', 'up', 'down','vertical','horizontal'],
	'left': ['down', 'up', 'right', 'left','horizontal','vertical']
};

function absolutifyRuleCell(forward, cell)
{
	for (var objcond of cell)
	{
		const index = relativeDirs.indexOf(objcond[0]);
		if (index >= 0)
		{
			objcond[0] = relativeDict[forward][index];
		}
	}
}
/*
	direction mask
	UP parseInt('%1', 2);
	DOWN parseInt('0', 2);
	LEFT parseInt('0', 2);
	RIGHT parseInt('0', 2);
	?  parseInt('', 2);

*/

var dirMasks = {
	'up'	: parseInt('00001', 2),
	'down'	: parseInt('00010', 2),
	'left'	: parseInt('00100', 2),
	'right'	: parseInt('01000', 2),
	'moving': parseInt('01111', 2),
	'no'	: parseInt('00011', 2),
	'randomdir': parseInt('00101', 2),
	'random' : parseInt('10010',2),
	'action' : parseInt('10000', 2),
	'' : parseInt('00000',2)
};


function ruleToMask(state, rule, layerTemplate, layerCount)
{
	for (var j = 0; j < rule.lhs.length; j++)
	{
		var cellrow_l = rule.lhs[j];
		var cellrow_r = rule.rhs[j];

		for (const [k, cell_l] of cellrow_l.entries())
		{
			var layersUsed_l = Array.from(layerTemplate);
			var objectsPresent = new BitVec(STRIDE_OBJ);
			var objectsMissing = new BitVec(STRIDE_OBJ);
			var anyObjectsPresent = [];
			var movementsPresent = new BitVec(STRIDE_MOV);
			var movementsMissing = new BitVec(STRIDE_MOV);

			var objectlayers_l = new BitVec(STRIDE_MOV);

			for (const [object_dir, identifier_index] of cell_l)
			{
				if (object_dir === '...')
				{
					objectsPresent = ellipsisPattern;
					if (rule.rhs.length > 0)
					{
						var rhscell = cellrow_r[k];
						if (rhscell.length !==1 || rhscell[0][0] !== '...')
						{
							logError("An ellipsis on the left must be matched by one in the corresponding place on the right.", rule.lineNumber);								
						}
					} 
					break;
				}
				else if (object_dir === 'random')
				{
					logError("'random' cannot be matched on the left-hand side, it can only appear on the right", rule.lineNumber);
					continue;
				}

				// the identifier may be a property on a single collision layer, in which case object_index should not be unique
				const object = (state.identifiers_objects[identifier_index].size > 1) ? null : state.objects[state.identifiers_objects[identifier_index].values().next().value];

				const objectMask = state.objectMasks[identifier_index];
				const layerIndex = (object !== null) ? object.layer : state.single_layer_property[identifier_index];

				if (object_dir === 'no')
				{
					objectsMissing.ior(objectMask);
				}
				else if ((layerIndex === undefined) || (layerIndex < 0))
				{
					logError("Oops!  " +state.identifiers[identifier_index].toUpperCase()+" not assigned to a layer.", rule.lineNumber);
				}
				else
				{
					const existing_idindex = layersUsed_l[layerIndex];
					if (existing_idindex !== null)
					{
						rule.discard = [state.identifiers[identifier_index].toUpperCase(), state.identifiers[existing_idindex].toUpperCase()];
					}

					layersUsed_l[layerIndex] = identifier_index;

					if (object)
					{
						objectsPresent.ior(objectMask);
						objectlayers_l.ishiftor(0x1f, 5*layerIndex);
					}
					else
					{
						anyObjectsPresent.push(objectMask);
					}

					if (object_dir === 'stationary')
					{
						movementsMissing.ishiftor(0x1f, 5*layerIndex);
					}
					else
					{
						movementsPresent.ishiftor(dirMasks[object_dir], 5 * layerIndex);
					}
				}
			}

			if (rule.rhs.length > 0)
			{
				var rhscell = cellrow_r[k];
				var lhscell = cellrow_l[k];
				if (rhscell[0] === '...' && lhscell[0] !== '...' )
				{
					logError("An ellipsis on the right must be matched by one in the corresponding place on the left.", rule.lineNumber);
				}
				// if ( (rhscell.length !== 1) && rhscell.some( objcond => (objcond[0] === '...') ) )
				// {
				// 	logError("You can't have anything in with an ellipsis. Sorry.", rule.lineNumber);
				// }
			}

			if (objectsPresent === ellipsisPattern)
			{
				cellrow_l[k] = ellipsisPattern;
				continue;
			}
			cellrow_l[k] = new CellPattern([objectsPresent, objectsMissing, anyObjectsPresent, movementsPresent, movementsMissing, null]);

			if (rule.rhs.length === 0)
				continue;

			var cell_r = cellrow_r[k];
			var layersUsed_r = layerTemplate.concat([]);
			var layersUsedRand_r = layerTemplate.concat([]);

			var objectsClear = new BitVec(STRIDE_OBJ);
			var objectsSet = new BitVec(STRIDE_OBJ);
			var movementsClear = new BitVec(STRIDE_MOV);
			var movementsSet = new BitVec(STRIDE_MOV);

			var objectlayers_r = new BitVec(STRIDE_MOV);
			var randomMask_r = new BitVec(STRIDE_OBJ);
			var postMovementsLayerMask_r = new BitVec(STRIDE_MOV);
			var randomDirMask_r = new BitVec(STRIDE_MOV);
			for (const [object_dir, identifier_index] of cell_r)
			{
				// the identifier may be a property on a single collision layer, in which case object_index should not be unique
				const object = state.getObjectsForIdentifier(identifier_index).size > 1 ? null : state.objects[state.getObjectsForIdentifier(identifier_index).values().next().value];

				if (object_dir === '...')
				{
					//logError("spooky ellipsis found! (should never hit this)");
					break;
				}
				else if (object_dir === 'random')
				{
					// if (object.name in state.objectMasks)
					if (state.identifiers_comptype[identifier_index] !== identifier_type_aggregate)
					{
						var mask = state.objectMasks[identifier_index];
						randomMask_r.ior(mask);
						const values = Array.from( state.getObjectsForIdentifier(identifier_index), p => [p, state.objects[p]] );
						for (const [subobject_index, subobject] of values)
						{
							const subobj_layerIndex = subobject.layer|0; // TODO: we should store...
							const existing_index = layersUsed_r[subobj_layerIndex];
							if ( (existing_index !== null) && (subobject_index !== existing_index) )
							{
								logWarning("This rule may try to spawn a "+subobject.name.toUpperCase()+" with random, but also requires a "+state.objects[existing_index].name.toUpperCase()+" be here, which is on the same layer - they shouldn't be able to coexist!", rule.lineNumber); 									
							}

							layersUsedRand_r[subobj_layerIndex] = subobject.identifier_index;
						}                      
					}
					else
					{
						logError('You want to spawn a random "'+state.identifiers[identifier_index].toUpperCase()+'", but I don\'t know how to do that', rule.lineNumber);
					}
					continue;
				}

				const objectMask = state.objectMasks[identifier_index];
				const layerIndex = (object !== null) ? object.layer : state.single_layer_property[identifier_index];
				
				if (object_dir == 'no')
				{
					objectsClear.ior(objectMask);
				}
				else if ((layerIndex === undefined) || (layerIndex < 0))
				{
					logError("Oops!  " +state.identifiers[identifier_index].toUpperCase()+" not assigned to a layer.", rule.lineNumber);
				}
				else
				{
					var existing_index = (layerIndex < 0) ? null : layersUsed_r[layerIndex];
					if (existing_index === null)
					{
						existing_index = layersUsedRand_r[layerIndex];
					}

					if (existing_index !== null)
					{
						if ( ! rule.hasOwnProperty('discard') )
						{
							logError('Rule matches object types that can\'t overlap: "' + state.identifiers[identifier_index].toUpperCase() + '" and "' + state.identifiers[existing_index].toUpperCase() + '".',rule.lineNumber);
						}
					}

					layersUsed_r[layerIndex] = identifier_index;

					if (object_dir.length > 0)
					{
						postMovementsLayerMask_r.ishiftor(0x1f, 5*layerIndex);
					}

					var layerMask = state.layerMasks[layerIndex];

					if (object)
					{
						objectsSet.ibitset(object.id);
						objectsClear.ior(layerMask);
						objectlayers_r.ishiftor(0x1f, 5*layerIndex);
					}
					else
					{
						// shouldn't need to do anything here...
					}
					if (object_dir === 'stationary')
					{
						movementsClear.ishiftor(0x1f, 5*layerIndex);
					}
					if (object_dir === 'randomdir')
					{
						randomDirMask_r.ishiftor(dirMasks[object_dir], 5 * layerIndex);
					}
					else
					{						
						movementsSet.ishiftor(dirMasks[object_dir], 5 * layerIndex);
					}
				}
			}

			if ( ! objectsPresent.bitsSetInArray(objectsSet.data) )
			{
				objectsClear.ior(objectsPresent); // clear out old objects
			}
			if ( ! movementsPresent.bitsSetInArray(movementsSet.data) )
			{
				movementsClear.ior(movementsPresent); // ... and movements
			}

			for (var l = 0; l < layerCount; l++)
			{
				if (layersUsed_l[l] !== null && layersUsed_r[l] === null)
				{
					// a layer matched on the lhs, but not on the rhs
					objectsClear.ior(state.layerMasks[l]);
					postMovementsLayerMask_r.ishiftor(0x1f, 5*l);
				}
			}

			objectlayers_l.iclear(objectlayers_r);

			postMovementsLayerMask_r.ior(objectlayers_l);
			if (objectsClear || objectsSet || movementsClear || movementsSet || postMovementsLayerMask_r)
			{
				// only set a replacement if something would change
				cellrow_l[k].replacement = new CellReplacement([objectsClear, objectsSet, movementsClear, movementsSet, postMovementsLayerMask_r, randomMask_r, randomDirMask_r]);
			}
		}
	}
}

function rulesToMask(state)
{
	var layerCount = state.collisionLayers.length;
	var layerTemplate = Array(layerCount).fill(null);

	for (const rule of state.rules)
	{
		ruleToMask(state, rule, layerTemplate, layerCount);
	}
}

function cellRowMasks(rule) {
	var ruleMasks=[];
	var lhs=rule[1];
	for (var i=0;i<lhs.length;i++) {
		var cellRow = lhs[i];
		var rowMask=new BitVec(STRIDE_OBJ);
		for (var j=0;j<cellRow.length;j++) {
			if (cellRow[j] === ellipsisPattern)
				continue;
			rowMask.ior(cellRow[j].objectsPresent);
		}
		ruleMasks.push(rowMask);
	}
	return ruleMasks;
}

function collapseRules(groups)
{
	for (var gn = 0; gn < groups.length; gn++)
	{
		var rules = groups[gn];
		for (var i = 0; i < rules.length; i++)
		{
			const oldrule = rules[i];
			var newrule = [0, [], oldrule.rhs.length>0, oldrule.lineNumber/*ellipses,group number,rigid,commands,randomrule,[cellrowmasks]*/];
			var ellipses = Array(oldrule.lhs.length).fill(false);

			newrule[0] = dirMasks[oldrule.direction];
			for (var j=0; j<oldrule.lhs.length; j++)
			{
				var cellrow_l = oldrule.lhs[j];
				for (const cell of cellrow_l)
				{
					if (cell === ellipsisPattern)
					{
						if (ellipses[j])
						{
							logError("You can't use two ellipses in a single cell match pattern.  If you really want to, please implement it yourself and send me a patch :) ", oldrule.lineNumber);
						} 
						ellipses[j] = true;
					}
				}
				newrule[1][j] = cellrow_l;
			}
			newrule.push(ellipses);
			newrule.push(oldrule.groupNumber);
			newrule.push(oldrule.rigid);
			newrule.push(oldrule.commands);
			newrule.push(oldrule.randomRule);
			newrule.push(cellRowMasks(newrule));
			rules[i] = new Rule(newrule);
		}
	}
	matchCache = {}; // clear match cache so we don't slowly leak memory
}

// test that in a rule group the only random rules are the ones defined by the first rule of the group
// TODO: this is a syntaxic issue that should/could be dealt with much sooner?
function ruleGroupRandomnessTest(ruleGroup)
{
	// if (ruleGroup.length === 0) // TODO: as long as ruleGroupRandomnessTest is only called by arrangeRulesByGroupNumber{Aux}, this test cannot fail
	// 	return;
	const firstLineNumber = ruleGroup[0].lineNumber;
	for (var i=1;i<ruleGroup.length;i++)
	{
		var rule=ruleGroup[i];
		if (rule.lineNumber === firstLineNumber) // random [A | B] gets turned into 4 rules, skip
			continue;
		if (rule.randomRule)
		{
			logError("A rule-group can only be marked random by the first rule", rule.lineNumber);
		}
	}
}

function ruleGroupDiscardOverlappingTest(ruleGroup)
{
	// if (ruleGroup.length === 0) // TODO: as long as ruleGroupDiscardOverlappingTest is only called by arrangeRulesByGroupNumber{Aux}, this test cannot fail
	// 	return;
	var firstLineNumber = ruleGroup[0].lineNumber;
	var allbad = true;
	var example = null;
	for (var i=0; i<ruleGroup.length; i++)
	{
		var rule = ruleGroup[i];
		if (rule.hasOwnProperty('discard'))
		{
			example = rule['discard'];
			ruleGroup.splice(i,1);
			i--;
		} else {
			allbad = false;
		}
	}
	if (allbad)
	{
		logError(example[0] +' and '+example[1]+' can never overlap, but this rule requires that to happen.', firstLineNumber);
	}
}

function arrangeRulesByGroupNumberAux(target)
{
	var result = [];
	for (const groupNumber in target)
	{
		if (target.hasOwnProperty(groupNumber))
		{
			var ruleGroup = target[groupNumber];
			ruleGroupRandomnessTest(ruleGroup);
			ruleGroupDiscardOverlappingTest(ruleGroup);
			if (ruleGroup.length > 0)
			{
				result.push(ruleGroup);
			}
		}
	}
	return result;
}

function arrangeRulesByGroupNumber(state)
{
	var aggregates = {};
	var aggregates_late = {};
	for (const rule of state.rules)
	{
		var targetArray = rule.late ? aggregates_late : aggregates;

		if (targetArray[rule.groupNumber] == undefined)
		{
			targetArray[rule.groupNumber] = [];
		}
		targetArray[rule.groupNumber].push(rule);
	}

	const result = arrangeRulesByGroupNumberAux(aggregates);
	const result_late = arrangeRulesByGroupNumberAux(aggregates_late);

	state.rules = result;

	//check that there're no late movements with direction requirements on the lhs
	state.lateRules = result_late;
}


// TODO: can't this been checked much earlier? Also it would be better to list all the rules that have the issue...
function checkNoLateRulesHaveMoves(state)
{
	for (const lateGroup of state.lateRules)
	{
		for (const rule of lateGroup)
		{
			for (const cellRow_l of rule.patterns)
			{
				for (const cellPattern of cellRow_l)
				{
					if (cellPattern === ellipsisPattern)
						continue;

					var moveMissing = cellPattern.movementsMissing;
					var movePresent = cellPattern.movementsPresent;
					if (!moveMissing.iszero() || !movePresent.iszero())
					{
						logError("Movements cannot appear in late rules.", rule.lineNumber);
						return;
					}

					if (cellPattern.replacement != null)
					{
						var movementsClear = cellPattern.replacement.movementsClear;
						var movementsSet = cellPattern.replacement.movementsSet;

						if (!movementsClear.iszero() || !movementsSet.iszero())
						{
							logError("Movements cannot appear in late rules.",rule.lineNumber);
							return;
						}
					}				
				}
			}
		}
	}
}

function generateRigidGroupList(state)
{
	var rigidGroupIndex_to_GroupIndex = [];
	var groupIndex_to_RigidGroupIndex = [];
	var groupNumber_to_GroupIndex = [];
	var groupNumber_to_RigidGroupIndex = [];
	var rigidGroups = [];
	for (var i=0; i<state.rules.length; i++)
	{
		const ruleset = state.rules[i];
		const rigidFound = ruleset.some( rule => rule.isRigid );
		rigidGroups[i] = rigidFound;
		if (rigidFound)
		{
			var groupNumber = ruleset[0].groupNumber;
			groupNumber_to_GroupIndex[groupNumber] = i;
			var rigid_group_index = rigidGroupIndex_to_GroupIndex.length;
			groupIndex_to_RigidGroupIndex[i] = rigid_group_index;
			groupNumber_to_RigidGroupIndex[groupNumber] = rigid_group_index;
			rigidGroupIndex_to_GroupIndex.push(i);
		}
	}
	if (rigidGroupIndex_to_GroupIndex.length>30)
	{
		logError("There can't be more than 30 rigid groups (rule groups containing rigid members).", rules[0][0][3]);
	}

	state.rigidGroups = rigidGroups;
	state.rigidGroupIndex_to_GroupIndex = rigidGroupIndex_to_GroupIndex;
	state.groupNumber_to_RigidGroupIndex = groupNumber_to_RigidGroupIndex;
	state.groupIndex_to_RigidGroupIndex = groupIndex_to_RigidGroupIndex;
}




function makeMaskFromObjectSet(state, objects)
{
	return makeMaskFromGlyph( Array.from( objects, object_pos => state.objects[object_pos].id ) );
}


/* Computes new attributes for the state: playerMask, layerMasks, objectMask. */
function generateMasks(state)
{
	if (state.identifiers.indexOf('player') < 0)
	{
		logErrorNoLine("error, didn't find any object called player, either in the objects section, or the legends section. there must be a player!");
		state.playerMask = new BitVec(STRIDE_OBJ);
	}
	else
	{
		state.playerMask = makeMaskFromObjectSet(state, state.getObjectsAnIdentifierCanBe('player'));
	}

	state.layerMasks = state.collisionLayers.map( layer => makeMaskFromObjectSet(state, layer) )

//	Compute state.objectMasks

	var objectMask = state.identifiers_comptype.map(
		(type, identifier_index) => (type == identifier_type_aggregate) ? null : makeMaskFromObjectSet(state, state.getObjectsForIdentifier(identifier_index))
	);

	var all_obj = new BitVec(STRIDE_OBJ);
	all_obj.inot();
	objectMask.all = all_obj;

	state.objectMasks = objectMask;
}

function checkObjectsAreLayered(state)
{
	for (var o of state.objects)
	{
		if (o.layer === undefined)
		{
			logError('Object "' + o.name.toUpperCase() + '" has been defined, but not assigned to a layer.', state.identifiers_lineNumbers[o.identifier_index]);
		}
	}
}

function twiddleMetaData(state)
{
	var newmetadata = {};
	state.metadata_keys.forEach( function(key, i) { newmetadata[key] = state.metadata_values[i]; } )

	if (newmetadata.flickscreen !== undefined)
	{
		const coords = newmetadata.flickscreen.split('x');
		newmetadata.flickscreen = [parseInt(coords[0]), parseInt(coords[1])];
	}
	if (newmetadata.zoomscreen !== undefined)
	{
		const coords = newmetadata.zoomscreen.split('x');
		newmetadata.zoomscreen = [parseInt(coords[0]), parseInt(coords[1])];
	}

	state.metadata = newmetadata;	
}


function tokenizeWinConditionIdentifier(state, n, lineNumber)
{
	const identifier_index = state.checkKnownIdentifier(n);
	if (identifier_index < 0)
	{
		logError('Unknown object name "' + n +'" found in win condition.', lineNumber);
		return null;
	}
	const identifier_comptype = state.identifiers_comptype[identifier_index];
	if ( (identifier_comptype != identifier_type_property) && (identifier_comptype != identifier_type_object) ) // not a property, not an object
	{
		logError('Invalid object name found in win condition: ' + n + 'is ' + identifier_type_as_text[identifier_comptype] + ', but win conditions objects have to be objects or properties (defined using "or", in terms of other properties)', lineNumber);
		return null;
	}
	return state.objectMasks[identifier_index];
}

function processWinConditions(state)
{
//	[-1/0/1 (no,some,all),ob1,ob2] (ob2 is background by default)
	var newconditions = []; 
	for (const wincondition of state.winconditions)
	{
		if (wincondition.length == 0)
			return;

		const num = ({some:0, no:-1, all:1})[wincondition[0]]; // TODO: this tokenisation should be done in the parser, not here.

		const lineNumber = wincondition[wincondition.length-1];

		const mask1 = tokenizeWinConditionIdentifier( state, wincondition[1], lineNumber)
		const mask2 = (wincondition.length == 5) ? tokenizeWinConditionIdentifier( state, wincondition[3], lineNumber) : state.objectMasks.all;

		newconditions.push( [num, mask1, mask2, lineNumber] );
	}
	state.winconditions = newconditions;
}

function printCell(state, cell)
{
	var result = '';
	for (const [direction, identifier_index] of cell)
	{
		result += direction + " ";
		if (direction !== "...")
		{
			result += state.identifiers[identifier_index]+" ";
		}
	}
	return result;
}

function printCellRow(state, cellRow)
{
	return '[ ' + cellRow.map(c => printCell(state,c)).join('| ') + '] ';
	// var result = "[ ";
	// for (const [i, cell] of cellRow.entries())
	// {
	// 	if (i > 0)
	// 	{
	// 		result += "| ";
	// 	}
	// 	result += printCell(cellRow[i])
	// }
	// result +="] ";
	// return result;
}

function cacheRuleStringRep(state, rule)
{
	var result='('+makeLinkToLine(rule.lineNumber, rule.lineNumber)+') '+ rule.direction.toString().toUpperCase()+ ' ';
	if (rule.rigid) {
		result = "RIGID "+result+" ";
	}
	if (rule.randomRule) {
		result = "RANDOM "+result+" ";
	}
	if (rule.late) {
		result = "LATE "+result+" ";
	}
	for (const cellRow of rule.lhs) {
		result = result + printCellRow(state, cellRow);
	}
	result = result + "-> ";
	for (const cellRow of rule.rhs) {
		result = result + printCellRow(state, cellRow);
	}
	for (const command of rule.commands)
	{
		if (command.length===1) {
			result = result + command[0].toString();
		} else {
			result = result + '('+command[0].toString()+", "+command[1].toString()+') ';			
		}
	}
	//print commands next
	rule.stringRep = result;
}

function cacheAllRuleNames(state)
{
	for (const rule of state.rules)
	{
		cacheRuleStringRep(state, rule);
	}
}

function printRules(state) {
	var output = "";
	var loopIndex = 0;
	var loopEnd = -1;
	var discardcount = 0;
	for (var i=0;i<state.rules.length;i++) {
		var rule = state.rules[i];
		if (loopIndex < state.loops.length) {
			if (state.loops[loopIndex][0] < rule.lineNumber) {
				output += "STARTLOOP<br>";
				loopIndex++;
				if (loopIndex < state.loops.length) { // don't die with mismatched loops
					loopEnd = state.loops[loopIndex][0];
					loopIndex++;
				}
			}
		}
		if (loopEnd !== -1 && loopEnd < rule.lineNumber) {
			output += "ENDLOOP<br>";
			loopEnd = -1;
		}
		if (rule.hasOwnProperty('discard'))
		{
			discardcount++;
		} else {
			output += rule.stringRep +"<br>";
 		}
	}
	if (loopEnd !== -1) {	// no more rules after loop end
		output += "ENDLOOP<br>";
	}
	output+="===========<br>";
	output= "<br>Rule Assembly : ("+ (state.rules.length-discardcount) +" rules)<br>===========<br>"+output;
	consolePrint(output);
}

function removeDuplicateRules(state)
{
	var record = {};
	var newrules = [];
	var lastgroupnumber = -1;
	for (var i=state.rules.length-1; i>=0; i--)
	{
		var r = state.rules[i];
		var groupnumber = r.groupNumber;
		if (groupnumber !== lastgroupnumber)
		{
			record = {};
		}
		var r_string = r.stringRep;
		if (record.hasOwnProperty(r_string))
		{
			state.rules.splice(i,1);
		} else {
			record[r_string] = true;
		}
		lastgroupnumber=groupnumber;
	}
}

function generateLoopPoints(state)
{
	if (state.loops.length % 2 === 1)
	{
		logErrorNoLine("have to have matching number of  'startLoop' and 'endLoop' loop points.");
	}

	var loopPointIndex = 0;
	var source = 0;
	var target = 0;

	// TODO: we're doing this twice -> make an auxillary function.
	var loopPoint = {};
	var outside = true;
	for (const loop of state.loops)
	{
		for (const [i, ruleGroup] of state.rules.entries())
		{
			if (ruleGroup[0].lineNumber < loop[0])
				continue;

			if (outside)
			{
				target = i;
			}
			else
			{
				source = i-1;
				loopPoint[source] = target;
			}
			if (loop[1] === (outside ? -1 : 1) )
			{
				logErrorNoLine("Need to have matching number of 'startLoop' and 'endLoop' loop points.");
			}
			outside = ! outside;
			break;
		}
	}
	if (outside === false)
	{
		var source = state.rules.length;
		loopPoint[source] = target;
	}
	state.loopPoint = loopPoint;

	loopPoint = {};
	outside = true;
	for (const loop of state.loops)
	{
		for (const [i, ruleGroup] of state.lateRules.entries())
		{
			if (ruleGroup[0].lineNumber < loop[0])
				continue;

			if (outside)
			{
				target = i;
			}
			else
			{
				source = i-1;
				loopPoint[source] = target;
			}
			if (loop[1] === (outside ? -1 : 1) )
			{
				logErrorNoLine("Need to have matching number of 'startLoop' and 'endLoop' loop points.");
			}
			outside = ! outside;
			break;
		}
	}
	if (outside === false)
	{
		var source = state.lateRules.length;
		loopPoint[source] = target;
	}
	state.lateLoopPoint=loopPoint;
}

var soundEvents = ["titlescreen", "startgame", "cancel", "endgame", "startlevel","undo","restart","endlevel","showmessage","closemessage","sfx0","sfx1","sfx2","sfx3","sfx4","sfx5","sfx6","sfx7","sfx8","sfx9","sfx10"];
var soundMaskedEvents =["create","destroy","move","cantmove","action"];
var soundVerbs = soundEvents.concat(soundMaskedEvents);


function validSeed (seed ) {
	return /^\s*\d+\s*$/.exec(seed)!==null;
}


var soundDirectionIndicatorMasks = {
	'up'			: parseInt('00001', 2),
	'down'			: parseInt('00010', 2),
	'left'			: parseInt('00100', 2),
	'right'			: parseInt('01000', 2),
	'horizontal'	: parseInt('01100', 2),
	'vertical'		: parseInt('00011', 2),
	'orthogonal'	: parseInt('01111', 2),
	'___action____'		: parseInt('10000', 2)
};

var soundDirectionIndicators = ["up","down","left","right","horizontal","vertical","orthogonal","___action____"];


function generateSoundData(state)
{
	var sfx_Events = {};
	var sfx_CreationMasks = [];
	var sfx_DestructionMasks = [];
	var sfx_MovementMasks = [];
	var sfx_MovementFailureMasks = [];

	for (var sound of state.sounds)
	{
		if (sound.length <= 1)
			continue;

		var lineNumber = sound[sound.length-1];

		if (sound.length === 2)
		{
			logError('incorrect sound declaration.', lineNumber);
			continue;
		}

		if (soundEvents.indexOf(sound[0]) >= 0)
		{
			if (sound.length > 4)
			{
				logError("too much stuff to define a sound event.", lineNumber);
			}
			var seed = sound[1];
			if (validSeed(seed))
			{
				if (sfx_Events[sound[0]] !== undefined) {
					logWarning(sound[0].toUpperCase()+" already declared.", lineNumber);
				} 
				sfx_Events[sound[0]] = sound[1];
			} else {
				logError("Expecting sfx data, instead found \""+sound[1]+"\".", lineNumber);
			}
		}
		else
		{
			var target = sound[0].trim();
			var verb = sound[1].trim();
			var directions = sound.slice(2, sound.length-2);
			if (directions.length > 0 && (verb !== 'move' && verb !== 'cantmove'))
			{
				logError('incorrect sound declaration.', lineNumber);
			}

			if (verb === 'action')
			{
				verb = 'move';
				directions = ['___action____'];
			}

			if (directions.length == 0)
			{
				directions = ["orthogonal"];
			}
			var seed = sound[sound.length-2];

			const target_index = state.checkKnownIdentifier(target);
			if (target_index<0)
			{
				// TODO: we have already checked in the parser that it is a known identifier, but we added the sound anyway.
				logError('Object "'+ target+'" not found.', lineNumber);
				continue;
			}
			if (state.identifiers_comptype[target_index] == identifier_type_aggregate)
			{
				logError('cannot assign sound events to aggregate objects (declared with "and"), only to regular objects, or properties, things defined in terms of "or" ("'+target+'").', lineNumber);
				continue;
			}
			if ( [identifier_type_tag, identifier_type_tagset].includes(state.identifiers_comptype[target_index]) )
			{
				logError('cannot assign sound events to tags, only to regular objects, or properties, things defined in terms of "or" ("'+target+'").', lineNumber);
				continue;
			}

			var objectMask = state.objectMasks[target_index];

			var directionMask = 0;
			for (var j=0; j<directions.length; j++)
			{
				directions[j] = directions[j].trim();
				var direction = directions[j];
				if (soundDirectionIndicators.indexOf(direction) === -1) {
					logError('Was expecting a direction, instead found "'+direction+'".', lineNumber);
				} else {
					var soundDirectionMask = soundDirectionIndicatorMasks[direction];
					directionMask |= soundDirectionMask;
				}
			}

			const targets = Array.from( state.getObjectsForIdentifier(target_index), object_index => state.objects[object_index] );

			if (verb === 'move' || verb === 'cantmove')
			{
				for (var targetDat of targets)
				{
					const targetLayer = targetDat.layer;
					const shiftedDirectionMask = new BitVec(STRIDE_MOV);
					shiftedDirectionMask.ishiftor(directionMask, 5*targetLayer);

					const o = {
						objectMask: objectMask,
						directionMask: shiftedDirectionMask,
						seed: seed
					};

					if (verb==='move') {
						sfx_MovementMasks.push(o);						
					} else {
						sfx_MovementFailureMasks.push(o);
					}
				}
			}


			if (!validSeed(seed)) {
				logError("Expecting sfx data, instead found \""+seed+"\".",lineNumber);	
			}

			switch (verb)
			{
				case "create": {
					sfx_CreationMasks.push({
						objectMask: objectMask,
						seed: seed
					});
					break;
				}
				case "destroy": {
					sfx_DestructionMasks.push({
						objectMask: objectMask,
						seed: seed
					});
					break;
				}
			}
		}
	}

	state.sfx_Events = sfx_Events;
	state.sfx_CreationMasks = sfx_CreationMasks;
	state.sfx_DestructionMasks = sfx_DestructionMasks;
	state.sfx_MovementMasks = sfx_MovementMasks;
	state.sfx_MovementFailureMasks = sfx_MovementFailureMasks;
}


function formatHomePage(state)
{
	if ('background_color' in state.metadata) {
		state.bgcolor=colorToHex(colorPalette,state.metadata.background_color);
	} else {
		state.bgcolor="#000000";
	}
	if ('text_color' in state.metadata) {
		state.fgcolor=colorToHex(colorPalette,state.metadata.text_color);
	} else {
		state.fgcolor="#FFFFFF";
	}
	
	if (isColor(state.fgcolor)===false ){
		logError("text_color in incorrect format - found "+state.fgcolor+", but I expect a color name (like 'pink') or hex-formatted color (like '#1412FA').  Defaulting to white.")
		state.fgcolor="#FFFFFF";
	}
	if (isColor(state.bgcolor)===false ){
		logError("background_color in incorrect format - found "+state.bgcolor+", but I expect a color name (like 'pink') or hex-formatted color (like '#1412FA').  Defaulting to black.")
		state.bgcolor="#000000";
	}

	if (canSetHTMLColors) {
		
		if ('background_color' in state.metadata)  {
			document.body.style.backgroundColor=state.bgcolor;
		}
		
		if ('text_color' in state.metadata) {
			var separator = document.getElementById("separator");
			if (separator!=null) {
			   separator.style.color = state.fgcolor;
			}
			
			var h1Elements = document.getElementsByTagName("a");
			for(var i = 0; i < h1Elements.length; i++) {
			   h1Elements[i].style.color = state.fgcolor;
			}

			var h1Elements = document.getElementsByTagName("h1");
			for(var i = 0; i < h1Elements.length; i++) {
			   h1Elements[i].style.color = state.fgcolor;
			}
		}
	}

	if ('homepage' in state.metadata) {
		var url = state.metadata['homepage'];
		url=url.replace("http://","");
		url=url.replace("https://","");
		state.metadata['homepage']=url;
	}
}

var MAX_ERRORS=5;
function loadFile(str)
{

//	Parse the file	
	var state = new PuzzleScriptParser()

	const lines = str.split('\n');
	for (const [i, line] of lines.entries())
	{
	//	Parse the line
		state.lineNumber = i + 1;
		var ss = new CodeMirror.StringStream(line, 4); // note that we use the CodeMirror API to parse the file, here, but we don't have to
		do
		{
			state.token(ss)
			if (errorCount>MAX_ERRORS)
			{
				consolePrint("too many errors, aborting compilation");
				return;
			}
		}		
		while (ss.eol() === false);
	}

	delete state.lineNumber;

	twiddleMetaData(state);

	generateExtraMembers(state);
	generateMasks(state);
	levelsToArray(state);
	rulesToArray(state);

	cacheAllRuleNames(state);

	removeDuplicateRules(state);

	rulesToMask(state);

	
	if (debugMode)
	{
		printRules(state);
	}

	arrangeRulesByGroupNumber(state);
	collapseRules(state.rules);
	collapseRules(state.lateRules);

	checkNoLateRulesHaveMoves(state);

	generateRigidGroupList(state);

	processWinConditions(state);
	checkObjectsAreLayered(state);

	generateLoopPoints(state);

	generateSoundData(state);

	formatHomePage(state);

	delete state.commentLevel;
	delete state.abbrevNames;
	delete state.current_identifier_index;
	delete state.objects_section;
	delete state.objects_spritematrix;
	delete state.section;
	delete state.tokenIndex;
	delete state.visitedSections;
	delete state.loops;
	/*
	var lines = stripComments(str);
	window.console.log(lines);
	var sections = generateSections(lines);
	window.console.log(sections);
	var sss = generateSemiStructuredSections(sections);*/
	return state;
}

var ifrm;
function compile(command,text,randomseed) {
	matchCache={};
	forceRegenImages=true;
	if (command===undefined) {
		command = ["restart"];
	}
	if (randomseed===undefined) {
		randomseed = null;
	}
	lastDownTarget=canvas;	

	if (text===undefined){
		var code = window.form1.code;

		var editor = code.editorreference;

		text = editor.getValue()+"\n";
	}
	if (canDump===true) {
		compiledText=text;
	}

	errorCount = 0;
	compiling = true;
	errorStrings = [];
	consolePrint('=================================');
	try
	{
		var state = loadFile(text);
//		consolePrint(JSON.stringify(state));
	} finally {
		compiling = false;
	}

	if (state && state.levels && state.levels.length===0){	
		logError('No levels found.  Add some levels!',undefined,true);
	}

	if (errorCount>MAX_ERRORS) {
		return;
	}
	/*catch(err)
	{
		if (anyErrors===false) {
			logErrorNoLine(err.toString());
		}
	}*/

	if (errorCount>0) {
		consoleError('<span class="systemMessage">Errors detected during compilation; the game may not work correctly.</span>');
	}
	else {
		var ruleCount=0;
		for (const rule of state.rules) {
			ruleCount += rule.length;
		}
		for (const rule of state.lateRules) {
			ruleCount += rule.length;
		}
		if (command[0]=="restart") {
			consolePrint('<span class="systemMessage">Successful Compilation, generated ' + ruleCount + ' instructions.</span>');
		} else {
			consolePrint('<span class="systemMessage">Successful live recompilation, generated ' + ruleCount + ' instructions.</span>');

		}
	}
	setGameState(state,command,randomseed);

	clearInputHistory();

	consoleCacheDump();
}



function qualifyURL(url) {
	var a = document.createElement('a');
	a.href = url;
	return a.href;
}
