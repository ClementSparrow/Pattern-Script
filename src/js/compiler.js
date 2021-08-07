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
	return ( (str in colorPalettes.arnecolors) || (/^#([0-9A-F]{3,8})$/i.test(str) && ([4,7,9]).includes(str.length) ) || (str === "transparent") );
}

function colorToHex(palette, str)
{
	str = str.trim();
	return (str in palette) ? palette[str]+'FF' : str;
}


function generateSpriteMatrix(dat)
{
	return dat.map(
		function(line)
		{
			var row = [];
			for (var j = 0; j < dat.length; j++)
			{
				const ch = line.charAt(j);
				row.push( (ch == '.') ? -1 : ch );
			}
			return row;
		}
	);
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
			var o = state.identifiers.objects[object_index];
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
	for (var o of state.identifiers.objects)
	{
		if (o.colors.length>10) {
			logError("a sprite cannot have more than 10 colors.  Why you would want more than 10 is beyond me.", state.identifiers.lineNumbers[o.identifier_index]+1); // TODO: Seriously??? Just remind that the bitmap definition uses digits for colors, which limits them to ten -- ClementSparrow
		}
		for (var i=0; i<o.colors.length; i++)
		{
			var c = o.colors[i];
			if (isColor(c))
			{
				c = colorToHex(colorPalette,c);
				o.colors[i] = c;
			} else {
				logError('Invalid color specified for object "' + o.name + '", namely "' + c + '".', state.identifiers.lineNumbers[o.identifier_index] + 1);
				o.colors[i] = '#ff00ffff'; // magenta error color
			}
		}
	}

	//generate sprite matrix
	// TODO: since this can generate errors that could be highlighted, it should be done in the parser
	for (var o of state.identifiers.objects)
	{
		if (o.colors.length == 0)
		{
			// TODO: We may want to silently use transparency in that case, considering how frequent it is to use transparent markers in PuzzleScript...
			logError('color not specified for object "' + o.name +'".', state.identifiers.lineNumbers[o.identifier_index]);
			o.colors=["#ff00ffff"];
		}
		if (o.spritematrix.length === 0)
		{
			o.spritematrix = Array.from( {length: sprite_height}, () => (new Array(sprite_width).fill(0)) )
		}
		else
		{
			if ( o.spritematrix.length !== sprite_height || o.spritematrix.some( line => (line.length !== sprite_width) ) )
			{
				logWarning('Sprite graphics must be ' + sprite_width + ' wide and ' + sprite_height + ' high exactly.', state.identifiers.lineNumbers[o.identifier_index]);
			}
			o.spritematrix = generateSpriteMatrix(o.spritematrix);
		}
	}


	//calculate glyph dictionary
	state.glyphDict = state.identifiers.names.map(
		function(identifier, identifier_index)
		{
			if ( ! [identifier_type_object, identifier_type_property, identifier_type_aggregate].includes(state.identifiers.comptype[identifier_index]) )
				return null;
			var mask = blankMask.concat([]);
			for (const object_pos of state.identifiers.getObjectsForIdentifier(identifier_index))
			{
				const o = state.identifiers.objects[object_pos];
				mask[o.layer] = o.id;
			}
			return mask;
		}
	);

	/* determine which properties specify objects all on one layer */
	state.single_layer_property = state.identifiers.comptype.map(
		function (comptype, i)
		{
			if (comptype != identifier_type_property)
				return -1
			const layers = new Set( Array.from( state.identifiers.getObjectsForIdentifier(i), j => state.identifiers.objects[j].layer ) );
			return (layers.size == 1) ? layers.values().next().value : -1;
		}
	);

	if ( (state.idDict[0] === undefined) && (state.collisionLayers.length > 0))
	{
		logError('You need to have some objects defined');
	}

	//set default background object
	const background_identifier_index = state.identifiers.names.indexOf('background');
	if (background_identifier_index < 0)
	{
		logError("you have to define something to be the background");
		state.background_index = state.idDict[0];
	}
	else if ( ! [identifier_type_object, identifier_type_property].includes(state.identifiers.comptype[background_identifier_index]) )
	{
		logError("background cannot be an aggregate (declared with 'and'), it has to be a simple type, or property (declared in terms of others using 'or').");
		state.background_index = state.idDict[0];
	}
	else
	{
		state.background_index = state.identifiers.getObjectFromIdentifier(background_identifier_index);
	}
	state.backgroundid = state.identifiers.objects[state.background_index].id
	state.backgroundlayer = state.identifiers.objects[state.background_index].layer
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
	var o = new Level(level[0], level[1].length, level.length-1, state.collisionLayers.length, new Int32Array(level[1].length * (level.length-1) * STRIDE_OBJ));

	for (var i = 0; i < o.width; i++)
	{
		for (var j = 0; j < o.height; j++)
		{
			var ch = level[j+1].charAt(i);
			if (ch.length == 0) // TODO: why is it possible to have that from the parser?
			{
				ch = level[j+1].charAt(level[j+1].length-1);
			}

			const identifier_index = state.identifiers.names.indexOf(ch); // TODO: this should be done in the parser
			if (identifier_index < 0)
			{
				logError('Error, symbol "' + ch + '", used in map, not found.', level[0]+j);
				continue;
			}
			if (state.identifiers.comptype[identifier_index] == identifier_type_property)
			{
				logError('Error, symbol "' + ch + '" is defined using \'or\', and therefore ambiguous - it cannot be used in a map. Did you mean to define it in terms of \'and\'?', level[0]+j);
				continue;
			}
			if ( ! [identifier_type_object, identifier_type_aggregate].includes(state.identifiers.comptype[identifier_index]) )
			{
				logError('Error, symbol "' + ch + '" is defined as '+identifier_type_as_text[state.identifiers.comptype[identifier_index]]+'. It cannot be used in a map.', level[0]+j);
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
			// TODO: we should keep the result of wordwrap so that we don't have to recompute it in doMessage
			if (wordwrap(o.message, terminal_width).length > 12)
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
				const object = (state.identifiers.object_set[identifier_index].size > 1) ? null : state.identifiers.objects[state.identifiers.object_set[identifier_index].values().next().value];

				const objectMask = state.objectMasks[identifier_index];
				const layerIndex = (object !== null) ? object.layer : state.single_layer_property[identifier_index];

				if (object_dir === 'no')
				{
					objectsMissing.ior(objectMask);
				}
				else if ((layerIndex === undefined) || (layerIndex < 0))
				{
					logError("Oops!  " +state.identifiers.names[identifier_index].toUpperCase()+" not assigned to a layer.", rule.lineNumber);
				}
				else
				{
					const existing_idindex = layersUsed_l[layerIndex];
					if (existing_idindex !== null)
					{
						rule.discard = [state.identifiers.names[identifier_index].toUpperCase(), state.identifiers.names[existing_idindex].toUpperCase()];
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
				const object = state.identifiers.getObjectsForIdentifier(identifier_index).size > 1 ? null : state.identifiers.objects[state.identifiers.getObjectsForIdentifier(identifier_index).values().next().value];

				if (object_dir === '...')
				{
					//logError("spooky ellipsis found! (should never hit this)");
					break;
				}
				else if (object_dir === 'random')
				{
					if (state.identifiers.comptype[identifier_index] !== identifier_type_aggregate)
					{
						randomMask_r.ior(state.objectMasks[identifier_index]);
						const values = Array.from( state.identifiers.getObjectsForIdentifier(identifier_index), p => [p, state.identifiers.objects[p]] );
						for (const [subobject_index, subobject] of values)
						{
							const subobj_layerIndex = subobject.layer|0; // TODO: we should store...
							const existing_index = layersUsed_r[subobj_layerIndex];
							if ( (existing_index !== null) && (subobject_index !== existing_index) )
							{
								logWarning("This rule may try to spawn a "+subobject.name.toUpperCase()+" with random, but also requires a "+state.identifiers.objects[existing_index].name.toUpperCase()+" be here, which is on the same layer - they shouldn't be able to coexist!", rule.lineNumber); 									
							}

							layersUsedRand_r[subobj_layerIndex] = subobject.identifier_index;
						}                      
					}
					else
					{
						logError('You want to spawn a random "'+state.identifiers.names[identifier_index].toUpperCase()+'", but I don\'t know how to do that', rule.lineNumber);
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
					logError("Oops!  " +state.identifiers.names[identifier_index].toUpperCase()+" not assigned to a layer.", rule.lineNumber);
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
							logError('Rule matches object types that can\'t overlap: "' + state.identifiers.names[identifier_index].toUpperCase() + '" and "' + state.identifiers.names[existing_index].toUpperCase() + '".',rule.lineNumber);
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



function makeMaskFromObjectSet(identifiers, objects)
{
	return makeMaskFromGlyph( Array.from( objects, object_pos => identifiers.objects[object_pos].id ) );
}


/* Computes new attributes for the state: playerMask, layerMasks, objectMask. */
function generateMasks(state)
{
	const player_identifier_index = state.identifiers.names.indexOf('player');
	if (player_identifier_index < 0)
	{
		logErrorNoLine("error, didn't find any object called player, either in the objects section, or the legends section. there must be a player!");
		state.playerMask = new BitVec(STRIDE_OBJ);
	}
	else
	{
		state.playerMask = makeMaskFromObjectSet(state.identifiers, state.identifiers.getObjectsForIdentifier(player_identifier_index));
	}

	state.layerMasks = state.collisionLayers.map( layer => makeMaskFromObjectSet(state.identifiers, layer) )

//	Compute state.objectMasks

	var objectMask = state.identifiers.comptype.map(
		(type, identifier_index) => ([identifier_type_object, identifier_type_property].includes(type)) ? makeMaskFromObjectSet(state.identifiers, state.identifiers.getObjectsForIdentifier(identifier_index)) : null
	);

	var all_obj = new BitVec(STRIDE_OBJ);
	all_obj.inot();
	objectMask.all = all_obj;

	state.objectMasks = objectMask;
}

function checkObjectsAreLayered(identifiers)
{
	for (var o of identifiers.objects)
	{
		if (o.layer === undefined)
		{
			logError('Object "' + o.name.toUpperCase() + '" has been defined, but not assigned to a layer.', identifiers.lineNumbers[o.identifier_index]);
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
	[ sprite_width, sprite_height ] = newmetadata['sprite_size']

	state.metadata = newmetadata
}


function tokenizeWinConditionIdentifier(state, n, lineNumber)
{
	const identifier_index = state.identifiers.checkKnownIdentifier(n, false, state);
	if (identifier_index < 0)
	{
		logError('Unknown object name "' + n +'" found in win condition.', lineNumber);
		return null;
	}
	const identifier_comptype = state.identifiers.comptype[identifier_index];
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

		const num = ({some:0, any:0, no:-1, all:1})[wincondition[0]]; // TODO: this tokenisation should be done in the parser, not here.

		const lineNumber = wincondition[wincondition.length-1];

		const mask1 = tokenizeWinConditionIdentifier( state, wincondition[1], lineNumber)
		const mask2 = (wincondition.length == 5) ? tokenizeWinConditionIdentifier( state, wincondition[3], lineNumber) : state.objectMasks.all;

		newconditions.push( [num, mask1, mask2, lineNumber] );
	}
	state.winconditions = newconditions;
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




//	======= SOUNDS =======

var soundEvents = ["titlescreen", "startgame", "cancel", "endgame", "startlevel","undo","restart","endlevel","showmessage","closemessage","sfx0","sfx1","sfx2","sfx3","sfx4","sfx5","sfx6","sfx7","sfx8","sfx9","sfx10"];
var soundMaskedEvents =["create","destroy","move","cantmove","action"];
var soundVerbs = soundEvents.concat(soundMaskedEvents);


function validSeed (seed)
{
	return /^\s*\d+\s*$/.exec(seed) !== null;
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

			const target_index = state.identifiers.checkKnownIdentifier(target, false, state);
			if (target_index<0)
			{
				// TODO: we have already checked in the parser that it is a known identifier, but we added the sound anyway.
				logError('Object "'+ target+'" not found.', lineNumber);
				continue;
			}
			if (state.identifiers.comptype[target_index] == identifier_type_aggregate)
			{
				logError('cannot assign sound events to aggregate objects (declared with "and"), only to regular objects, or properties, things defined in terms of "or" ("'+target+'").', lineNumber);
				continue;
			}
			if ( [identifier_type_tag, identifier_type_tagset].includes(state.identifiers.comptype[target_index]) )
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

			const targets = Array.from( state.identifiers.getObjectsForIdentifier(target_index), object_index => state.identifiers.objects[object_index] );

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





//	======= COMPILE =======

function formatHomePage(state)
{
	if ('background_color' in state.metadata) {
		state.bgcolor=colorToHex(colorPalette,state.metadata.background_color);
	} else {
		state.bgcolor="#000000FF";
	}
	if ('text_color' in state.metadata) {
		state.fgcolor=colorToHex(colorPalette,state.metadata.text_color);
	} else {
		state.fgcolor="#FFFFFFFF";
	}
	
	if (isColor(state.fgcolor)===false ){
		logError("text_color in incorrect format - found "+state.fgcolor+", but I expect a color name (like 'pink') or hex-formatted color (like '#1412FA').  Defaulting to white.")
		state.fgcolor="#FFFFFFFF";
	}
	if (isColor(state.bgcolor)===false ){
		logError("background_color in incorrect format - found "+state.bgcolor+", but I expect a color name (like 'pink') or hex-formatted color (like '#1412FA').  Defaulting to black.")
		state.bgcolor="#000000FF";
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

const MAX_ERRORS=5;
function loadFile(str)
{

//	Parse the file	
	var state = new PuzzleScriptParser()

	const lines = str.split('\n');
	for (const [i, line] of lines.entries())
	{
	//	Parse the line
		state.lineNumber = i + 1;
		var ss = new CodeMirrorStringStream(line, 4); // note that we use the CodeMirror API to parse the file, here, but we don't have to
		do
		{
			if (line.length > 0)
				state.token(ss)
			else
				state.blankLine()

			if (errorCount > MAX_ERRORS)
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
	checkObjectsAreLayered(state.identifiers);

	generateLoopPoints(state);

	generateSoundData(state);

	formatHomePage(state);

	delete state.commentLevel;
	// delete state.abbrevNames; // we keep them for the level editor only
	delete state.current_identifier_index;
	delete state.objects_section;
	delete state.objects_spritematrix;
	delete state.section;
	delete state.tokenIndex;
	// delete state.visitedSections;
	delete state.loops;
	/*
	var lines = stripComments(str);
	window.console.log(lines);
	var sections = generateSections(lines);
	window.console.log(sections);
	var sss = generateSemiStructuredSections(sections);*/
	return state;
}

function compile(command, text, randomseed)
{
	matchCache={};
	forceRegenImages()
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
	} finally {
		compiling = false;
	}

	if (state && state.levels && state.levels.length===0){	
		logError('No levels found. Add some levels!', undefined, true);
	}

	if (errorCount>MAX_ERRORS)
		return;

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



function qualifyURL(url)
{
	var a = document.createElement('a');
	a.href = url;
	return a.href;
}
