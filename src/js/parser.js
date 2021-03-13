/*
credits

brunt of the work by increpare (www.increpare.com)

all open source mit license blah blah

testers:
none, yet

code used

colors used
color values for named colours from arne, mostly (and a couple from a 32-colour palette attributed to him)
http://androidarts.com/palette/16pal.htm

the editor is a slight modification of codemirror (codemirror.net), which is crazy awesome.

for post-launch credits, check out activty on github.com/increpare/PuzzleScript

*/

const relativedirs = ['^', 'v', '<', '>', 'moving','stationary','parallel','perpendicular', 'no'];
const logicWords = ['all', 'no', 'on', 'some'];
const sectionNames = ['tags', 'objects', 'legend', 'sounds', 'collisionlayers', 'rules', 'winconditions', 'levels', 'mappings'];
const commandwords = ["sfx0","sfx1","sfx2","sfx3","sfx4","sfx5","sfx6","sfx7","sfx8","sfx9","sfx10","cancel","checkpoint","restart","win","message","again"];

const reg_commands = /[\p{Separator}\s]*(sfx0|sfx1|sfx2|sfx3|Sfx4|sfx5|sfx6|sfx7|sfx8|sfx9|sfx10|cancel|checkpoint|restart|win|message|again)[\p{Separator}\s]*/u;
const reg_name = /[\p{Letter}\p{Number}_]+[\p{Separator}\s]*/u;
const reg_tagged_name = /[\p{Letter}\p{Number}_]+(:[\p{Letter}\p{Number}_]+)*/u;
const reg_tagname = /[\p{Letter}\p{Number}_]+/u;
const reg_number = /[\d]+/;
const reg_soundseed = /\d+\b/;
const reg_spriterow = /[\.0-9]{5}[\p{Separator}\s]*/u;
const reg_sectionNames = /(tags|objects|collisionlayers|legend|sounds|rules|winconditions|levels|mappings)(?![\p{Letter}\p{Number}_])[\p{Separator}\s]*/u;
const reg_equalsrow = /[\=]+/;
const reg_notcommentstart = /[^\(]+/;
const reg_csv_separators = /[ \,]*/;
const reg_soundverbs = /(move|action|create|destroy|cantmove|undo|restart|titlescreen|startgame|cancel|endgame|startlevel|endlevel|showmessage|closemessage|sfx0|sfx1|sfx2|sfx3|sfx4|sfx5|sfx6|sfx7|sfx8|sfx9|sfx10)[\p{Separator}\s]+/u;
const reg_directions = /^(action|up|down|left|right|\^|v|\<|\>|moving|stationary|parallel|perpendicular|horizontal|orthogonal|vertical|no|randomdir|random)$/;
const reg_loopmarker = /^(startloop|endloop)$/;
const reg_ruledirectionindicators = /^(up|down|left|right|horizontal|vertical|orthogonal|late|rigid)$/;
const reg_sounddirectionindicators = /[\p{Separator}\s]*(up|down|left|right|horizontal|vertical|orthogonal)[\p{Separator}\s]*/u;
const reg_winconditionquantifiers = /^(all|any|no|some)$/;
const reg_keywords = /(checkpoint|tags|objects|collisionlayers|legend|sounds|rules|winconditions|\.\.\.|levels|up|down|left|right|^|\||\[|\]|v|\>|\<|no|horizontal|orthogonal|vertical|any|all|no|some|moving|stationary|parallel|perpendicular|action)/;





// ======== PARSER CONSTRUCTORS =========

// NOTE: CodeMirror creates A LOT of instances of this class, like more than 100 at the initial parsing. So, keep it simple!
function PuzzleScriptParser()
{
	/*
		permanently useful
	*/
	this.identifiers = new Identifiers();

	/*
		for parsing
	*/
	this.lineNumber = 0

	this.commentLevel = 0

	this.section = ''

	this.tokenIndex = 0
	this.is_start_of_line = false;

	// metadata defined in the preamble
	this.metadata_keys = []   // TODO: we should not care about the keys, since it's a predefined set
	this.metadata_values = [] // TODO: we should initialize this with the predefined default values.

	// parsing state data used only in the OBJECTS section. Will be deleted by compiler.js/loadFile.
	this.current_identifier_index = null // The index of the ientifier which definition is currently being parsed -> should always be the last index of the array?
	this.objects_section = 0 //whether reading name/color/spritematrix
	this.objects_spritematrix = []

	// data for the LEGEND section.
	this.abbrevNames = [] // TODO: This is only used in this file to parse levels, and is deleted in compiler.js, which is not very smart as it gets recomputed there.
	                      // Plus, we don't need it, as we only check if a single character is in the array, which could also be done (slightly slower) using this.identifiers.names.

	// data for the MAPPINGS section
	this.current_mapping_startset = new Set();
	this.current_mapping_startset_array = [];

	this.sounds = []

	this.collisionLayers = [] // an array of collision layers (from bottom to top), each as a Set of the indexes of the objects belonging to that layer

	this.rules = []

	this.winconditions = []

	this.levels = [[]]
}

PuzzleScriptParser.prototype.copy = function()
{
	var result = new PuzzleScriptParser()

	result.identifiers = this.identifiers.copy()

	result.lineNumber = this.lineNumber

	result.commentLevel = this.commentLevel
	result.section = this.section

	result.tokenIndex = this.tokenIndex
	result.is_start_of_line = this.is_start_of_line;

	result.metadata_keys   = this.metadata_keys.concat([])
	result.metadata_values = this.metadata_values.concat([])

	result.current_identifier_index = this.current_identifier_index
	result.objects_section = this.objects_section
	result.objects_spritematrix = this.objects_spritematrix.concat([])

	result.current_mapping_startset = new Set(this.current_mapping_startset)
	result.current_mapping_startset_array = Array.from(this.current_mapping_startset_array)

	result.sounds = this.sounds.map( i => i.concat([]) )

	result.collisionLayers = this.collisionLayers.map( s => new Array(...s) )

	result.rules = this.rules.concat([])

	result.winconditions = this.winconditions.map( i => i.concat([]) )

	result.abbrevNames = this.abbrevNames.concat([])

	result.levels = this.levels.map( i => i.concat([]) )

	result.STRIDE_OBJ = this.STRIDE_OBJ
	result.STRIDE_MOV = this.STRIDE_MOV

	return result;
}




//	======= LOG ERRORS AND WARNINGS =======

PuzzleScriptParser.prototype.logError = function(msg)
{
	// console.log(msg, this.lineNumber); console.assert(false)
	logError(msg, this.lineNumber);
}

PuzzleScriptParser.prototype.logWarning = function(msg)
{
	// console.log(msg, this.lineNumber);
	logWarning(msg, this.lineNumber);
}




//  ======= RECORD & CHECK IDENTIFIERS AND METADATA =========

// The functions in this section do not rely on CodeMirror's API


//	------- METADATA --------

const metadata_with_value = ['title','author','homepage','background_color','text_color','key_repeat_interval','realtime_interval','again_interval','flickscreen','zoomscreen','color_palette','youtube']
const metadata_without_value = ['run_rules_on_level_start','norepeat_action','require_player_movement','debug','verbose_logging','throttle_movement','noundo','noaction','norestart','scanline']

PuzzleScriptParser.prototype.registerMetaData = function(key, value)
{
	this.metadata_keys.push(key)
	this.metadata_values.push(value)
}



//	------- CHECK TAGS -------

PuzzleScriptParser.prototype.checkIfNewTagNameIsValid = function(name)
{
	if ( ['background', 'player'].includes(name) )
	{
		this.logError('Cannot use '+name.toUpperCase()+' as a tag name or tag class name: it has to be an object.');
		return false;
	}
	if ( forbidden_keywords.indexOf(name) >= 0)
	{
		this.logError('Cannot use the keyword '+name.toUpperCase()+' as a tag name or tag class name.');
		return false;
	}
	return true;
}



//	------- COLLISION LAYERS --------

// TODO: add a syntax to name collision_layers and use their name as a property?
// -> Actually, we should check that the identifiers given in a layer form a valid property definition.
//    or simply we check that a name given in a collision layer is not the name of an aggregate.
PuzzleScriptParser.prototype.addIdentifierInCurrentCollisionLayer = function(candname)
{
	// we have a name: let's see if it's valid

	const current_layer = this.collisionLayers.length - 1;
	if (candname === 'background')
	{
		if ( (current_layer >= 0) && (this.collisionLayers[current_layer].length > 0) )
		{
			this.logError("Background must be in a layer by itself.");
		}
		this.tokenIndex = 1;
	}
	else if (this.tokenIndex !== 0)
	{
		this.logError("Background must be in a layer by itself.");
	}

	if (current_layer < 0)
	{
		this.logError("no layers found.");
		return false;
	}
	
	// list other layers that contain an object that candname can be, as an object cannot appear in two different layers
	// Note: a better way to report this would be to tell "candname {is/can be a X, which} is already defined in layer N" depending on the type of candname
	const cand_index = this.identifiers.checkKnownIdentifier(candname, false, this);
	if (cand_index < 0)
	{
		this.logWarning('You are trying to add an object named '+candname.toUpperCase()+' in a collision layer, but no object with that name has been defined.');
		return false;
	}

	var identifier_added = true;
	for (const objpos of this.identifiers.getObjectsForIdentifier(cand_index))
	{
		const obj = this.identifiers.objects[objpos];
		const l = obj.layer;
		if ( (l !== undefined) && (l != current_layer) )
		{
			identifier_added = false;
			this.logWarning('Object "' + obj.name.toUpperCase() + '" appears in multiple collision layers. I ignored it, but you should fix this!');
			// TODO: I changed default PuzzleScript behavior, here, which was to change the layer of the object. -- ClementSparrow.
		}
		else
		{
			obj.layer = current_layer;
			this.collisionLayers[current_layer].add(objpos);
		}
	}
	return identifier_added;
}








//  ======== LEXER USING CODEMIRROR'S API =========


PuzzleScriptParser.prototype.parse_keyword_or_identifier = function(stream)
{
	const match = stream.match(/[\p{Separator}\s]*[\p{Letter}\p{Number}_:]+[\p{Separator}\s]*/u);
	return (match !== null) ? match[0].trim() : null;
}

PuzzleScriptParser.prototype.parse_sprite_pixel = function(stream)
{
	return stream.eat(/[.\d]/); // a digit or a dot
}






// ====== PARSING TOKENS IN THE DIFFERENT SECTIONS OF THE FILE =======

// ------ EFFECT OF BLANK LINES -------

function blankLineHandle(state)
{
	if (state.section === 'objects')
	{
		state.objects_section = 0;
	}
	else
	{
		state.blankLine()
	}
}

PuzzleScriptParser.prototype.blankLine = function()
{
	if (this.section === 'levels')
	{
		if (this.levels[this.levels.length - 1].length > 0)
		{
			this.levels.push([]);
		}
	}
}




// ------ PREAMBLE -------

PuzzleScriptParser.prototype.tokenInPreambleSection = function(is_start_of_line, stream)
{
	if (is_start_of_line)
	{
		this.tokenIndex = 0;
	}
	else if (this.tokenIndex != 0) // we've already parsed the whole line, now we are necessiraly in the metadata value's text
	{
		stream.match(reg_notcommentstart, true); // TODO: we probably want to read everything till the end of line instead, because comments should be forbiden on metadata lines as it prevents from putting parentheses in the metadata text...
		return "METADATATEXT";
	}

//	Get the metadata key
	const token = this.parse_keyword_or_identifier(stream)
	if (token === null)
	{
		stream.match(reg_notcommentstart, true);
		return 'ERROR'; // TODO: we should probably log an error, here? It implies that if a line starts with an invalid character, it will be silently ignored...
	}

	if (is_start_of_line)
	{
		if (metadata_with_value.indexOf(token) >= 0)
		{
			if (token==='youtube' || token==='author' || token==='homepage' || token==='title')
			{
				stream.string = this.mixedCase;
			}
			
			var m2 = stream.match(reg_notcommentstart, false); // TODO: to end of line, not comment (see above)
			
			if(m2 != null)
			{
				this.registerMetaData(token, m2[0].trim())
			} else {
				this.logError('MetaData "'+token+'" needs a value.');
			}
			this.tokenIndex = 1;
			return 'METADATA';
		}
		if ( metadata_without_value.indexOf(token) >= 0)
		{
			this.registerMetaData(token, "true") // TODO: return the value instead of a string?
			this.tokenIndex = -1;
			return 'METADATA';
		}
		this.logError('Unrecognised stuff in the prelude.');
		return 'ERROR';
	}
	if (this.tokenIndex == -1) // TODO: it seems we can never reach this point?
	{
		this.logError('MetaData "'+token+'" has no parameters.');
		return 'ERROR';
	}
	return 'METADATA';
}




// ------ TAGS -------

PuzzleScriptParser.prototype.tokenInTagsSection = function(is_start_of_line, stream)
{
	if (is_start_of_line)
	{
		this.tokenIndex = 0;
	}

	switch (this.tokenIndex)
	{
		case 0: // tag class name
		{
			const tagclass_name_match = stream.match(reg_tagname, true);
			if (tagclass_name_match === null)
			{
				this.logError('Unrecognised stuff in the tags section.')
				stream.match(reg_notcommentstart, true);
				return 'ERROR'
			}
			if (stream.match(/[\p{Separator}\s]*=/u, false) === null) // not followed by an = sign
			{
				this.logError('I was expecting an "=" sign after the tag type name.')
				stream.match(reg_notcommentstart, true);
				return 'ERROR'
			}
			const tagclass_name = tagclass_name_match[0];
			if ( ! this.checkIfNewTagNameIsValid(tagclass_name) )
			{
				this.tokenIndex = 1;
				return 'ERROR';
			}
			const identifier_index = this.identifiers.names.indexOf(tagclass_name);
			if (identifier_index >= 0)
			{
				const l = this.identifiers.lineNumbers[identifier_index];
				this.logError('You are trying to define a new tag class named "'+tagclass_name.toUpperCase()+'", but this name is already used for '+
					identifier_type_as_text[this.identifiers.comptype[identifier_index]]+' defined '+makeLinkToLine(l, 'line ' + l.toString())+'.');
				this.tokenIndex = 1;
				return 'ERROR';
			}
			this.current_identifier_index = this.identifiers.names.length;
			this.identifiers.registerNewIdentifier(tagclass_name, findOriginalCaseName(tagclass_name, this.mixedCase), identifier_type_tagset, identifier_type_tagset, new Set(), [null], 0, this.lineNumber);
			this.tokenIndex = 1;
			return 'NAME';
		}
		case 1: // equal sign
		{
			stream.next();
			this.tokenIndex = 2;
			return 'ASSIGNMENT'
		}
		case 2: // tag value names
		{
			const tagname_match = stream.match(reg_tagname, true);
			if (tagname_match === null)
			{
				this.logError('Invalid character in tag name: "' + stream.peek() + '".');
				stream.match(reg_notcommentstart, true);
				return 'ERROR'
			}
			const tagname = tagname_match[0];
			if ( ! this.checkIfNewTagNameIsValid(tagname) )
				return 'ERROR';
			const identifier_index = this.identifiers.checkAndRegisterNewTagValue(tagname, findOriginalCaseName(tagname, this.mixedCase), this.current_identifier_index, this);
			return (identifier_index < 0) ? 'ERROR' : 'NAME';
		}
		default:
		{
			logError('I reached a part of the code I should never have reached. Please submit a bug repport to ClementSparrow!')
			stream.match(reg_notcommentstart, true);
			return null;
		}
	}
}





// ------ OBJECTS -------

function findOriginalCaseName(candname, mixedCase)
{
	function escapeRegExp(str)
	{
	  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
	}

	var nameFinder =  new RegExp("\\b"+escapeRegExp(candname)+"\\b","i")
	var match = mixedCase.match(nameFinder);
	if (match != null)
	{
		return match[0];
	}
	return null;
}



PuzzleScriptParser.prototype.tryParseName = function(is_start_of_line, stream)
{
	//LOOK FOR NAME
	var match_name = is_start_of_line ? stream.match(reg_tagged_name, true) : stream.match(/[^\p{Separator}\s\()]+[\p{Separator}\s]*/u, true);
	if (match_name == null)
	{
		stream.match(reg_notcommentstart, true);
		if (stream.pos>0)
		{
			this.logWarning('Unknown junk in object section (possibly: sprites have to be 5 pixels wide and 5 pixels high exactly. Or maybe: the main names for objects have to be words containing only the letters a-z0.9 - if you want to call them something like ",", do it in the legend section).');
		}
		return 'ERROR';
	}

	const candname = match_name[0].trim();

	if (is_start_of_line) // new object name
	{
		const new_identifier_index = this.identifiers.checkAndRegisterNewObjectIdentifier(candname, findOriginalCaseName(candname, this.mixedCase), this);
		if (new_identifier_index < 0)
			return 'ERROR';
		this.current_identifier_index = new_identifier_index;
		return 'NAME';
	}
	// set up alias
	if ( ! this.identifiers.checkIfNewIdentifierIsValid(candname, false, this) )
		return 'ERROR'
	this.identifiers.registerNewSynonym(candname, findOriginalCaseName(candname, this.mixedCase), this.current_identifier_index, [], this.lineNumber)
	return 'NAME';
}


PuzzleScriptParser.prototype.tokenInObjectsSection = function(is_start_of_line, stream)
{
	if (is_start_of_line && this.objects_section == 2)
	{
		this.objects_section = 3;
	}

	if (is_start_of_line && this.objects_section == 1)
	{
		this.objects_section = 2;
	}

	switch (this.objects_section)
	{
	case 0:
	case 1: // name of the object or synonym
		{
			this.objects_spritematrix = [];
			this.objects_section = 1;
			return this.tryParseName(is_start_of_line, stream);
		}
	case 2:
		{
			//LOOK FOR COLOR
			this.tokenIndex = 0;

			const match_color = stream.match(reg_color, true);
			if (match_color == null)
			{
				var str = stream.match(reg_name, true) || stream.match(reg_notcommentstart, true);
				this.logError('Was looking for color for object ' + this.identifiers.names[this.current_identifier_index].toUpperCase() + ', got "' + str + '" instead.');
				return 'ERROR';
			}

			const color = match_color[0].trim();

			for (const object_index of this.identifiers.getObjectsForIdentifier(this.current_identifier_index))
			{
				var o = this.identifiers.objects[object_index];
				if ( (o.identifier_index != this.current_identifier_index) && (this.identifiers.implicit[o.identifier_index] === 0) )
					continue; // do not change the palette of an object that has been explicitely defined unless we're currently explicitly defining it.
				if ( is_start_of_line || (o.colors === undefined) )
				{
					o.colors = [color];
				} else {
					o.colors.push(color);
				}
			}

			const candcol = color.toLowerCase();
			if (candcol in colorPalettes.arnecolors)
				return 'COLOR COLOR-' + candcol.toUpperCase();
			if (candcol==="transparent")
				return 'COLOR FADECOLOR';
			return 'MULTICOLOR'+match_color[0];
		}
	case 3: // sprite matrix
		{
			var spritematrix = this.objects_spritematrix;
			const ch = this.parse_sprite_pixel(stream);
			if (ch === undefined)
			{
				if (spritematrix.length === 0) // allows to not have a sprite matrix and start another object definition without a blank line
				{
					this.objects_section = 1;
					return this.tryParseName(is_start_of_line, stream);
				}
				this.logError('Unknown junk in spritematrix for object ' + this.identifiers[this.current_identifier_index].toUpperCase() + '.');
				stream.match(reg_notcommentstart, true);
				return null;
			}

			if (is_start_of_line)
			{
				spritematrix.push('');
			}

			spritematrix[spritematrix.length - 1] += ch;
			if (spritematrix[spritematrix.length-1].length>5)
			{
				this.logError('Sprites must be 5 wide and 5 high.');
				stream.match(reg_notcommentstart, true);
				return null;
			}
			if (spritematrix.length === 5 && spritematrix[spritematrix.length - 1].length == 5)
			{
				this.objects_section = 0;
				for (const object_index of this.identifiers.object_set[this.current_identifier_index])
				{
					var o = this.identifiers.objects[object_index];
					if ( (o.identifier_index !== this.current_identifier_index) && (this.identifiers.implicit[o.identifier_index] === 0) )
						continue; // do not change the spritematrix of an object that has been explicitely defined unless we're currently explicitly defining it.
					o.spritematrix = Array.from(spritematrix);
				}
			}

		//	Return the correct lexer tag
			if (ch === '.')
				return 'COLOR FADECOLOR';
			const n = parseInt(ch);
			if (isNaN(n))
			{
				this.logError('Invalid character "' + ch + '" in sprite for ' +this.identifiers.names[this.current_identifier_index].toUpperCase());
				return 'ERROR';
			}
			var token_colors = new Set();
			var ok = true;
			for (const object_index of this.identifiers.object_set[this.current_identifier_index])
			{
				var o = this.identifiers.objects[object_index];
				if (n >= o.colors.length)
				{
					this.logError("Trying to access color number "+n+" from the color palette of sprite " +o.name.toUpperCase()+", but there are only "+o.colors.length+" defined in it.");
					ok = false;
				}
				else
				{
					token_colors.add( 'COLOR BOLDCOLOR COLOR-' + o.colors[n].toUpperCase() );
				}
			}
			if (!ok)
				return 'ERROR';
			return (token_colors.size == 1) ? token_colors.values().next().value : null;
		}
	default:
		window.console.logError("EEK shouldn't get here.");
	}
}







// ------ LEGEND -------

// TODO: when defining an abrevation to use in a level, give the possibility to follow it with a (background) color that will be used in the editor to display the levels
// Or maybe we want to directly use the object's sprite as a background image?
// Also, it would be nice in the level editor to have the letter displayed on each tile (especially useful for transparent tiles) and activate it with that key.
PuzzleScriptParser.prototype.tokenInLegendSection = function(is_start_of_line, stream)
{
	if (is_start_of_line)
	{
		//step 1 : verify format
		var longer = stream.string.replace('=', ' = ');
		longer = reg_notcommentstart.exec(longer)[0];

		var splits = longer.split(/[\p{Separator}\s]+/u).filter( v => (v !== '') );
		var ok = true;

		if (splits.length > 0)
		{
			const candname = splits[0].toLowerCase();
			if (splits.indexOf(candname, 2) >= 2)
			{
				this.logError("You can't define object " + candname.toUpperCase() + " in terms of itself!");
				ok = false; // TODO: we should raise the error only for the identifier that is wrong, not for the whole line.
			}
			if ( ! this.identifiers.checkIfNewIdentifierIsValid(candname, false, this) )
			{
				stream.match(reg_notcommentstart, true); // TODO: we should return an ERROR for this identifier but continue the parsing
				return 'ERROR';
			}
		}

		if (!ok) {
		} else if (splits.length < 3) {
			ok = false;
		} else if (splits[1] !== '=') {
			ok = false;
		} else if (splits.length === 3)
		{
			const old_identifier_index = this.identifiers.checkKnownIdentifier(splits[2].toLowerCase(), false, this);
			if (old_identifier_index < 0)
			{
				// TODO: log error.
			}
			else
			{
				// TODO: deal with tags. It should be OK to declare a synonym for an identifier with tag classes (and even tag functions!) as tags, but only if
				// the set of tag classes is the same in the new and old identifiers.
				this.identifiers.registerNewSynonym(splits[0], findOriginalCaseName(splits[0], this.mixedCase), old_identifier_index, [], this.lineNumber)
			}
		} else if (splits.length % 2 === 0) {
			ok = false;
		} else {
			const lowertoken = splits[3].toLowerCase();
			for (var i = 5; i < splits.length; i += 2)
			{
				if (splits[i].toLowerCase() !== lowertoken)
				{
					ok = false;
					break;
				}
			}
			if (ok)
			{
				const new_identifier = splits[0];
				var new_definition = []
				for (var i = 2; i < splits.length; i += 2)
				{
					new_definition.push(splits[i]);
				}
				const compound_type = ({ and:identifier_type_aggregate, or: identifier_type_property})[lowertoken];
				if (compound_type === undefined)
				{
					ok = false;
				}
				else
				{
					var objects_in_compound;
					[ok, objects_in_compound] = this.identifiers.checkCompoundDefinition(new_definition, new_identifier, compound_type, this)
					// TODO: deal with tag classes in the tags of new_identifier or in the objects_in_compound, and manage tag_mappings?
					this.identifiers.registerNewLegend(new_identifier, findOriginalCaseName(new_identifier, this.mixedCase), objects_in_compound, [], compound_type, 0, this.lineNumber);
				} 
			}
		}

		if (ok === false)
		{
			this.logError('incorrect format of legend - should be one of A = B, A = B or C ( or D ...), A = B and C (and D ...)');
			stream.match(reg_notcommentstart, true);
			return 'ERROR';
		}

		this.tokenIndex = 0;
	}

	// the line has been parsed, now we just consume the words, returning the appropriate token type
	this.tokenIndex++;
	switch (this.tokenIndex)
	{
	case 1: // the new identifier
		{
			stream.match(/[^=]*/, true);
			return 'NAME';
		}
	case 2: // =
		{
			stream.next();
			stream.match(/[\p{Separator}\s]*/u, true);
			return 'ASSIGNMENT';
		}
	default:
		{
			var match_name = stream.match(reg_tagged_name, true);
			if (match_name === null) {
				this.logError("Something bad's happening in the LEGEND");
				stream.match(reg_notcommentstart, true);
				return 'ERROR';
			}
			const candname = match_name[0].trim();

			if (this.tokenIndex % 2 === 0)
				return 'LOGICWORD';
			if (this.identifiers.checkKnownIdentifier(candname.toLowerCase(), false, this) < 0) // TODO: why do we need to test that again?
			{
				this.logError('Cannot reference "' + candname.toUpperCase() + '" in the LEGEND section; it has not been defined yet.');
				return 'ERROR';
			}
			return 'NAME';
		}
	}
}





// ------- MAPPINGS -------

PuzzleScriptParser.prototype.tokenInMappingSection = function(is_start_of_line, stream)
{
	if (is_start_of_line)
	{
		if (this.tokenIndex === 0)
		{
			this.objects_section = (this.objects_section+1) % 2
		}
		else if (this.objects_section === 1) // we were parsing the first line
		{
			this.objects_section = 0;
			if (this.tokenIndex < 3)
			{
				this.logError('You started a mapping definition but did not end it. There should be STARTSETNAME => MAPPINGNAME on the first line.');
			}
		}
		else
		{
			this.objects_section = 1;
			if (this.tokenIndex < 2)
			{
				this.logError('You started a mapping definition but did not end it. There should be STARTSETNAMES -> MAPPEDVALUES on the second line.');
			}
			// else
			// TODO: check that we can end the definition here, i.e. that all the values have been defined
		}		
		this.tokenIndex = 0;
	}

	if (this.objects_section === 1) // first line
	{
		switch (this.tokenIndex)
		{
			case 0: // set of values the function opperates on: tag class or object property
			{
				const fromset_name_match = stream.match(reg_tagged_name, true);
				if (fromset_name_match === null)
				{
					this.logError('Unrecognised stuff in the mappings section.')
					stream.match(reg_notcommentstart, true);
					return 'ERROR'
				}
				this.tokenIndex = 1;
				const fromset_name = fromset_name_match[0];
				const identifier_index = this.identifiers.checkIdentifierIsKnownWithType(fromset_name, [identifier_type_property, identifier_type_tagset], false, this);
				if (identifier_index < 0)
				{
					this.logError('Unknown identifier for a mapping\'s start set: '+fromset_name.toUpperCase()+'.')
					stream.match(reg_notcommentstart, true);
					return 'ERROR';
				}
				if ( ! [identifier_type_tagset, identifier_type_property].includes(this.identifiers.comptype[identifier_index]) )
				{
					this.logError('Cannot create a mapping with a start set defined as '+identifier_type_as_text[this.identifiers.comptype[identifier_index]]+': only tag classes and object properties are accepted here.');
					stream.match(reg_notcommentstart, true);
					return 'ERROR';
				}
				this.current_identifier_index = identifier_index;
				this.current_mapping_startset = new Set(this.identifiers.object_set[identifier_index])
				this.current_mapping_startset_array = [];
				return 'NAME';
			}
			case 1: // arrows
			{
				this.tokenIndex = 2;
				if (stream.match(/=>/, true) === null) // not followed by an => sign
				{
					this.logError('I was expecting an "=>" sign after the name of the mapping\'s start set.')
					return 'ERROR'
				}
				return 'ARROW'
			}
			case 2: // name of the function
			{
				this.tokenIndex = 3;
				const fromset_identifier_index = this.current_identifier_index;
				this.current_identifier_index = null;
				const toset_name_match = stream.match(reg_tagged_name, true);
				if (toset_name_match === null)
				{
					this.logError('Unrecognised stuff in the mappings section while reading the mapping\'s name.')
					stream.match(reg_notcommentstart, true);
					return 'ERROR'
				}
				const toset_name = toset_name_match[0];
				if ( (this.identifiers.comptype[fromset_identifier_index] === identifier_type_property) ? ! this.identifiers.checkIfNewIdentifierIsValid(toset_name, false, this) : ! this.checkIfNewTagNameIsValid(toset_name) )
				{
					this.logError('Invalid mapping name: '+toset_name.toUpperCase()+'.')
					stream.match(reg_notcommentstart, true);
					return 'ERROR';
				}
				this.current_identifier_index = this.identifiers.registerNewMapping(toset_name, findOriginalCaseName(toset_name, this.mixedCase), fromset_identifier_index, new Set(), 0, this.lineNumber);
				return 'NAME';
			}
			case 3: // error: extra stuff
			{
				this.logWarning('The first line of a mapping definition should be STARTSETNAME => MAPPINGNAME, but you provided extra stuff after that. I will ignore it.');
				return 'ERROR';
			}

		}
	}
	else // second line
	{
		switch (this.tokenIndex)
		{
			case 0: // elements of the start set
			{
				if (stream.match(/->/, true))
				{
					// check that we have listed all the values in the start set.
					if (this.current_mapping_startset.size > 0)
					{
						// TODO: create a mean to get the name of the start set of the currently defined mapping
						logError('You have not specified every values in the mapping start set '+this.identifiers.names[this.identifiers.object_set[this.current_identifier_index][0]].toUpperCase()+
							'. You forgot: '+Array.from(this.current_mapping_startset, ii => this.identifiers.names[ii].toUpperCase()).join(', ')+'.');
					}
					if (this.current_identifier_index !== null)
					{
						this.identifiers.mappings[this.identifiers.tag_mappings[this.current_identifier_index][0]].fromset = this.current_mapping_startset_array;
					}
					this.current_mapping_startset_array = [];
					this.tokenIndex = 2;
					return 'ARROW';
				}
				const fromvalue_match = stream.match(reg_tagged_name, true);
				if (fromvalue_match === null)
				{
					this.logError('Invalid character in mapping definition: "' + stream.peek() + '".');
					stream.match(reg_notcommentstart, true);
					return 'ERROR'
				}
				const fromvalue_name = fromvalue_match[0];
				// TODO: better define the accepted types here
				const identifier_index = this.identifiers.checkIdentifierIsKnownWithType(fromvalue_name, [identifier_type_object, identifier_type_tag], false, this);
				if (identifier_index < 0)
					return 'ERROR'
				if (this.current_identifier_index === null)
					return 'NAME';
				if ( ! this.current_mapping_startset.delete(identifier_index) )
				{
					this.logError('Invalid declaration of a mapping start set: '+fromvalue_name.toUpperCase()+' is not an atomic member of '+this.identifiers.names[this.identifiers.mappings[this.identifiers.tag_mappings[this.current_identifier_index][0]].from.join(' x ')].toUpperCase()+'.')
					return 'ERROR';
				}
				// register the values in order and check that the whole set of values in the start set is covered.
				this.current_mapping_startset_array.push(identifier_index);
				return 'NAME';
			}
			case 2: // elements of the end set
			{
				const tovalue_match = stream.match(reg_tagged_name, true);
				if (tovalue_match === null)
				{
					this.logError('Invalid character in mapping definition: "' + stream.peek() + '".');
					stream.match(reg_notcommentstart, true);
					return 'ERROR'
				}
				const tovalue_name = tovalue_match[0];
				if (this.current_identifier_index === null)
					return 'NAME';
				const fromset_identifier_index = this.identifiers.mappings[this.identifiers.tag_mappings[this.current_identifier_index][0]].from
				const accepted_types = (this.identifiers.comptype[fromset_identifier_index] === identifier_type_property) ? [identifier_type_object, identifier_type_property] : [identifier_type_tag, identifier_type_tagset]
				const identifier_index = this.identifiers.checkIdentifierIsKnownWithType(tovalue_name, accepted_types, false, this); // todo: better error message when we use a tag instead or a property and vice versa.
				if (identifier_index < 0)
					return 'ERROR'
				// TODO? check that the identifier is in the start set
				// register the mapping for this value
				var mapping = this.identifiers.mappings[this.identifiers.tag_mappings[this.current_identifier_index][0]];
				mapping.toset.push( identifier_index );
				// if we got all the values in the set
				if (mapping.toset.length === mapping.fromset.length)
				{
					this.tokenIndex = 3
				}
				return 'NAME';
			}
			case 3: // error: extra stuff
			{
				this.logWarning('The second line of a mapping definition should be STARTSETVAUES -> ENDSETVALUES, but you provided extra stuff after that. I will ignore it.');
				return 'ERROR';
			}
		}
	}
}


// ------ SOUNDS -------

PuzzleScriptParser.prototype.tokenInSoundsSection = function(is_start_of_line, stream)
{
	if (is_start_of_line)
	{
		var ok = true;
		var splits = reg_notcommentstart.exec(stream.string)[0].split(/[\p{Separator}\s]+/u).filter( v => (v !== '') );
		splits.push(this.lineNumber);
		this.sounds.push(splits);
	}
	candname = stream.match(reg_soundverbs, true);
	if (candname!==null)
		return 'SOUNDVERB';
	candname = stream.match(reg_sounddirectionindicators,true);
	if (candname!==null)
		return 'DIRECTION';
	candname = stream.match(reg_soundseed, true);
	if (candname !== null)
	{
		this.tokenIndex++;
		return 'SOUND';
	} 
	candname = stream.match(/[^\[\|\]\p{Separator}\s]+/u, true);
	if (candname!== null)
	{
		const m = candname[0].trim();
		if (this.identifiers.checkKnownIdentifier(m, false, this) >= 0)
			return 'NAME';
	}

	candname = stream.match(reg_notcommentstart, true);
	this.logError('unexpected sound token "'+candname+'".');
	stream.match(reg_notcommentstart, true);
	return 'ERROR';
}







// ------ COLLISION LAYERS -------

PuzzleScriptParser.prototype.tokenInCollisionLayersSection = function(is_start_of_line, stream)
{
	if (is_start_of_line)
	{
		//create new collision layer
		this.collisionLayers.push(new Set());
		this.tokenIndex = 0;
	}

	const match_name = stream.match(reg_tagged_name, true);

	// ignore spaces and commas in the list
	if (match_name === null)
	{
		//then strip spaces and commas
		const prepos = stream.pos;
		stream.match(reg_csv_separators, true);
		if (stream.pos == prepos)
		{
			this.logError("error detected - unexpected character " + stream.peek());
			stream.next();
		}
		return null;
	}
	
	if ( ! this.addIdentifierInCurrentCollisionLayer( match_name[0].trim() ) )
		return 'ERROR' // this is a semantic rather than a syntactic error
	return 'NAME'

}





// ------ RULES -------

PuzzleScriptParser.prototype.tokenInRulesSection = function(is_start_of_line, stream, ch)
{
	if (is_start_of_line)
	{
		var rule = reg_notcommentstart.exec(stream.string)[0];
		this.rules.push([rule, this.lineNumber, this.mixedCase]);
		this.tokenIndex = 0;//in rules, records whether bracket has been found or not
	}

	if (this.tokenIndex === -4)
	{
		stream.skipToEnd();
		return 'MESSAGE';
	}
	if (stream.match(/[\p{Separator}\s]*->[\p{Separator}\s]*/u, true)) // TODO: also match the unicode arrow character
		return 'ARROW';
	if (ch === '[' || ch === '|' || ch === ']' || ch==='+')
	{
		if (ch !== '+')
		{
			this.tokenIndex = 1;
		}
		stream.next();
		stream.match(/[\p{Separator}\s]*/u, true);
		return 'BRACKET';
	}

	const m = stream.match(/[^\[\|\]\p{Separator}\s]*/u, true)[0].trim();

	if (this.tokenIndex === 0 && reg_loopmarker.exec(m))
		return 'BRACKET'; // styled as a bracket but actually a keyword
	if (this.tokenIndex === 0 && reg_ruledirectionindicators.exec(m))
	{
		stream.match(/[\p{Separator}\s]*/u, true);
		return 'DIRECTION';
	}
	if (this.tokenIndex === 1 && reg_directions.exec(m))
	{
		stream.match(/[\p{Separator}\s]*/u, true);
		return 'DIRECTION';
	}
	if ( (this.identifiers.checkKnownTagClass(m) >= 0) || (this.identifiers.checkKnownIdentifier(m, true, this) >= 0) )
	{
		stream.match(/[\p{Separator}\s]*/u, true);
		return 'NAME';
	}
	if (m === '...')
		return 'DIRECTION';
	if (m === 'rigid')
		return 'DIRECTION';
	if (m === 'random')
		return 'DIRECTION';
	if (commandwords.indexOf(m) >= 0)
	{
		if (m === 'message')
		{
			this.tokenIndex=-4;
		}                                	
		return 'COMMAND';
	}
	this.logError('Name "' + m + '", referred to in a rule, does not exist.');
	return 'ERROR';
}





// ------ WIN CONDITIONS -------

PuzzleScriptParser.prototype.tokenInWinconditionsSection = function(is_start_of_line, stream)
{
	if (is_start_of_line)
	{
		var tokenized = reg_notcommentstart.exec(stream.string);
		var splitted = tokenized[0].split(/[\p{Separator}\s]+/u);
		var filtered = splitted.filter( v => (v !== '') );
		filtered.push(this.lineNumber);
		
		this.winconditions.push(filtered);
		this.tokenIndex = -1;
	}
	this.tokenIndex++;

	const candword = this.parse_keyword_or_identifier(stream)
	if (candword === null)
	{
		this.logError('incorrect format of win condition.');
		stream.match(reg_notcommentstart, true);
		return 'ERROR';
	}
	switch(this.tokenIndex)
	{
		case 0: // expect a quantifier word ('all', 'any', 'some', 'no')
			return (reg_winconditionquantifiers.exec(candword)) ? 'LOGICWORD' : 'ERROR';
		case 2: // expect a 'on'
			return (candword != 'on') ? 'ERROR' : 'LOGICWORD';
		case 1: // expect an identifier
		case 3:
			if (this.identifiers.checkKnownIdentifier(candword, false, this) === -1)
			{
				this.logError('Error in win condition: "' + candword.toUpperCase() + '" is not a valid object name.');
				return 'ERROR';
			}
			return 'NAME';
	}
}






// ------ LEVELS -------

PuzzleScriptParser.prototype.tokenInLevelsSection = function(is_start_of_line, stream, ch)
{
	if (is_start_of_line)
	{
		if (stream.match(/[\p{Separator}\s]*message\b[\p{Separator}\s]*/u, true))
		{
			this.tokenIndex = 1;//1/2 = message/level
			var newdat = ['\n', this.mixedCase.slice(stream.pos).trim(), this.lineNumber];
			if (this.levels[this.levels.length - 1].length == 0) {
				this.levels.splice(this.levels.length - 1, 0, newdat);
			} else {
				this.levels.push(newdat);
			}
			return 'MESSAGE_VERB';
		} else {
			var line = stream.match(reg_notcommentstart, false)[0].trim();
			this.tokenIndex = 2;
			var lastlevel = this.levels[this.levels.length - 1];
			if (lastlevel[0] == '\n') {
				this.levels.push([this.lineNumber, line]);
			} else {
				if (lastlevel.length == 0)
				{
					lastlevel.push(this.lineNumber);
				}
				lastlevel.push(line);  

				if (lastlevel.length > 1) 
				{
					if (line.length != lastlevel[1].length) {
						this.logWarning("Maps must be rectangular, yo (In a level, the length of each row must be the same).");
					}
				}
			}
			
		}
	}
	else
	{
		if (this.tokenIndex == 1)
		{
			stream.skipToEnd();
			return 'MESSAGE';
		}
	}

	if (this.tokenIndex === 2 && !stream.eol())
	{
		var ch = stream.peek();
		stream.next();
		if (this.abbrevNames.indexOf(ch) >= 0) {
			return 'LEVEL';
		} else {
			this.logError('Key "' + ch.toUpperCase() + '" not found. Do you need to add it to the legend, or define a new object?');
			return 'ERROR';
		}
	}
}








// ------ DISPATCH TO APPROPRIATE PARSER -------

PuzzleScriptParser.prototype.parseActualToken = function(stream, ch) // parses something that is not white space or comment
{
	const is_start_of_line = this.is_start_of_line;

	//  if (is_start_of_line)
	{

	//	MATCH '==="s AT START OF LINE
		if (is_start_of_line && stream.match(reg_equalsrow, true))
			return 'EQUALSBIT';

	//	MATCH SECTION NAME
		if (is_start_of_line && stream.match(reg_sectionNames, true))
		{
			this.section = stream.string.slice(0, stream.pos).trim();
			const sectionIndex = sectionNames.indexOf(this.section);

		//	Initialize the parser state for some sections depending on what has been parsed before

			if (this.section === 'levels')
			{
				//populate character abbreviations
				this.abbrevNames = this.identifiers.names.filter( (identifier, i) => ( (identifier.length == 1) && (this.identifiers.deftype[i] != identifier_type_property) ) );
			}
			return 'HEADER';
		}

		if (stream.eol())
		{
			return null;
		}

		switch (this.section)
		{
			case 'tags':
				return this.tokenInTagsSection(is_start_of_line, stream)
			case 'objects':
				return this.tokenInObjectsSection(is_start_of_line, stream)
			case 'legend':
				return this.tokenInLegendSection(is_start_of_line, stream)
			case 'mappings':
				return this.tokenInMappingSection(is_start_of_line, stream)
			case 'sounds':
				return this.tokenInSoundsSection(is_start_of_line, stream)
			case 'collisionlayers':
				return this.tokenInCollisionLayersSection(is_start_of_line, stream)
			case 'rules':
				return this.tokenInRulesSection(is_start_of_line, stream, ch)
			case 'winconditions':
				return this.tokenInWinconditionsSection(is_start_of_line, stream)
			case 'levels':
				return this.tokenInLevelsSection(is_start_of_line, stream, ch)
			default://if you're in the preamble
				return this.tokenInPreambleSection(is_start_of_line, stream)
		}
	}

	if (stream.eol())
		return null;
	if (!stream.eol())
	{
		stream.next();
		return null;
	}
}



PuzzleScriptParser.prototype.token = function(stream)
{
	const token_starts_line = stream.sol();
	if (token_starts_line)
	{
		this.mixedCase = stream.string+'';
		stream.string = stream.string.toLowerCase();
		this.tokenIndex = 0;
		if (this.commentLevel === 0)
			this.is_start_of_line = true;
		/*   if (this.lineNumber==undefined) {
				this.lineNumber=1;
		}
		else {
			this.lineNumber++;
		}*/

	}

	// ignore white space
	if ( (this.commentLevel === 0) && (this.tokenIndex !== -4) && (stream.match(/[\p{Separator}\s\)]+/u, true) || stream.eol()) )
	{
		if (token_starts_line && stream.eol()) // a line that contains only white spaces and unmatched ) is considered a blank line
			return blankLineHandle(this);
		return null; // don't color spaces and unmatched ) outside messages, and skip them
	}

	////////////////////////////////
	// COMMENT PROCESSING BEGINS
	////////////////////////////////

//	NESTED COMMENTS
	var ch = stream.peek();
	if (ch === '(' && this.tokenIndex !== -4) // tokenIndex -4 indicates message command
	{
		stream.next();
		this.commentLevel++;
	}
	if (this.commentLevel > 0)
	{
		do
		{
			stream.match(/[^\(\)]*/, true);
			
			if (stream.eol())
				break;

			ch = stream.peek();

			if (ch === '(')
			{
				this.commentLevel++;
			}
			else if (ch === ')')
			{
				this.commentLevel--;
			}
			stream.next();
		}
		while (this.commentLevel > 0);
		return 'comment';
	}

	// stream.eatWhile(/[ \t]/);

	const result = this.parseActualToken(stream, ch);
	this.is_start_of_line = false;
	return result;
}

// see https://codemirror.net/doc/manual.html#modeapi
window.CodeMirror.defineMode('puzzle', function()
	{
		'use strict';
		return {
			copyState: function(state) { return state.copy(); },
			blankLine: function(state) { state.blankLine(); },
			token: function(stream, state) { return state.token(stream); },
			startState: function() { return new PuzzleScriptParser(); }
		};
	}
);
