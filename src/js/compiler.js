'use strict';

/* TODO REFACTORING
- idDict is likely not needed, unless the fact it's sorted by layers is important.
   -> it is used in debug.js where it is not important because the identifiers are then sorted by name)
      That appart, it is only used in engine_base.js/getLayersOfMask where it is used to get the object matching a given bit in the mask returned by Level.getCell,
      which is the same use as in debug.js. Indeed, level cells are created in levelFromString here, using the order of bits defined in glyphDict.
      -> for now, changed to contain identifier_indexes rather than names.
- The following lists are indexed by identifiers and we want to index them instead by identifier_indexes:
   - state.glyphDict -> also, why do we have that thing contain a different kind of mask than bitvec?
                        also, we want the bits in these masks to be in the order of objects in state.objects rather than in the order of idDict?
                     -> it is now only used in graphics.js/generateGlyphImages & glyphCount (just to know what sprites should be created, and the ordering of bits does not matter),
                        and in inputoutput.js/printLevel and levelEditorClick (where it is used to generate a mask with the same method as state.objectMasks)
   - state.objectMasks
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

function makeMaskFromObjectSet(state, objects)
{
	var mask = new BitVec(STRIDE_OBJ);
	for (const object_pos of objects)
	{
		mask.ibitset(state.objects[object_pos].id);
	}
	return mask;
}

function getMaskFromName(state, name)
{
	return makeMaskFromObjectSet(state, state.getObjectsAnIdentifierCanBe(name));
}


PuzzleScriptParser.prototype.getObjectByName = function (name)
{
	const identifier_index = this.identifiers.indexOf(name);
	return (identifier_index < 0) ? null : this.objects[ this.identifiers_comptype[identifier_index] ];
}


function isSynonym(state, name)
{
	const index = state.identifiers.indexOf(name);
	return ( (index >= 0) && (state.identifiers_comptype[index] === identifier_type_synonym) );
}

function isAggregate(state, name)
{
	const index = state.identifiers.indexOf(name);
	return ( (index >= 0) && (state.identifiers_comptype[index] === identifier_type_aggregate) );
}

function isProperty(state, name)
{
	const index = state.identifiers.indexOf(name);
	return ( (index >= 0) && (state.identifiers_comptype[index] === identifier_type_property) );
}



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
		const val = state.metadata.color_palette
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
			logError("a sprite cannot have more than 10 colors.  Why you would want more than 10 is beyond me.", o.lineNumber+1); // TODO: Seriously??? Just remind that the bitmap definition uses digits for colors, which limits them to ten -- ClementSparrow
		}
		for (var i=0; i<o.colors.length; i++)
		{
			var c = o.colors[i];
			if (isColor(c))
			{
				c = colorToHex(colorPalette,c);
				o.colors[i] = c;
			} else {
				logError('Invalid color specified for object "' + o.name + '", namely "' + c + '".', o.lineNumber + 1);
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
			logError('color not specified for object "' + o.name +'".', o.lineNumber);
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
				logWarning("Sprite graphics must be 5 wide and 5 high exactly.", o.lineNumber);
			}
			o.spritematrix = generateSpriteMatrix(o.spritematrix);
		}
	}


	//calculate glyph dictionary
	var glyphDict = {};
	for (const [identifier_index, identifier] of state.identifiers.entries())
	{
		var mask = blankMask.concat([]);
		for (const object_pos of state.getObjectsForIdentifier(identifier_index))
		{
			const o = state.objects[object_pos];
			mask[o.layer] = o.id;
		}
		glyphDict[identifier] = mask;
	}
	state.glyphDict = glyphDict;

	/* determine which properties specify objects all on one layer */
	state.single_layer_property = [...state.identifiers_comptype.entries()].map(
		function (i, comptype)
		{
			if (comptype != identifier_type_property)
				return -1
			const layers = new Set( [...state.getObjectsForIdentifier(i).map( j => state.objects[j].layer )] );
			return (layers.size == 1) ? layers.next().value : -1;
		}
	)

	if ( (state.idDict[0] === undefined) && (state.collisionLayers.length > 0))
	{
		logError('You need to have some objects defined');
	}

	//set default background object
	state.background_index = state.getObjectsAnIdentifierCanBe('background').values().next().value;
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
			var mask = state.glyphDict[ch];

			if (mask == undefined) // TODO: this should be checked in the parser
			{
				if (!isProperty(state, ch))
				{
					logError('Error, symbol "' + ch + '", used in map, not found.', level[0]+j);
				}
				else
				{
					logError('Error, symbol "' + ch + '" is defined using \'or\', and therefore ambiguous - it cannot be used in a map. Did you mean to define it in terms of \'and\'?', level[0]+j);							
				}

			}

			var maskint = new BitVec(STRIDE_OBJ);
			mask = mask.concat([]);
			for (const obj_id of mask)
			{
				if (obj_id >= 0)
				{
					maskint.ibitset(obj_id);
				}
			}
			for (var w = 0; w < STRIDE_OBJ; ++w) {
				o.objects[STRIDE_OBJ * (i * o.height + j) + w] = maskint.data[w];
			}
		}
	}

	var levelBackgroundMask = o.calcBackgroundMask(state);
	for (var i=0;i<o.n_tiles;i++)
	{
		var cell = o.getCell(i);
		if (!backgroundLayerMask.anyBitsInCommon(cell)) {
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



function directionalRule(rule) {
	for (var i=0;i<rule.lhs.length;i++) {
		var cellRow = rule.lhs[i];
		if (cellRow.length>1) {
			return true;
		}
		for (var j=0;j<cellRow.length;j++) {
			var cell = cellRow[j];
			for (var k=0;k<cell.length;k+=2) {
				if (relativeDirections.indexOf(cell[k])>=0) {
					return true;
				}
			}
		}
	}
	for (var i=0;i<rule.rhs.length;i++) {
		var cellRow = rule.rhs[i];
		if (cellRow.length>1) {
			return true;
		}
		for (var j=0;j<cellRow.length;j++) {
			var cell = cellRow[j];
			for (var k=0;k<cell.length;k+=2) {
				if (relativeDirections.indexOf(cell[k])>=0) {
					return true;
				}
			}
		}
	}
	return false;
}

function findIndexAfterToken(str,tokens,tokenIndex){
	str=str.toLowerCase();
	var curIndex=0;
	for (var i=0;i<=tokenIndex;i++){
		var token = tokens[i];
		curIndex=str.indexOf(token,curIndex)+token.length;
	}
	return curIndex;
}

// TODO: it actually parses the rule line, so it should be in the parser.
function processRuleString(rule, state, curRules) 
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
/*
	STATE
	0 - scanning for initial directions
	LHS
	1 - reading cell contents LHS
	2 - reading cell contents RHS
*/
	var parsestate = 0;
	var directions = [];

	var curcell = null; // [up, cat, down mouse]
	var curcellrow = []; // [  [up, cat]  [ down, mouse ] ]

	var incellrow = false;

	var appendGroup=false;
	var rhs = false;
	var lhs_cells = [];
	var rhs_cells = [];
	var late = false;
	var rigid = false;
	var groupNumber = lineNumber;
	var commands = [];
	var randomRule = false;

	if (tokens.length === 1)
	{
		if (tokens[0] === "startloop" )
		{
			rule_line = {
				bracket: 1
			}
			return rule_line;
		}
		else if (tokens[0] === "endloop" )
		{
			rule_line = {
				bracket: -1
			}
			return rule_line;
		}
	}

	if (tokens.indexOf('->') == -1)
	{
		logError("A rule has to have an arrow in it.  There's no arrow here! Consider reading up about rules - you're clearly doing something weird", lineNumber);
	}

	var curcell = [];
	var bracketbalance = 0;
	for (var i = 0; i < tokens.length; i++)
	{
		var token = tokens[i];
		switch (parsestate)
		{
			case 0: {
				//read initial directions
				if (token === '+')
				{
					if (groupNumber === lineNumber)
					{
						if (curRules.length == 0)
						{
							logError('The "+" symbol, for joining a rule with the group of the previous rule, needs a previous rule to be applied to.');							
						}
						if (i !== 0)
						{
							logError('The "+" symbol, for joining a rule with the group of the previous rule, must be the first symbol on the line ');
						}						
						groupNumber = curRules[curRules.length-1].groupNumber;
					} else {
						logError('Two "+"s ("append to previous rule group" symbol) applied to the same rule.',lineNumber);
					}
				} else if (token in directionaggregates) {
					directions = directions.concat(directionaggregates[token]);						
				} else if (token==='late') {
						late=true;
				} else if (token==='rigid') {
					rigid=true;
				} else if (token==='random') {
					randomRule=true;
				} else if (simpleAbsoluteDirections.indexOf(token) >= 0) {
					directions.push(token);
				} else if (simpleRelativeDirections.indexOf(token) >= 0) {
					logError('You cannot use relative directions (\"^v<>\") to indicate in which direction(s) a rule applies.  Use absolute directions indicators (Up, Down, Left, Right, Horizontal, or Vertical, for instance), or, if you want the rule to apply in all four directions, do not specify directions', lineNumber);
				} else if (token == '[') {
					if (directions.length == 0) {
						directions = directions.concat(directionaggregates['orthogonal']);
					}
					parsestate = 1;
					i--;
				} else {
					logError("The start of a rule must consist of some number of directions (possibly 0), before the first bracket, specifying in what directions to look (with no direction specified, it applies in all four directions).  It seems you've just entered \"" + token.toUpperCase() + '\".', lineNumber);
				}
				break;
			}
			case 1: {
				if (token == '[') {
					bracketbalance++;
					if(bracketbalance>1){
						logWarning("Multiple opening brackets without closing brackets.  Something fishy here.  Every '[' has to be closed by a ']', and you can't nest them.", lineNumber);
					}
					if (curcell.length > 0) {
						logError('Error, malformed cell rule - encountered a "["" before previous bracket was closed', lineNumber);
					}
					incellrow = true;
					curcell = [];
				} else if (reg_directions_only.exec(token)) {
					if (curcell.length % 2 == 1) {
						logError("Error, an item can only have one direction/action at a time, but you're looking for several at once!", lineNumber);
					} else if (!incellrow) {
						logWarning("Invalid syntax. Directions should be placed at the start of a rule.", lineNumber);
					} else {
						curcell.push(token);
					}
				} else if (token == '|') {
					if (curcell.length % 2 == 1) {
						logError('In a rule, if you specify a force, it has to act on an object.', lineNumber);
					} else {
						curcellrow.push(curcell);
						curcell = [];
					}
				} else if (token === ']') {
					
					bracketbalance--;
					if(bracketbalance<0){
						logWarning("Multiple closing brackets without corresponding opening brackets.  Something fishy here.  Every '[' has to be closed by a ']', and you can't nest them.", lineNumber);
					}

					if (curcell.length % 2 == 1) {
						if (curcell[0]==='...') {
							logError('Cannot end a rule with ellipses.', lineNumber);
						} else {
							logError('In a rule, if you specify a force, it has to act on an object.', lineNumber);
						}
					} else {
						curcellrow.push(curcell);
						curcell = [];
					}

					if (rhs) {
						rhs_cells.push(curcellrow);
					} else {
						lhs_cells.push(curcellrow);
					}
					curcellrow = [];
					incellrow = false;
				} else if (token === '->') {
					if (rhs) {
						logError('Error, you can only use "->" once in a rule; it\'s used to separate before and after states.', lineNumber);
					} if (curcellrow.length > 0) {
						logError('Encountered an unexpected "->" inside square brackets.  It\'s used to separate states, it has no place inside them >:| .', lineNumber);
					} else {
						rhs = true;
					}
				} else if (state.identifiers.indexOf(token) >= 0) {
					if (!incellrow) {
						logWarning("Invalid token "+token.toUpperCase() +". Object names should only be used within cells (square brackets).", lineNumber);
					}
					else if (curcell.length % 2 == 0) {
						curcell.push('');
						curcell.push(token);
					} else if (curcell.length % 2 == 1) {
						curcell.push(token);
					}
				} else if (token==='...') {
					if (!incellrow) {
						logWarning("Invalid syntax, ellipses should only be used within cells (square brackets).", lineNumber);
					} else {
						curcell.push(token);
						curcell.push(token);
					}
				} else if (commandwords.indexOf(token)>=0) {
					if (rhs===false) {
						logError("Commands cannot appear on the left-hand side of the arrow.",lineNumber);
					}
					if (token==='message') {
						var messageIndex = findIndexAfterToken(origLine,tokens,i);
						var messageStr = origLine.substring(messageIndex).trim();
						if (messageStr===""){
							messageStr=" ";
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
			}

		}
	}

	if (lhs_cells.length != rhs_cells.length) {
		if (commands.length>0&&rhs_cells.length==0) {
			//ok
		} else {
			logError('Error, when specifying a rule, the number of matches (square bracketed bits) on the left hand side of the arrow must equal the number on the right', lineNumber);
		}
	} else {
		for (var i = 0; i < lhs_cells.length; i++) {
			if (lhs_cells[i].length != rhs_cells[i].length) {
				logError('In a rule, each pattern to match on the left must have a corresponding pattern on the right of equal length (number of cells).', lineNumber);
			}
			if (lhs_cells[i].length == 0) {
				logError("You have an totally empty pattern on the left-hand side.  This will match *everything*.  You certainly don't want this.");
			}
		}
	}

	if (lhs_cells.length == 0) {
		logError('This rule refers to nothing.  What the heck? :O', lineNumber);
	}

	var rule_line = {
		directions: directions,
		lhs: lhs_cells,
		rhs: rhs_cells,
		lineNumber: lineNumber,
		late: late,
		rigid: rigid,
		groupNumber: groupNumber,
		commands: commands,
		randomRule: randomRule
	};

	if (directionalRule(rule_line)===false) {
		rule_line.directions=['up'];
	}

	/* reset must appear by itself */

	for (var i=0;i<commands.length;i++) {
		var cmd = commands[i][0];
		if (cmd==='restart') {
			if (commands.length>1 || rhs_cells.length>0) {
				logError('The RESTART command can only appear by itself on the right hand side of the arrow.', lineNumber);
			}
		} else if (cmd==='cancel') {
			if (commands.length>1 || rhs_cells.length>0) {
				logError('The CANCEL command can only appear by itself on the right hand side of the arrow.', lineNumber);
			}
		}
	}

	//next up - replace relative directions with absolute direction

	return rule_line;
}

function deepCloneCellRow(cellrow)
{
	return cellrow.map(
		deepArr =>  deepArr.map( i => i )
	);
}

function deepCloneHS(HS)
{
	return HS.map( deepCloneCellRow );
}

function deepCloneRule(rule)
{
	var clonedRule = {
		direction: rule.direction,
		lhs: deepCloneHS(rule.lhs),
		rhs: deepCloneHS(rule.rhs),
		lineNumber: rule.lineNumber,
		late: rule.late,
		rigid: rule.rigid,
		groupNumber: rule.groupNumber,
		commands:rule.commands,
		randomRule:rule.randomRule
	};
	return clonedRule;
}

function rulesToArray(state)
{
	var oldrules = state.rules;
	var rules = [];
	var loops=[];
	for (const oldrule of oldrules)
	{
		var lineNumber = oldrule[1];
		var newrule = processRuleString(oldrule, state, rules);
		if (newrule.bracket !== undefined)
		{
			loops.push( [lineNumber, newrule.bracket] );
			continue;
		}
		rules.push(newrule);
	}
	state.loops=loops;

	//now expand out rules with multiple directions
	var rules2 = [];
	for (var i = 0; i < rules.length; i++)
	{
		var rule = rules[i];
		var ruledirs = rule.directions;
		for (var j = 0; j < ruledirs.length; j++) {
			var dir = ruledirs[j];
			if (dir in directionaggregates && directionalRule(rule)) {
				var dirs = directionaggregates[dir];
				for (var k = 0; k < dirs.length; k++) {
					var modifiedrule = deepCloneRule(rule);
					modifiedrule.direction = dirs[k];
					rules2.push(modifiedrule);
				}
			} else {
				var modifiedrule = deepCloneRule(rule);
				modifiedrule.direction = dir;
				rules2.push(modifiedrule);
			}
		}
	}

	for (const rule of rules2)
	{
		//remove relative directions
		convertRelativeDirsToAbsolute(rule);
		//optional: replace up/left rules with their down/right equivalents
		rewriteUpLeftRules(rule);
		//replace aggregates with what they mean
		atomizeAggregates(state, rule);
		//replace synonyms with what they mean
		rephraseSynonyms(state, rule);
	}

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

function containsEllipsis(rule) {
	for (var i=0;i<rule.lhs.length;i++) {
		for (var j=0;j<rule.lhs[i].length;j++) {
			if (rule.lhs[i][j][1]==='...')
				return true;
		}
	}
	return false;
}

function rewriteUpLeftRules(rule) {
	if (containsEllipsis(rule)) {
		return;
	}

	if (rule.direction == 'up') {
		rule.direction = 'down';
	} else if (rule.direction == 'left') {
		rule.direction = 'right';
	} else {
		return;
	}

	for (var i = 0; i < rule.lhs.length; i++) {
		rule.lhs[i].reverse();
		if (rule.rhs.length>0) {
			rule.rhs[i].reverse();
		}
	}
}

function getPropertiesFromCell(state,cell ) {
	var result = [];
	for (var j = 0; j < cell.length; j += 2) {
		var dir = cell[j];
		var name = cell[j+1];
		if (dir=="random") {
			continue;
		}
		if (isProperty(state, name))
		{
			result.push(name);
		}
	}
	return result;
}

//returns you a list of object names in that cell that're moving
function getMovings(state,cell ) {
	var result = [];
	for (var j = 0; j < cell.length; j += 2) {
		var dir = cell[j];
		var name = cell[j+1];
		if (dir in directionaggregates) {
			result.push([name,dir]);
		}
	}
	return result;
}

function concretizePropertyInCell(cell ,property, concreteType) {
	for (var j = 0; j < cell.length; j += 2) {
		if (cell[j+1] === property && cell[j]!=="random") {
			cell[j+1] = concreteType;
		}
	}
}

function concretizeMovingInCell(cell , ambiguousMovement, nameToMove, concreteDirection) {
	for (var j = 0; j < cell.length; j += 2) {
		if (cell[j]===ambiguousMovement && cell[j+1] === nameToMove) {
			cell[j] = concreteDirection;
		}
	}
}

function concretizeMovingInCellByAmbiguousMovementName(cell ,ambiguousMovement, concreteDirection) {
	for (var j = 0; j < cell.length; j += 2) {
		if (cell[j] === ambiguousMovement) {
			cell[j] = concreteDirection;
		}
	}
}

function expandNoPrefixedProperties(state, cell)
{
	var expanded = [];
	for (var i=0; i<cell.length; i+=2)
	{
		var dir = cell[i];
		var name = cell[i+1];

		if (dir === 'no' && isProperty(state, name))
		{
			for (const alias of state.getObjectsAnIdentifierCanBe(name))
			{
				expanded.push(dir);
				expanded.push(state.objects[alias].name);
			}
		}
		else
		{
			expanded.push(dir);
			expanded.push(name);
		} 
	}
	return expanded;
}

function concretizePropertyRule(state, rule, lineNumber)
{	
	//step 1, rephrase rule to change "no flying" to "no cat no bat"
	for (var i = 0; i < rule.lhs.length; i++) {
		var cur_cellrow_l = rule.lhs[i];
		for (var j=0;j<cur_cellrow_l.length;j++) {
			cur_cellrow_l[j] = expandNoPrefixedProperties(state,cur_cellrow_l[j]);
			if (rule.rhs.length > 0)
				rule.rhs[i][j] = expandNoPrefixedProperties(state,rule.rhs[i][j]);
		}
	}

	//are there any properties we could avoid processing?
	// e.g. [> player | movable] -> [> player | > movable],
	// 		doesn't need to be split up (assuming single-layer player/block aggregates)

	// we can't manage this if they're being used to disambiguate
	var ambiguousProperties = {};

	for (var j = 0; j < rule.rhs.length; j++) {
		var row_l = rule.lhs[j];
		var row_r = rule.rhs[j];
		for (var k = 0; k < row_r.length; k++) {
			var properties_l = getPropertiesFromCell(state, row_l[k]);
			var properties_r = getPropertiesFromCell(state, row_r[k]);
			for (var prop_n = 0; prop_n < properties_r.length; prop_n++) {
				var property = properties_r[prop_n];
				if (properties_l.indexOf(property) == -1) {
					ambiguousProperties[property] = true;
				}
			}
		}
	}

	var shouldremove;
	var result = [rule];
	var modified=true;
	while (modified) {
		modified = false;
		for (var i = 0; i < result.length; i++) {
			//only need to iterate through lhs
			var cur_rule = result[i];
			shouldremove = false;
			for (var j = 0; j < cur_rule.lhs.length&&!shouldremove; j++) {
				var cur_rulerow = cur_rule.lhs[j];
				for (var k = 0; k < cur_rulerow.length&&!shouldremove; k++) {
					var cur_cell = cur_rulerow[k];
					var properties = getPropertiesFromCell(state, cur_cell);
					for (var prop_n = 0; prop_n < properties.length; ++prop_n) {
						var property = properties[prop_n];

						if ( (state.single_layer_property[state.identifiers.indexOf(property)] >= 0) &&
							ambiguousProperties[property] !== true) {
							// we don't need to explode this property
							continue;
						}

						var aliases = Array.from(state.getObjectsAnIdentifierCanBe(property)).map( p => state.objects[p].name );

						shouldremove = true;
						modified = true;

						//just do the base property, let future iterations take care of the others

						for (var l = 0; l < aliases.length; l++) {
							var concreteType = aliases[l];
							var newrule = deepCloneRule(cur_rule);
							newrule.propertyReplacement={};
							for(var prop in cur_rule.propertyReplacement) {
								if (cur_rule.propertyReplacement.hasOwnProperty(prop)) {
									var propDat = cur_rule.propertyReplacement[prop];
									newrule.propertyReplacement[prop] = [propDat[0],propDat[1]];
								}
							}

							concretizePropertyInCell(newrule.lhs[j][k], property, concreteType);
							if (newrule.rhs.length>0) {
								concretizePropertyInCell(newrule.rhs[j][k], property, concreteType);//do for the corresponding rhs cell as well
							}
							
							if (newrule.propertyReplacement[property]===undefined) {
								newrule.propertyReplacement[property]=[concreteType,1];
							} else {
								newrule.propertyReplacement[property][1]=newrule.propertyReplacement[property][1]+1;                                
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

	
	for (var i = 0; i < result.length; i++) {
		//for each rule
		var cur_rule = result[i];
		if (cur_rule.propertyReplacement===undefined) {
			continue;
		}
		
		//for each property replacement in that rule
		for (var property in cur_rule.propertyReplacement) {
			if (cur_rule.propertyReplacement.hasOwnProperty(property)) {
				var replacementInfo = cur_rule.propertyReplacement[property];
				var concreteType = replacementInfo[0];
				var occurrenceCount = replacementInfo[1];
				if (occurrenceCount===1) {
					//do the replacement
					for (var j=0;j<cur_rule.rhs.length;j++) {
						var cellRow_rhs = cur_rule.rhs[j];
						for (var k=0;k<cellRow_rhs.length;k++) {
							var cell=cellRow_rhs[k];
							concretizePropertyInCell(cell, property, concreteType);
						}
					}
				}
			}
		}
	}

	//if any properties remain on the RHSes, bleep loudly
	var rhsPropertyRemains = '';
	for (var i = 0; i < result.length; i++) {
		var cur_rule = result[i];
		delete result.propertyReplacement;
		for (var j = 0; j < cur_rule.rhs.length; j++) {
			var cur_rulerow = cur_rule.rhs[j];
			for (var k = 0; k < cur_rulerow.length; k++) {
				var cur_cell = cur_rulerow[k];
				var properties = getPropertiesFromCell(state, cur_cell);
				for (var prop_n = 0; prop_n < properties.length; prop_n++) {
					if (ambiguousProperties.hasOwnProperty(properties[prop_n])) {
						rhsPropertyRemains = properties[prop_n];
					}
				}
			}
		}
	}


	if (rhsPropertyRemains.length > 0) {
		logError('This rule has a property on the right-hand side, \"'+ rhsPropertyRemains.toUpperCase() + "\", that can't be inferred from the left-hand side.  (either for every property on the right there has to be a corresponding one on the left in the same cell, OR, if there's a single occurrence of a particular property name on the left, all properties of the same name on the right are assumed to be the same).",lineNumber);
	}

	return result;
}


function concretizeMovingRule(state, rule,lineNumber) {	

	var shouldremove;
	var result = [rule];
	var modified=true;
	while (modified) {
		modified = false;
		for (var i = 0; i < result.length; i++) {
			//only need to iterate through lhs
			var cur_rule = result[i];
			shouldremove = false;
			for (var j = 0; j < cur_rule.lhs.length; j++) {
				var cur_rulerow = cur_rule.lhs[j];
				for (var k = 0; k < cur_rulerow.length; k++) {
					var cur_cell = cur_rulerow[k];
					var movings = getMovings(state, cur_cell);
					if (movings.length > 0) {
						shouldremove = true;
						modified = true;

						//just do the base property, let future iterations take care of the others
						var cand_name = movings[0][0];
						var ambiguous_dir = movings[0][1];
						var concreteDirs = directionaggregates[ambiguous_dir];
						for (var l = 0; l < concreteDirs.length; l++) {
							var concreteDirection = concreteDirs[l];
							var newrule = deepCloneRule(cur_rule);

							newrule.movingReplacement={};
							for(var moveTerm in cur_rule.movingReplacement) {
								if (cur_rule.movingReplacement.hasOwnProperty(moveTerm)) {
									var moveDat = cur_rule.movingReplacement[moveTerm];
									newrule.movingReplacement[moveTerm] = [moveDat[0],moveDat[1],moveDat[2]];
								}
							}

							concretizeMovingInCell(newrule.lhs[j][k], ambiguous_dir, cand_name, concreteDirection);
							if (newrule.rhs.length>0) {
								concretizeMovingInCell(newrule.rhs[j][k], ambiguous_dir, cand_name, concreteDirection);//do for the corresponding rhs cell as well
							}
							
							if (newrule.movingReplacement[cand_name]===undefined) {
								newrule.movingReplacement[cand_name]=[concreteDirection,1,ambiguous_dir];
							} else {
								newrule.movingReplacement[cand_name][1]=newrule.movingReplacement[cand_name][1]+1;                                
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

	
	for (var i = 0; i < result.length; i++) {
		//for each rule
		var cur_rule = result[i];
		if (cur_rule.movingReplacement===undefined) {
			continue;
		}
		var ambiguous_movement_dict={};
		//strict first - matches movement direction to objects
		//for each property replacement in that rule
		for (var cand_name in cur_rule.movingReplacement) {
			if (cur_rule.movingReplacement.hasOwnProperty(cand_name)) {
				var replacementInfo = cur_rule.movingReplacement[cand_name];
				var concreteMovement = replacementInfo[0];
				var occurrenceCount = replacementInfo[1];
				var ambiguousMovement = replacementInfo[2];
				if ((ambiguousMovement in ambiguous_movement_dict) || (occurrenceCount!==1)) {
					ambiguous_movement_dict[ambiguousMovement] = "INVALID";
				} else {
					ambiguous_movement_dict[ambiguousMovement] = concreteMovement
				}

				if (occurrenceCount===1) {
					//do the replacement
					for (var j=0;j<cur_rule.rhs.length;j++) {
						var cellRow_rhs = cur_rule.rhs[j];
						for (var k=0;k<cellRow_rhs.length;k++) {
							var cell=cellRow_rhs[k];
							concretizeMovingInCell(cell, ambiguousMovement, cand_name, concreteMovement);
						}
					}
				}
			}
		}

		//for each ambiguous word, if there's a single ambiguous movement specified in the whole lhs, then replace that wholesale
		for(var ambiguousMovement in ambiguous_movement_dict) {
			if (ambiguous_movement_dict.hasOwnProperty(ambiguousMovement) && ambiguousMovement!=="INVALID") {
				concreteMovement = ambiguous_movement_dict[ambiguousMovement];
				if (concreteMovement==="INVALID"){
					continue;
				}
				for (var j=0;j<cur_rule.rhs.length;j++) {
					var cellRow_rhs = cur_rule.rhs[j];
					for (var k=0;k<cellRow_rhs.length;k++) {
						var cell=cellRow_rhs[k];
						concretizeMovingInCellByAmbiguousMovementName(cell, ambiguousMovement, concreteMovement);
					}
				}
			}
		}
	}

	//if any properties remain on the RHSes, bleep loudly
	var rhsAmbiguousMovementsRemain = '';
	for (var i = 0; i < result.length; i++) {
		var cur_rule = result[i];
		delete result.movingReplacement;
		for (var j = 0; j < cur_rule.rhs.length; j++) {
			var cur_rulerow = cur_rule.rhs[j];
			for (var k = 0; k < cur_rulerow.length; k++) {
				var cur_cell = cur_rulerow[k];
				var movings = getMovings(state, cur_cell);
				if (movings.length > 0) {
					rhsAmbiguousMovementsRemain = movings[0][1];					
				}
			}
		}
	}


	if (rhsAmbiguousMovementsRemain.length > 0) {
		logError('This rule has an ambiguous movement on the right-hand side, \"'+ rhsAmbiguousMovementsRemain + "\", that can't be inferred from the left-hand side.  (either for every ambiguous movement associated to an entity on the right there has to be a corresponding one on the left attached to the same entity, OR, if there's a single occurrence of a particular ambiguous movement on the left, all properties of the same movement attached to the same object on the right are assumed to be the same (or something like that)).",lineNumber);
	}

	return result;
}

function rephraseSynonyms(state,rule) {
	for (var i = 0; i < rule.lhs.length; i++) {
		var cellrow_l = rule.lhs[i];
		var cellrow_r = rule.rhs[i];
		for (var j = 0; j < cellrow_l.length; j++) {
			var cell_l = cellrow_l[j];
			for (var k = 1; k < cell_l.length; k += 2) {
				const name = cell_l[k];
				if (isSynonym(state, name))
				{
					cell_l[k] = state.getObjectsAnIdentifierCanBe(name).next().value;
				}
			}
			if (rule.rhs.length>0) {
				var cell_r = cellrow_r[j];
				for (var k = 1; k < cell_r.length; k += 2) {
					const name = cell_r[k];
					if (isSynonym(state, name))
					{
						cell_r[k] = state.getObjectsAnIdentifierCanBe(name).next().value;
					}
				}
			}
		}
	}
}

function atomizeAggregates(state, rule)
{
	for (const cellrow of rule.lhs)
	{
		for (const cell of cellrow)
		{
			atomizeCellAggregates(state, cell, rule.lineNumber);
		}
	}
	for (const cellrow of rule.rhs)
	{
		for (const cell of cellrow)
		{
			atomizeCellAggregates(state, cell, rule.lineNumber);
		}
	}
}

function atomizeCellAggregates(state, cell, lineNumber)
{
	for (var i = 0; i < cell.length; i += 2)
	{
		var dir = cell[i];
		var c = cell[i+1];
		if (isAggregate(state, c))
		{
			if (dir === 'no')
			{
				logError("You cannot use 'no' to exclude the aggregate object " +c.toUpperCase()+" (defined using 'AND'), only regular objects, or properties (objects defined using 'OR').  If you want to do this, you'll have to write it out yourself the long way.", lineNumber);
			}
			var equivs = state.getObjectsAnIdentifierCanBe(c).values().map( p => state.objects[p].name);
			cell[i+1] = equivs[0];
			for (var j= 1; j < equivs.length; j++) {
				cell.push(cell[i]);//push the direction
				cell.push(equivs[j]);
			}
		}
	}
}

function convertRelativeDirsToAbsolute(rule) {
	var forward = rule.direction;
	for (var i = 0; i < rule.lhs.length; i++) {
		var cellrow = rule.lhs[i];
		for (var j = 0; j < cellrow.length; j++) {
			var cell = cellrow[j];
			absolutifyRuleCell(forward, cell);
		}
	}
	for (var i = 0; i < rule.rhs.length; i++) {
		var cellrow = rule.rhs[i];
		for (var j = 0; j < cellrow.length; j++) {
			var cell = cellrow[j];
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

function absolutifyRuleCell(forward, cell) {
	for (var i = 0; i < cell.length; i += 2) {
		var c = cell[i];
		var index = relativeDirs.indexOf(c);
		if (index >= 0) {
			cell[i] = relativeDict[forward][index];		
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
		for (var k = 0; k < cellrow_l.length; k++)
		{
			var cell_l = cellrow_l[k];
			var layersUsed_l = layerTemplate.concat([]);
			var objectsPresent = new BitVec(STRIDE_OBJ);
			var objectsMissing = new BitVec(STRIDE_OBJ);
			var anyObjectsPresent = [];
			var movementsPresent = new BitVec(STRIDE_MOV);
			var movementsMissing = new BitVec(STRIDE_MOV);

			var objectlayers_l = new BitVec(STRIDE_MOV);
			for (var l = 0; l < cell_l.length; l += 2)
			{
				var object_dir = cell_l[l];
				if (object_dir === '...')
				{
					objectsPresent = ellipsisPattern;
					if (cell_l.length !== 2)
					{
						logError("You can't have anything in with an ellipsis. Sorry.", rule.lineNumber);
					}
					else if ( (k === 0) || (k === cellrow_l.length-1) )
					{
						logError("There's no point in putting an ellipsis at the very start or the end of a rule", rule.lineNumber);
					}
					else if (rule.rhs.length > 0)
					{
						var rhscell = cellrow_r[k];
						if (rhscell.length !==2 || rhscell[0] !== '...')
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

				var object_name = cell_l[l + 1];
				var object = state.getObjectByName(object_name); // TODO: we should store directly the object index in cell_l
				var objectMask = state.objectMasks[object_name];
				if (object)
				{
					var layerIndex = object.layer|0;
				}
				else
				{
					var layerIndex = state.single_layer_property[state.identifiers.indexOf(object_name)];
				}

				if (layerIndex < 0)
				{
					logError("Oops!  " +object_name.toUpperCase()+" not assigned to a layer.", rule.lineNumber);
				}

				if (object_dir === 'no')
				{
					objectsMissing.ior(objectMask);
				}
				else
				{
					var existingname = layersUsed_l[layerIndex];
					if (existingname !== null)
					{
						rule.discard = [object_name.toUpperCase(), existingname.toUpperCase()];
					}

					layersUsed_l[layerIndex] = object_name;

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
				for (var l=0; l<rhscell.length; l+=2)
				{
					var content = rhscell[l];
					if (content === '...')
					{
						if (rhscell.length !== 2)
						{
							logError("You can't have anything in with an ellipsis. Sorry.", rule.lineNumber);
						}
					}
				}
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
			for (var l = 0; l < cell_r.length; l += 2)
			{
				var object_dir = cell_r[l];
				var object_name = cell_r[l + 1];

				if (object_dir === '...')
				{
					//logError("spooky ellipsis found! (should never hit this)");
					break;
				}
				else if (object_dir === 'random')
				{
					if (object_name in state.objectMasks)
					{
						var mask = state.objectMasks[object_name];
						randomMask_r.ior(mask);
						var values;
						if (isProperty(state, object_name))
						{
							values = state.getObjectsAnIdentifierCanBe(object_name).values().map( p => state.objects[p].name );
						} else {
							values = [object_name];
						}
						for (const subobject of values)
						{
							var layerIndex = state.getObjectByName(subobject).layer|0; // TODO: we should store...
							var existingname = layersUsed_r[layerIndex];
							if (existingname !== null)
							{
								var o1 = subobject.toUpperCase();
								var o2 = existingname.toUpperCase();
								if (o1 !== o2)
								{
									logWarning("This rule may try to spawn a "+o1+" with random, but also requires a "+o2+" be here, which is on the same layer - they shouldn't be able to coexist!", rule.lineNumber); 									
								}
							}

							layersUsedRand_r[layerIndex] = subobject;
						}                      
					}
					else
					{
						logError('You want to spawn a random "'+object_name.toUpperCase()+'", but I don\'t know how to do that',rule.lineNumber);
					}
					continue;
				}

				var object = state.getObjectByName(object_name);
				var objectMask = state.objectMasks[object_name];
				if (object)
				{
					var layerIndex = object.layer|0;
				}
				else
				{
					var layerIndex = state.single_layer_property[state.identifiers.indexOf(object_name)]
				}
				
				if (object_dir == 'no')
				{
					objectsClear.ior(objectMask);
				}
				else
				{
					var existingname = layersUsed_r[layerIndex];
					if (existingname === null)
					{
						existingname = layersUsedRand_r[layerIndex];
					}

					if (existingname !== null)
					{
						if ( ! rule.hasOwnProperty('discard') )
						{
							logError('Rule matches object types that can\'t overlap: "' + object_name.toUpperCase() + '" and "' + existingname.toUpperCase() + '".',rule.lineNumber);
						}
					}

					layersUsed_r[layerIndex] = object_name;

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
					if (object_dir==='randomdir')
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

function collapseRules(groups) {
	for (var gn = 0; gn < groups.length; gn++) {
		var rules = groups[gn];
		for (var i = 0; i < rules.length; i++) {
			var oldrule = rules[i];
			var newrule = [0,[],oldrule.rhs.length>0,oldrule.lineNumber/*ellipses,group number,rigid,commands,randomrule,[cellrowmasks]*/];
			var ellipses = [];
			for (var j=0;j<oldrule.lhs.length;j++) {
				ellipses.push(false);
			}

			newrule[0]=dirMasks[oldrule.direction];
			for (var j = 0; j < oldrule.lhs.length; j++) {
				var cellrow_l = oldrule.lhs[j];
				for (var k = 0; k < cellrow_l.length; k++) {
					if (cellrow_l[k] === ellipsisPattern) {
						if (ellipses[j]) {
							logError("You can't use two ellipses in a single cell match pattern.  If you really want to, please implement it yourself and send me a patch :) ", oldrule.lineNumber);
						} 
						ellipses[j]=true;
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

function ruleGroupRandomnessTest(ruleGroup) {
	if (ruleGroup.length === 0)
		return;
	var firstLineNumber = ruleGroup[0].lineNumber;
	for (var i=1;i<ruleGroup.length;i++) {
		var rule=ruleGroup[i];
		if (rule.lineNumber === firstLineNumber) // random [A | B] gets turned into 4 rules, skip
			continue;
		if (rule.randomRule) {
			logError("A rule-group can only be marked random by the first rule", rule.lineNumber);
		}
	}
}

function ruleGroupDiscardOverlappingTest(ruleGroup){
	if (ruleGroup.length === 0)
		return;
	var firstLineNumber = ruleGroup[0].lineNumber;
	var allbad=true;
	var example=null;
	for (var i=0;i<ruleGroup.length;i++){
		var rule=ruleGroup[i];
		if (rule.hasOwnProperty('discard')){
			example=rule['discard'];
			ruleGroup.splice(i,1);
			i--;
		} else {
			allbad=false;
		}
	}
	if (allbad){
		logError(example[0] +' and '+example[1]+' can never overlap, but this rule requires that to happen.', firstLineNumber);
	}
}

function arrangeRulesByGroupNumber(state) {
	var aggregates = {};
	var aggregates_late = {};
	for (var i=0;i<state.rules.length;i++) {
		var rule = state.rules[i];
		var targetArray = aggregates;
		if (rule.late) {
			targetArray=aggregates_late;
		}

		if (targetArray[rule.groupNumber]==undefined) {
			targetArray[rule.groupNumber]=[];
		}
		targetArray[rule.groupNumber].push(rule);
	}

	var result=[];
	for (var groupNumber in aggregates) {
		if (aggregates.hasOwnProperty(groupNumber)) {
			var ruleGroup = aggregates[groupNumber];
			ruleGroupRandomnessTest(ruleGroup);
			ruleGroupDiscardOverlappingTest(ruleGroup);
			result.push(ruleGroup);
		}
	}
	var result_late=[];
	for (var groupNumber in aggregates_late) {
		if (aggregates_late.hasOwnProperty(groupNumber)) {
			var ruleGroup = aggregates_late[groupNumber];
			ruleGroupRandomnessTest(ruleGroup);
			ruleGroupDiscardOverlappingTest(ruleGroup);
			result_late.push(ruleGroup);
		}
	}
	state.rules=result;

	//check that there're no late movements with direction requirements on the lhs
	state.lateRules=result_late;
}


function checkNoLateRulesHaveMoves(state){
	for (var ruleGroupIndex=0;ruleGroupIndex<state.lateRules.length;ruleGroupIndex++) {
		var lateGroup = state.lateRules[ruleGroupIndex];
		for (var ruleIndex=0;ruleIndex<lateGroup.length;ruleIndex++) {
			var rule = lateGroup[ruleIndex];
			for (var cellRowIndex=0;cellRowIndex<rule.patterns.length;cellRowIndex++) {
				var cellRow_l = rule.patterns[cellRowIndex];
				for (var cellIndex=0;cellIndex<cellRow_l.length;cellIndex++) {
					var cellPattern = cellRow_l[cellIndex];
					if (cellPattern === ellipsisPattern) {
						continue;
					}
					var moveMissing = cellPattern.movementsMissing;
					var movePresent = cellPattern.movementsPresent;
					if (!moveMissing.iszero() || !movePresent.iszero()) {
						logError("Movements cannot appear in late rules.",rule.lineNumber);
						return;
					}

					if (cellPattern.replacement!=null) {
						var movementsClear = cellPattern.replacement.movementsClear;
						var movementsSet = cellPattern.replacement.movementsSet;

						if (!movementsClear.iszero() || !movementsSet.iszero()) {
							logError("Movements cannot appear in late rules.",rule.lineNumber);
							return;
						}
					}				
				}
			}
		}
	}
}

function generateRigidGroupList(state) {
	var rigidGroupIndex_to_GroupIndex=[];
	var groupIndex_to_RigidGroupIndex=[];
	var groupNumber_to_GroupIndex=[];
	var groupNumber_to_RigidGroupIndex=[];
	var rigidGroups=[];
	for (var i=0;i<state.rules.length;i++) {
		var ruleset=state.rules[i];
		var rigidFound=false;
		for (var j=0;j<ruleset.length;j++) {
			var rule=ruleset[j];
			if (rule.isRigid) {
				rigidFound=true;
			}
		}
		rigidGroups[i]=rigidFound;
		if (rigidFound) {
			var groupNumber=ruleset[0].groupNumber;
			groupNumber_to_GroupIndex[groupNumber]=i;
			var rigid_group_index = rigidGroupIndex_to_GroupIndex.length;
			groupIndex_to_RigidGroupIndex[i]=rigid_group_index;
			groupNumber_to_RigidGroupIndex[groupNumber]=rigid_group_index;
			rigidGroupIndex_to_GroupIndex.push(i);
		}
	}
	if (rigidGroupIndex_to_GroupIndex.length>30) {
		logError("There can't be more than 30 rigid groups (rule groups containing rigid members).",rules[0][0][3]);
	}

	state.rigidGroups=rigidGroups;
	state.rigidGroupIndex_to_GroupIndex=rigidGroupIndex_to_GroupIndex;
	state.groupNumber_to_RigidGroupIndex=groupNumber_to_RigidGroupIndex;
	state.groupIndex_to_RigidGroupIndex=groupIndex_to_RigidGroupIndex;
}


/* Computes new attributes for the state: playerMask, layerMasks, objectMask. */
function generateMasks(state)
{
	state.playerMask = getMaskFromName(state, 'player');
	if (state.playerMask.iszero())
	{
		logErrorNoLine("error, didn't find any object called player, either in the objects section, or the legends section. there must be a player!");
	}

	state.layerMasks = state.collisionLayers.map( layer => makeMaskFromObjectSet(state, layer) )

//	Compute state.objectMasks
	// TODO: replace it with a list of masks for each identifier (and let the code using it check that its not an aggregate)

	var objectMask = {};
	for(var o of state.objects)
	{
		objectMask[o.name] = new BitVec(STRIDE_OBJ);
		objectMask[o.name].ibitset(o.id);
	}

	// Synonyms can depend on properties, and properties can depend on synonyms.
	// Process them in order by combining & sorting by linenumber.

	var synonyms_and_properties = Array.from(state.identifiers.keys()).filter( i => [identifier_type_synonym, identifier_type_property].includes(state.identifiers_deftype[i]) );
	synonyms_and_properties.sort( (a,b) => state.identifiers_lineNumbers[a] - state.identifiers_lineNumbers[b] );
	for (const identifier_index of synonyms_and_properties)
	{
		objectMask[state.identifiers[identifier_index]] = makeMaskFromObjectSet(state, state.getObjectsForIdentifier(identifier_index))
	}

	//use \n as a delimeter for internal-only objects
	var all_obj = new BitVec(STRIDE_OBJ);
	all_obj.inot();
	objectMask["\nall\n"] = all_obj;

	state.objectMasks = objectMask;
}

function checkObjectsAreLayered(state)
{
	for (var o of state.objects)
	{
		if (o.layer === undefined)
		{
			logError('Object "' + o.name.toUpperCase() + '" has been defined, but not assigned to a layer.', o.lineNumber);
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

function processWinConditions(state) {
//	[-1/0/1 (no,some,all),ob1,ob2] (ob2 is background by default)
	var newconditions=[]; 
	for (var i=0;i<state.winconditions.length;i++)  {
		var wincondition=state.winconditions[i];
		if (wincondition.length==0) {
			return;
		}
		var num=0;
		switch(wincondition[0]) {
			case 'no':{num=-1;break;}
			case 'all':{num=1;break;}
		}

		var lineNumber=wincondition[wincondition.length-1];

		var n1 = wincondition[1];
		var n2;
		if (wincondition.length==5) {
			n2 = wincondition[3];
		} else {
			n2 = '\nall\n';
		}

		var mask1=0;
		var mask2=0;
		if (n1 in state.objectMasks) {
			mask1=state.objectMasks[n1];
		} else {
			logError('unwelcome term "' + n1 +'" found in win condition. Win conditions objects have to be objects or properties (defined using "or", in terms of other properties)', lineNumber);
		}
		if (n2 in state.objectMasks) {
			mask2=state.objectMasks[n2];
		} else {
			logError('unwelcome term "' + n2+ '" found in win condition. Win conditions objects have to be objects or properties (defined using "or", in terms of other properties)', lineNumber);
		}
		var newcondition = [num,mask1,mask2,lineNumber];
		newconditions.push(newcondition);
	}
	state.winconditions=newconditions;
}

function printCell(cell)
{
	var result = '';
	for (var j=0; j<cell.length; j+=2)
	{
		var direction = cell[j];
		var object = cell[j+1];
		if (direction === "...")
		{
			result += direction+" ";
		} else {
			result += direction+" "+object+" ";
		}
	}
	return result;
}

function printCellRow(cellRow)
{
	var result = "[ ";
	for (var i=0; i<cellRow.length; i++)
	{
		if (i > 0)
		{
			result += "| ";
		}
		result += printCell(cellRow[i])
	}
	result +="] ";
	return result;
}

function cacheRuleStringRep(rule)
{
	var result="(<a onclick=\"jumpToLine('"+ rule.lineNumber.toString() + "');\"  href=\"javascript:void(0);\">"+rule.lineNumber+"</a>) "+ rule.direction.toString().toUpperCase()+" ";
	if (rule.rigid) {
		result = "RIGID "+result+" ";
	}
	if (rule.randomRule) {
		result = "RANDOM "+result+" ";
	}
	if (rule.late) {
		result = "LATE "+result+" ";
	}
	for (var i=0;i<rule.lhs.length;i++) {
		var cellRow = rule.lhs[i];
		result = result + printCellRow(cellRow);
	}
	result = result + "-> ";
	for (var i=0;i<rule.rhs.length;i++) {
		var cellRow = rule.rhs[i];
		result = result + printCellRow(cellRow);
	}
	for (var i=0;i<rule.commands.length;i++) {
		var command = rule.commands[i];
		if (command.length===1) {
			result = result +command[0].toString();
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
		cacheRuleStringRep(rule);
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
	var loopPoint={};
	var loopPointIndex=0;
	var outside=true;
	var source=0;
	var target=0;
	if (state.loops.length%2===1) {
		logErrorNoLine("have to have matching number of  'startLoop' and 'endLoop' loop points.");
	}

	for (var j=0;j<state.loops.length;j++) {
		var loop = state.loops[j];
		for (var i=0;i<state.rules.length;i++) {
			var ruleGroup = state.rules[i];

			var firstRule = ruleGroup[0];			
			var lastRule = ruleGroup[ruleGroup.length-1];

			var firstRuleLine = firstRule.lineNumber;
			var lastRuleLine = lastRule.lineNumber;

			if (outside) {
				if (firstRuleLine>=loop[0]) {
					target=i;
					outside=false;
					if (loop[1]===-1) {
						logErrorNoLine("Need have to have matching number of  'startLoop' and 'endLoop' loop points.");						
					}
					break;
				}
			} else {
				if (firstRuleLine>=loop[0]) {
					source = i-1;		
					loopPoint[source]=target;
					outside=true;
					if (loop[1]===1) {
						logErrorNoLine("Need have to have matching number of  'startLoop' and 'endLoop' loop points.");						
					}
					break;
				}
			}
		}
	}
	if (outside===false) {
		var source = state.rules.length;
		loopPoint[source]=target;
	} else {
	}
	state.loopPoint=loopPoint;

	loopPoint={};
	outside=true;
	for (var j=0;j<state.loops.length;j++) {
		var loop = state.loops[j];
		for (var i=0;i<state.lateRules.length;i++) {
			var ruleGroup = state.lateRules[i];

			var firstRule = ruleGroup[0];			
			var lastRule = ruleGroup[ruleGroup.length-1];

			var firstRuleLine = firstRule.lineNumber;
			var lastRuleLine = lastRule.lineNumber;

			if (outside) {
				if (firstRuleLine>=loop[0]) {
					target=i;
					outside=false;
					if (loop[1]===-1) {
						logErrorNoLine("Need have to have matching number of  'startLoop' and 'endLoop' loop points.");						
					}
					break;
				}
			} else {
				if (firstRuleLine>=loop[0]) {
					source = i-1;		
					loopPoint[source]=target;
					outside=true;
					if (loop[1]===1) {
						logErrorNoLine("Need have to have matching number of  'startLoop' and 'endLoop' loop points.");						
					}
					break;
				}
			}
		}
	}
	if (outside===false) {
		var source = state.lateRules.length;
		loopPoint[source]=target;
	} else {
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


function generateSoundData(state) {
	var sfx_Events={};
	var sfx_CreationMasks=[];
	var sfx_DestructionMasks=[];
	var sfx_MovementMasks=[];
	var sfx_MovementFailureMasks=[];

	for (var i=0;i<state.sounds.length;i++) {
		var sound=state.sounds[i];
		if (sound.length<=1) {
			continue;
		}
		var lineNumber=sound[sound.length-1];

		if (sound.length===2){			
			logError('incorrect sound declaration.',lineNumber);
			continue;
		}

		if (soundEvents.indexOf(sound[0])>=0) {
			if (sound.length>4) {
				logError("too much stuff to define a sound event.",lineNumber);
			}
			var seed = sound[1];
			if (validSeed(seed)) {
				if (sfx_Events[sound[0]]!==undefined){
					logWarning(sound[0].toUpperCase()+" already declared.",lineNumber);				
				} 
				sfx_Events[sound[0]]=sound[1];
			} else {
				logError("Expecting sfx data, instead found \""+sound[1]+"\".",lineNumber);				
			}
		} else {
			var target = sound[0].trim();
			var verb = sound[1].trim();
			var directions = sound.slice(2,sound.length-2);
			if (directions.length>0&&(verb!=='move'&&verb!=='cantmove')) {
				logError('incorrect sound declaration.',lineNumber);
			}

			if (verb==='action') {
				verb='move';
				directions=['___action____'];
			}

			if (directions.length==0) {
				directions=["orthogonal"];
			}
			var seed = sound[sound.length-2];

			if (isAggregate(state, target))
			{
				logError('cannot assign sound events to aggregate objects (declared with "and"), only to regular objects, or properties, things defined in terms of "or" ("'+target+'").',lineNumber);
			}
			else if (target in state.objectMasks) {

			} else {
				logError('Object "'+ target+'" not found.',lineNumber);
			}

			var objectMask = state.objectMasks[target];

			var directionMask=0;
			for (var j=0;j<directions.length;j++) {
				directions[j]=directions[j].trim();
				var direction=directions[j];
				if (soundDirectionIndicators.indexOf(direction)===-1) {
					logError('Was expecting a direction, instead found "'+direction+'".',lineNumber);
				} else {
					var soundDirectionMask = soundDirectionIndicatorMasks[direction];
					directionMask |= soundDirectionMask;
				}
			}


			var targets=[target];
			var modified=true;
			while(modified) {
				modified=false;
				for (var k=0;k<targets.length;k++) {
					var t = targets[k];
					if (isSynonym(state, t))
					{
						targets[k] = state.getObjectsAnIdentifierCanBe(t).values().map( p => state.objects[p].name );
						modified=true;
					}
					else if (isProperty(state, t))
					{
						modified=true;
						var props = Array.from(state.getObjectsAnIdentifierCanBe(t)).map( p => state.objects[p].name );
						targets.splice(k,1);
						k--;
						for (var l=0;l<props.length;l++) {
							targets.push(props[l]);
						}
					}
				}
			}

			if (verb==='move' || verb==='cantmove') {
				for (var j=0;j<targets.length;j++) {
					var targetName = targets[j];
					var targetDat = state.getObjectByName(targetName); // TODO
					var targetLayer = targetDat.layer;
					var shiftedDirectionMask = new BitVec(STRIDE_MOV);
					shiftedDirectionMask.ishiftor(directionMask, 5*targetLayer);

					var o = {
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

			var targetArray;
			switch(verb) {
				case "create": {
					var o = {
						objectMask: objectMask,
						seed: seed
					}
					sfx_CreationMasks.push(o);
					break;
				}
				case "destroy": {
					var o = {
						objectMask: objectMask,
						seed: seed
					}
					sfx_DestructionMasks.push(o);
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
		logError("text_color in incorrect format - found "+state.fgcolor+", but I expect a color name (like 'pink') or hex-formatted color (like '#1412FA').")
	}
	if (isColor(state.bgcolor)===false ){
		logError("background_color in incorrect format - found "+state.bgcolor+", but I expect a color name (like 'pink') or hex-formatted color (like '#1412FA').")
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
	delete state.objects_candname;
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
		consoleError('<span class="systemMessage">Errors detected during compilation, the game may not work correctly.</span>');
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
