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
			for (var j = 0; j < line.length; j++)
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
		logError(['no_collision_layers'])
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
			logError(['palette_not_found', val]) // TODO: use the line number of the palette declaration
		} else {
			colorPalette = colorPalettes[val];
		}
	}
	else
	{
		colorPalette = colorPalettes.arnecolors;
	}

	const color_metadata = [
		[ 'background_color', 'bgcolor', '#000000FF' ],
		[ 'text_color', 'fgcolor', '#FFFFFFFF'],
		[ 'title_color', 'titlecolor', undefined],
		[ 'author_color', 'authorcolor', undefined],
		[ 'keyhint_color', 'keyhintcolor', undefined],
	]
	for (const [metadata_key, state_key, default_color] of color_metadata)
	{
		const color = (metadata_key in state.metadata) ? colorToHex(colorPalette, state.metadata[metadata_key]) : (default_color || state.fgcolor)
		if ( isColor(color) )
		{
			state[state_key] = color
		}
		else
		{
			const final_color = (default_color || state.fgcolor)
			logError(metadata_key + ' in incorrect format - found '+color+", but I expect a color name (like 'pink') or hex-formatted color (like '#1412FA').  Defaulting to "+final_color+'.')
			state[state_key] = final_color
		}
	}

	//convert colors to hex
	// TODO: since this can generate errors that could be highlighted, it should be done in the parser
	for (var o of state.identifiers.objects)
	{
		if (o.colors.length>10) {
			logError(['too_many_sprite_colors'], state.identifiers.lineNumbers[o.identifier_index]+1)
		}
		for (var i=0; i<o.colors.length; i++)
		{
			var c = o.colors[i];
			if (isColor(c))
			{
				c = colorToHex(colorPalette,c);
				o.colors[i] = c;
			} else {
				logError(['invalid_color_for_object', o.name, c], state.identifiers.lineNumbers[o.identifier_index] + 1)
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
			logError(['no_palette_in_object', o.name], state.identifiers.lineNumbers[o.identifier_index])
			o.colors=["#ff00ffff"];
		}
		if (o.spritematrix.length === 0)
		{
			o.spritematrix = Array.from( {length: sprite_height}, () => (new Array(sprite_width).fill(0)) )
		}
		else
		{
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
			if (comptype !== identifier_type_property)
				return -1
			const layers = new Set( Array.from( state.identifiers.getObjectsForIdentifier(i), j => state.identifiers.objects[j].layer ) )
			return (layers.size === 1) ? layers.values().next().value : -1
		}
	);

	if ( (state.idDict[0] === undefined) && (state.collisionLayers.length > 0))
	{
		logError(['no_object'])
	}

	//set default background object
	const background_identifier_index = state.identifiers.names.indexOf('background');
	if (background_identifier_index < 0)
	{
		logError(['no_background'])
		state.background_index = state.idDict[0];
	}
	else if ( ! [identifier_type_object, identifier_type_property].includes(state.identifiers.comptype[background_identifier_index]) )
	{
		logError(['background_is_aggregate'])
		state.background_index = state.idDict[0];
	}
	else
	{
		state.background_index = state.identifiers.getObjectFromIdentifier(background_identifier_index);
	}
	if (state.background_index !== undefined)
	{
		state.backgroundid = state.identifiers.objects[state.background_index].id
		state.backgroundlayer = state.identifiers.objects[state.background_index].layer
	}
}


Level.prototype.calcBackgroundMask = function(state)
{
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
	var o = new Level(level[1].length, level.length-1, new Int32Array(level[1].length * (level.length-1) * STRIDE_OBJ))
	o.lineNumber = level[0]
	execution_context.resetCommands()

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
				logError(['unknown_symbol_in_level', ch], level[0]+j)
				continue
			}
			if (state.identifiers.comptype[identifier_index] == identifier_type_property)
			{
				logError(['property_symbol_in_level', ch], level[0]+j)
				continue
			}
			if ( ! [identifier_type_object, identifier_type_aggregate].includes(state.identifiers.comptype[identifier_index]) )
			{
				logError(['wrong_symbol_type_in_level', ch, state.identifiers.comptype[identifier_index]], level[0]+j)
				continue
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
			if (wordwrap(o.message).length >= terminal_height)
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

function setPostMovement(dir, layerIndex, postMovementsLayerMask_r, movementsClear, randomDirMask_r, movementsSet)
{
	if (dir.length > 0)
	{
		postMovementsLayerMask_r.ishiftor(0x1f, 5*layerIndex);
	}

	if (dir === 'stationary')
	{
		movementsClear.ishiftor(0x1f, 5*layerIndex)
	}
	else if (dir === 'randomdir')
	{
		if (randomDirMask_r.indexOf(layerIndex) < 0)
			randomDirMask_r.push(layerIndex)
	}
	else
	{						
		movementsSet.ishiftor(dirMasks[dir], 5 * layerIndex);
	}
}


function ruleToMask(state, rule, layerTemplate, layerCount)
{
	for (var j = 0; j < rule.lhs.length; j++)
	{
		var cellrow_l = rule.lhs[j];
		var cellrow_r = rule.rhs[j];

		for (const [k, cell_l] of cellrow_l.entries())
		{

			// Left-Hand Side
			// ==============

			var layersUsed_l = Array.from(layerTemplate);
			var objectsPresent = new BitVec(STRIDE_OBJ);
			var objectsMissing = new BitVec(STRIDE_OBJ); // the objects that must not be in the cell ('no' keyword)
			var anyObjectsPresent = [];
			var movementsPresent = new BitVec(STRIDE_MOV);
			var movementsMissing = new BitVec(STRIDE_MOV);

			var objectlayers_l = new BitVec(STRIDE_MOV);

			for (const oc of cell_l)
			{
				if (oc === null)
				{
					objectsPresent = ellipsisPattern;
					if (rule.rhs.length > 0)
					{
						var rhscell = cellrow_r[k];
						if (rhscell.length !==1 || rhscell[0] !== null)
						{
							// TODO: this should be catched earlier in the compilation pipeline
							logError(['no_matching_ellipsis_in_RHS'], rule.lineNumber)
						}
					} 
					break
				}

				// the identifier may be a property on a single collision layer, in which case object_index should not be unique
				const object = (state.identifiers.object_set[oc.ii].size > 1) ? null : state.identifiers.objects[state.identifiers.object_set[oc.ii].values().next().value];

				const objectMask = state.objectMasks[oc.ii]; // only defined for objects and properties, one bit set for each object it can be
				const layerIndex = (object !== null) ? object.layer : state.single_layer_property[oc.ii];

				if (oc.no)
				{
					objectsMissing.ior(objectMask);
				}
				else if ((layerIndex === undefined) || (layerIndex < 0))
				{
					logError(['no_layer_for_object', state.identifiers.names[oc.ii]], rule.lineNumber)
				}
				else
				{
					if (layersUsed_l[layerIndex] !== null)
					{
						// TODO: don't use identifier names in rule.discard, just identifier_indexes
						rule.discard = [state.identifiers.names[oc.ii].toUpperCase(), state.identifiers.names[layersUsed_l[layerIndex]].toUpperCase()];
						// Note: this does not log an error or warning message, unlike the same test in the RHS. Indeed, it's strange that the user did that, but
						// it's not a problem for matching cells. It is a problem, however, if both identifiers matched by the same object are used differently in the RHS,
						// e.g. [ PlayerOrCrate Player ] -> [ right PlayerOrCrate left Player ]
						// or if the movements on both objects are incompatible, like in:
						// [ left PlayerOrCrate right Player ] -> [ stationary PlayerOrCrate stationary Player ]
						// (although in that case, the rule could be expanded as:
						//     [ left Player right Player ] -> [ stationary Player stationary Player ] that will never match
						//     + [ left Crate right Player ] -> [ stationary Crate stationary Player ] that is valid if Player and Crate are in different collision layers
						// and indeed, it compiles fine, producing only the second rule.
						// )
					}

					layersUsed_l[layerIndex] = oc.ii;

					if (object)
					{
						objectsPresent.ior(objectMask);
						objectlayers_l.ishiftor(0x1f, 5*layerIndex);
					}
					else
					{
						anyObjectsPresent.push(objectMask);
					}

					if (oc.dir === 'stationary')
					{
						movementsMissing.ishiftor(0x1f, 5*layerIndex);
					}
					else
					{
						movementsPresent.ishiftor(dirMasks[oc.dir], 5 * layerIndex);
					}
				}
			}

			if ( (rule.rhs.length > 0) && (cellrow_r[k][0] === null) && (cell_l[0] !== null) )
			{
				logError(['no_matching_ellipsis_in_LHS'], rule.lineNumber)
			}

			if (objectsPresent === ellipsisPattern)
			{
				cellrow_l[k] = ellipsisPattern
				continue
			}
			cellrow_l[k] = new CellPattern([objectsPresent, objectsMissing, anyObjectsPresent, movementsPresent, movementsMissing])

			// if X no X, the rule cannot match anything
			if (objectsPresent.anyBitsInCommon(objectsMissing))
			{
				logWarning(['rule_cannot_match_anything'], rule.lineNumber)
			}

			// Right-Hand Side
			// ===============

			if (rule.rhs.length === 0)
				continue

			var cell_r = cellrow_r[k];
			var layersUsed_r = layerTemplate.concat([]);
			var layersUsedRand_r = layerTemplate.concat([]);

			var objectsClear = new BitVec(STRIDE_OBJ);
			var objectsSet = new BitVec(STRIDE_OBJ);
			var movementsClear = new BitVec(STRIDE_MOV);
			var movementsSet = new BitVec(STRIDE_MOV);

			var objectlayers_r = new BitVec(STRIDE_MOV);
			var randomMask_r = new BitVec(STRIDE_OBJ);
			var postMovementsLayerMask_r = new BitVec(STRIDE_MOV); // set for the bits of layers such that a) an object in that layer appears in the (RHS) cell and has a movement direction or action (movement is set), b) an object in that layer appeared on the same cell in the LHS but no object in that layer appears in the (RHS) cell (objects deleted)
			var randomDirMask_r = []
			for (const oc of cell_r)
			{
				// the identifier may be a property on a single collision layer, in which case object_index should not be unique
				const object = state.identifiers.getObjectsForIdentifier(oc.ii).size > 1 ? null : state.identifiers.objects[state.identifiers.getObjectsForIdentifier(oc.ii).values().next().value];

				if (oc.random)
				{
					if (state.identifiers.comptype[oc.ii] === identifier_type_aggregate)
					{
						// TODO: this error should be catched earlier in the parsing piepline
						logError(['spawn_aggregate', state.identifiers.names[oc.ii]], rule.lineNumber)
						continue
					}
					randomMask_r.ior(state.objectMasks[oc.ii]);
					const values = Array.from( state.identifiers.getObjectsForIdentifier(oc.ii), p => [p, state.identifiers.objects[p]] );
					for (const [subobject_index, subobject] of values)
					{
						// TODO: it would be simpler to precompute a layer mask for each identifier, then compare this mask with objectsSet?
						// plus, this would ease the implementation of multi-layer objects if we want to go that way.
						const subobj_layerIndex = subobject.layer|0
						const existing_index = layersUsed_r[subobj_layerIndex];
						if ( (existing_index !== null) && (subobject_index !== existing_index) )
						{
							logWarning("This rule may try to spawn a "+subobject.name.toUpperCase()+" with random, but also requires a "+state.identifiers.objects[existing_index].name.toUpperCase()+" be here, which is on the same layer - they shouldn't be able to coexist!", rule.lineNumber); 									
						}

						// TODO: shouldn't we also test that layersUsedRand_r is not already set?
						layersUsedRand_r[subobj_layerIndex] = subobject.identifier_index;
						setPostMovement(oc.dir, subobj_layerIndex, postMovementsLayerMask_r, movementsClear, randomDirMask_r, movementsSet)
					}
					continue
				}

				const objectMask = state.objectMasks[oc.ii];
				const layerIndex = (object !== null) ? object.layer : state.single_layer_property[oc.ii];
				
				if (oc.no)
				{
					objectsClear.ior(objectMask);
				}
				else if ( (layerIndex === undefined) || (layerIndex < 0) )
				{
					logError(['no_layer_for_object', state.identifiers.names[oc.ii]], rule.lineNumber)
				}
				else
				{
					const existing_index = layersUsed_r[layerIndex] || layersUsedRand_r[layerIndex]

					// "discard" here indicates there is already a problem on the LHS. Is it used just to not show an error message when we know there will already be one for that rule?
					// so, here, it just prevents write/write conflicts?
					if ( (existing_index !== null) && ( ! rule.hasOwnProperty('discard') ) )
					{
						logError(['cant_overlap', state.identifiers.names[oc.ii], state.identifiers.names[existing_index]], rule.lineNumber)
					}

					layersUsed_r[layerIndex] = oc.ii;

					if (object)
					{
						objectsSet.ibitset(object.id);
						objectsClear.ior(state.layerMasks[layerIndex]); // TODO: shouldn't we clear them ONLY if they do not also appear on the LHS?
						objectlayers_r.ishiftor(0x1f, 5*layerIndex);
						// TODO: add movementsClear.ior(state.layerMasks[layerIndex]) ?
					}
					else
					{
						// shouldn't need to do anything here...
						// TODO: add movementsClear.ior(state.layerMasks[layerIndex]) ?
					}

					setPostMovement(oc.dir, layerIndex, postMovementsLayerMask_r, movementsClear, randomDirMask_r, movementsSet)
				}
			}


			// Differences between both sides
			// ==============================

			// The fix in increpare/PuzzleScript@e4d09233cd7abcb80fc9f320b5e35568dd248247 consists in setting as 'stationary' all objects (not properties) appearing in
			// the RHS without movement (including 'no' and 'random' and 'randomdir') and not appearing in the same cell of the LHS (including as a member of a single-layer property).
			//
			// But I think it should be changed into: setting as 'stationary' all objects (not properties) appearing in the RHS without movement (including 'no' and 'random'
			// and 'randomdir') and not appearing in the same cell of the LHS (excluding appearance as a member of a single-layer property) (or, then, appearing with a direction?).
			//
			// 'setting as stationary' => movementsClear.ishiftor(0x1f, 5*layerIndex)
			// 'appearing in the RHS as object' => objectlayers_r.ishiftor(0x1f, 5*layerIndex) or object bit set in objectsSet
			// 'without movement' => postMovementsLayerMask_r.ishiftor(0x1f, 5*layerIndex) is not set.
			// 'not appearing in the same cell of the LHS' => the bit for the object has not been set in objectsPresent or objectlayers_l.ishiftor(0x1f, 5*layerIndex) not set.
			//
			// TODO: it should not be necessary to clear the movement if there is only one type of object in the collision layer of the object created, or the other possible
			// object types in that layers have been 'no'-ed in the LHS.

			if ( ! rule.late )
			{
				var objectsPossiblyCreatedStationary = objectlayers_r.clone()
				objectsPossiblyCreatedStationary.iclear(objectlayers_l)
				objectsPossiblyCreatedStationary.iclear(postMovementsLayerMask_r)
				movementsClear.ior(objectsPossiblyCreatedStationary)
			}

			// TODO: shouldn't we only clear the objects (or rather, their layer masks) that are not present on the RHS? Something like objectsClear.ior(objectsPresent.clear(objectsSet))
			if ( ! objectsPresent.bitsSetInArray(objectsSet.data) ) // if there are individual objects on the LHS that are not on the RHS
			{
				objectsClear.ior(objectsPresent) // destroy them
			}
			if ( ! movementsPresent.bitsSetInArray(movementsSet.data) )
			{
				movementsClear.ior(movementsPresent); // ... and movements
			}

			for (var l = 0; l < layerCount; l++) // TODO: isn't this doing the same thing than that other line below? -> no, the difference is that the other line works only for atomic objects but this loop also works for single-layer properties.
			{
				if (layersUsed_l[l] !== null && layersUsed_r[l] === null)
				{
					// a layer matched on the lhs, but not on the rhs
					objectsClear.ior(state.layerMasks[l]);
					postMovementsLayerMask_r.ishiftor(0x1f, 5*l);
				}
			}

			objectlayers_l.iclear(objectlayers_r);
			postMovementsLayerMask_r.ior(objectlayers_l); // TODO: that other line.

			if (objectsClear || objectsSet || movementsClear || movementsSet || postMovementsLayerMask_r)
			{
				// only set a replacement if something would change
				cellrow_l[k].replacement = new CellReplacement([objectsClear, objectsSet, movementsClear, movementsSet, postMovementsLayerMask_r, randomMask_r, randomDirMask_r])
			}
		}
	}
}

function rulesToMask(state)
{
	const layerCount = state.collisionLayers.length;
	const layerTemplate = Array(layerCount).fill(null);

	for (const rule of state.rules)
	{
		ruleToMask(state, rule, layerTemplate, layerCount)
	}
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
		logError(['no_player_defined'])
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
		logError(['unknown_object_in_wincondition', n], lineNumber)
		return null
	}
	const identifier_comptype = state.identifiers.comptype[identifier_index];
	if ( (identifier_comptype != identifier_type_property) && (identifier_comptype != identifier_type_object) ) // not a property, not an object
	{
		logError(['invalid_object_in_wincondition', n, identifier_type_as_text[identifier_comptype]], lineNumber)
		return null
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

var soundEvents = ["titlescreen", 'gamescreen', 'pausescreen', "startgame", "cancel", "endgame", "startlevel","undo","restart","endlevel","showmessage","closemessage","sfx0","sfx1","sfx2","sfx3","sfx4","sfx5","sfx6","sfx7","sfx8","sfx9","sfx10"];
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
	var sfx_MovementMasks = Array.from(state.collisionLayers, cl => [])
	var sfx_MovementFailureMasks = Array.from(state.collisionLayers, cl => [])

	for (var sound of state.sounds)
	{
		if (sound.length <= 1)
			continue;

		var lineNumber = sound[sound.length-1];

		if (sound.length === 2)
		{
			logError(['incorrect_sound_declaration'], lineNumber)
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
				const sound_names = (sound[0] === 'titlescreen') ? [ 'gamescreen', 'pausescreen' ] : [ sound[0] ]
				for (const sound_name of sound_names)
				{
					if (sfx_Events[sound_name] !== undefined) {
						logWarning(sound_name.toUpperCase()+" already declared.", lineNumber);
					} 
					sfx_Events[sound_name] = sound[1]
				}
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
				logError(['incorrect_sound_declaration'], lineNumber)
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

			if (verb === 'move' || verb === 'cantmove')
			{
				for (const [layer, array] of (verb === 'move' ? sfx_MovementMasks : sfx_MovementFailureMasks).entries() )
				{
					var objectsInLayerMask = objectMask.clone()
					objectsInLayerMask.iand(state.layerMasks[layer])
					if ( ! objectsInLayerMask.iszero() )
					{
						array.push({
							objectMask: objectsInLayerMask,
							directionMask: directionMask,
							seed: seed
						})
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
	state.sfx_MovementMasks = sfx_MovementMasks
	state.sfx_MovementFailureMasks = sfx_MovementFailureMasks;
}





//	======= COMPILE =======

function formatHomePage(state)
{
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

			if (errorStrings.length > MAX_ERRORS)
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

	arrangeRulesByGroupNumber(state);
	collapseRules(state.rules);
	collapseRules(state.lateRules);

	generateRigidGroupList(state);

	processWinConditions(state);
	// checkObjectsAreLayered(state.identifiers);

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

function compile(level, text, randomseed) // level = -1 means restart, level = undefined means rebuild
{
	matchCache = {}
	lastDownTarget = screen_layout.canvas

	if (text === undefined)
	{
		text = window.form1.code.editorreference.getValue() + '\n'
	}
	if (canDump === true)
	{
		compiledText = text
	}

	compiling = true
	errorStrings = []
	warningStrings = []
	consolePrint('=================================')
	try
	{
		var state = loadFile(text)
	} finally {
		compiling = false
	}

	if (state && state.levels && (state.levels.length === 0) )
	{	
		logError(['no_level_found'], undefined, true)
	}

	if (errorStrings.length > MAX_ERRORS)
		return

	if (errorStrings.length > 0)
	{
		consoleError('<span class="systemMessage">Errors detected during compilation; the game may not work correctly.</span>')
	}
	else {
		var ruleCount = 0
		for (const rule of state.rules) {
			ruleCount += rule.length
		}
		for (const rule of state.lateRules) {
			ruleCount += rule.length
		}
		consolePrint('<span class="systemMessage">Successful ' + ((level === undefined) ? 'live re' : '') + 'compilation, generated '+ruleCount+' instructions.</span>')
	}

	setGameState(state, level, randomseed)
	forceRegenImages()

	clearInputHistory()

	consoleCacheDump()
}



function qualifyURL(url)
{
	var a = document.createElement('a');
	a.href = url;
	return a.href;
}
