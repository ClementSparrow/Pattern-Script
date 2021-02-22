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

const absolutedirs = ['up', 'down', 'right', 'left'];
const relativedirs = ['^', 'v', '<', '>', 'moving','stationary','parallel','perpendicular', 'no'];
const logicWords = ['all', 'no', 'on', 'some'];
const sectionNames = ['tags', 'objects', 'legend', 'sounds', 'collisionlayers', 'rules', 'winconditions', 'levels'];
const section_constraints = [ [], ['tags'], ['objects'], ['objects'], ['legend'], ['collisionlayers', 'sounds'], ['collisionlayers'], ['legend'] ];
const section_optional = [ true, false, true, true, false, false, true, false ];
const commandwords = ["sfx0","sfx1","sfx2","sfx3","sfx4","sfx5","sfx6","sfx7","sfx8","sfx9","sfx10","cancel","checkpoint","restart","win","message","again"];

const reg_commands = /\p{Separator}*(sfx0|sfx1|sfx2|sfx3|Sfx4|sfx5|sfx6|sfx7|sfx8|sfx9|sfx10|cancel|checkpoint|restart|win|message|again)\p{Separator}*/u;
const reg_name = /[\p{Letter}\p{Number}_]+[\p{Separator}]*/u;
const reg_name_nospace = /[\p{Letter}\p{Number}_]+/u;
const reg_number = /[\d]+/;
const reg_soundseed = /\d+\b/;
const reg_spriterow = /[\.0-9]{5}\p{Separator}*/u;
const reg_sectionNames = /(tags|objects|collisionlayers|legend|sounds|rules|winconditions|levels)(?![\p{Letter}\p{Number}_])[\p{Separator}]*/u;
const reg_equalsrow = /[\=]+/;
const reg_notcommentstart = /[^\(]+/;
const reg_csv_separators = /[ \,]*/;
const reg_soundverbs = /(move|action|create|destroy|cantmove|undo|restart|titlescreen|startgame|cancel|endgame|startlevel|endlevel|showmessage|closemessage|sfx0|sfx1|sfx2|sfx3|sfx4|sfx5|sfx6|sfx7|sfx8|sfx9|sfx10)\p{Separator}+/u;
const reg_directions = /^(action|up|down|left|right|\^|v|\<|\>|moving|stationary|parallel|perpendicular|horizontal|orthogonal|vertical|no|randomdir|random)$/;
const reg_loopmarker = /^(startloop|endloop)$/;
const reg_ruledirectionindicators = /^(up|down|left|right|horizontal|vertical|orthogonal|late|rigid)$/;
const reg_sounddirectionindicators = /\p{Separator}*(up|down|left|right|horizontal|vertical|orthogonal)\p{Separator}*/u;
const reg_winconditionquantifiers = /^(all|any|no|some)$/;
const reg_keywords = /(checkpoint|tags|objects|collisionlayers|legend|sounds|rules|winconditions|\.\.\.|levels|up|down|left|right|^|\||\[|\]|v|\>|\<|no|horizontal|orthogonal|vertical|any|all|no|some|moving|stationary|parallel|perpendicular|action)/;
const keyword_array = ['checkpoint','tags','objects', 'collisionlayers', 'legend', 'sounds', 'rules', '...','winconditions', 'levels','|','[',']','up', 'down', 'left', 'right', 'late','rigid', '^','v','\>','\<','no','randomdir','random', 'horizontal', 'vertical','any', 'all', 'no', 'some', 'moving','stationary','parallel','perpendicular','action','message'];




//	======= TYPES OF IDENTIFIERS =======

var identifier_type_as_text = [ 'an object', 'an object synonym', 'an aggregate', 'a property' ]
const [identifier_type_object, identifier_type_synonym, identifier_type_aggregate, identifier_type_property] = identifier_type_as_text.keys();




// ======== PARSER CONSTRUCTORS =========

// NOTE: CodeMirror creates A LOT of instances of this class, like more than 100 at the initial parsing. So, keep it simple!
function PuzzleScriptParser()
{
	/*
		permanently useful
	*/
	this.objects = []

	// struct of array rather than array of struct
	this.identifiers = [] // all the identifiers defined in the game.
	this.identifiers_deftype = [] // their type when defined
	this.identifiers_comptype = [] // their type in the end (synonyms have identifier_type_synonym for deftype but the comptype of the thing they are synonym of)
	this.identifiers_objects = [] // the objects that the identifier can represent, as a set of indexes in this.objects
	this.identifiers_lineNumbers = [] // the number of the line in which the identifier is first defined
	this.original_case_names = [] // retains the original case of an identifier so that the editor can suggest it as autocompletion.

	/*
		for parsing
	*/
	this.lineNumber = 0

	this.commentLevel = 0

	this.section = ''
	this.visitedSections = [] // There are only 8 sections, so it could be a bitmask rather than an array...

	this.tokenIndex = 0
	this.is_start_of_line = false;

	// metadata defined in the preamble
	this.metadata_keys = []   // TODO: we should not care about the keys, since it's a predefined set
	this.metadata_values = [] // TODO: we should initialize this with the predefined default values.

	// parsing state data used only in the OBJECTS section. Will be deleted by compiler.js/loadFile.
	// TODO: we should not need objects_candindex, because the candidate is always the last entry in objects and object_names.
	this.objects_candindex = null // The index of the object currently parsed -> should always be the last index of the array?
	this.objects_section = 0 //whether reading name/color/spritematrix
	this.objects_spritematrix = []

	// data for the LEGEND section.
	// Aggregates are "obj1 and obj2" that can appear in the definition of a legend character.
	// Properties are "obj1 or obj2".
	// Synonyms are "new_obj = old_obj" and can therefore be used either as Properties or Aggregates.
	this.abbrevNames = [] // TODO: This is only used in this file to parse levels, and is deleted in compiler.js, which is not very smart as it gets recomputed there.
	                      // Plus, we don't need it, as we only check if a single character is in the array, which could also be done (slightly slower) using this.identifiers.

	this.sounds = []

	this.collisionLayers = [] // an array of collision layers (from bottom to top), each as a Set of the indexes of the objects belonging to that layer

	this.rules = []

	this.winconditions = []

	this.levels = [[]]
}

PuzzleScriptParser.prototype.copy = function()
{
	var result = new PuzzleScriptParser()

	result.lineNumber = this.lineNumber

	result.objects = this.objects.map( (o) => ({
			name: o.name,
			identifier_index: o.identifier_index,
			colors: o.colors.concat([]),
			// lineNumber : o.lineNumber,
			spritematrix: o.spritematrix.concat([]),
			layer: o.layer
		}))

	result.identifiers = Array.from(this.identifiers)
	result.identifiers_deftype = Array.from(this.identifiers_deftype)
	result.identifiers_comptype = Array.from(this.identifiers_comptype)
	result.identifiers_objects = this.identifiers_objects.map( objects => Array.from(objects) )
	result.identifiers_lineNumbers = Array.from(this.identifiers_lineNumbers)

	result.commentLevel = this.commentLevel
	result.section = this.section
	result.visitedSections = this.visitedSections.concat([])

	result.tokenIndex = this.tokenIndex
	result.is_start_of_line = this.is_start_of_line;

	result.metadata_keys   = this.metadata_keys.concat([])
	result.metadata_values = this.metadata_values.concat([])

	result.objects_candindex = this.objects_candindex
	result.objects_section = this.objects_section
	result.objects_spritematrix = this.objects_spritematrix.concat([])

	result.sounds = this.sounds.map( i => i.concat([]) )

	result.collisionLayers = this.collisionLayers.map( s => new Array(...s) )

	result.rules = this.rules.concat([])

	result.winconditions = this.winconditions.map( i => i.concat([]) )

	result.original_case_names = this.original_case_names.concat([])

	result.abbrevNames = this.abbrevNames.concat([])

	result.levels = this.levels.map( i => i.concat([]) )

	result.STRIDE_OBJ = this.STRIDE_OBJ
	result.STRIDE_MOV = this.STRIDE_MOV

	return result;
}



//  ======= ACCESS THE DATA PARSED =========

// The functions in this section can be used in other files. They do not rely on CodeMirror's API.

PuzzleScriptParser.prototype.getObjectsForIdentifier = function(identifier_index)
{
	return this.identifiers_objects[identifier_index];
}

PuzzleScriptParser.prototype.getObjectsAnIdentifierCanBe = function(identifier)
{
	const identifier_index = this.identifiers.indexOf(identifier);
	return this.getObjectsForIdentifier(identifier_index);
}




//  ======= RECORD & CHECK IDENTIFIERS AND METADATA =========

// The functions in this section do not rely on CodeMirror's API

const metadata_with_value = ['title','author','homepage','background_color','text_color','key_repeat_interval','realtime_interval','again_interval','flickscreen','zoomscreen','color_palette','youtube']
const metadata_without_value = ['run_rules_on_level_start','norepeat_action','require_player_movement','debug','verbose_logging','throttle_movement','noundo','noaction','norestart','scanline']

PuzzleScriptParser.prototype.registerMetaData = function(key, value)
{
	this.metadata_keys.push(key)
	this.metadata_values.push(value)
}

PuzzleScriptParser.prototype.registerNewIdentifier = function(identifier, original_case, deftype, comptype, objects)
{
	this.original_case_names.push( original_case );
	this.identifiers.push( identifier )
	this.identifiers_deftype.push( deftype )
	this.identifiers_comptype.push( comptype)
	this.identifiers_objects.push( objects )
	this.identifiers_lineNumbers.push( this.lineNumber )
}

PuzzleScriptParser.prototype.registerNewObject = function(identifier, original_case)
{
	const object_id = this.objects.length
	this.objects.push( {
		name: identifier,
		identifier_index: this.identifiers.length,
		colors: [],
		spritematrix: []
	});
	this.registerNewIdentifier(identifier, original_case, identifier_type_object, identifier_type_object, new Set([object_id]))
}

PuzzleScriptParser.prototype.registerNewSynonym = function(identifier, original_case, old_identifier_index)
{
	this.registerNewIdentifier(
		identifier,
		original_case,
		identifier_type_synonym,
		this.identifiers_comptype[old_identifier_index],
		new Set(this.identifiers_objects[old_identifier_index])
	)
}

PuzzleScriptParser.prototype.checkCompoundDefinition = function(identifiers, compound_name, compound_type)
{
	var ok = true;
	var objects = new Set()
	const forbidden_type = (compound_type == identifier_type_aggregate) ? identifier_type_property : identifier_type_aggregate;
	for (const identifier of identifiers)
	{
		const identifier_index = this.identifiers.indexOf(identifier);
		if (identifier_index < 0)
		{
			ok = false;
			const type_as_string = (compound_type == identifier_type_aggregate) ? 'aggregate ' : 'property ';
			logError('Unknown identifier "' + identifier.toUpperCase() + '" found in the definition of ' + type_as_string + compound_name.toUpperCase() + ', ignoring it.', this.lineNumber);
		}
		else
		{
			if (this.identifiers_comptype[identifier_index] == forbidden_type)
			{
				if (compound_type == identifier_type_aggregate)
					logError("Cannot define an aggregate (using 'and') in terms of properties (something that uses 'or').", this.lineNumber);
				else
					logError("Cannot define a property (using 'or') in terms of aggregates (something that uses 'and').", this.lineNumber);
				ok = false;
			}
			else
			{
				this.getObjectsAnIdentifierCanBe(identifier).forEach( o => objects.add(o) )
			}
		}
	}
	return [ok, objects];
}

PuzzleScriptParser.prototype.registerNewLegend = function(new_identifier, original_case, objects, type) // type should be 2 for aggregates and 3 for properties
{
	this.registerNewIdentifier(new_identifier, original_case, type, type, objects);
}

PuzzleScriptParser.prototype.identifierExists = function(n)
{
	return (this.identifiers.indexOf(n.toLowerCase()) >= 0);
}

PuzzleScriptParser.prototype.checkIfNewIdentifierIsValid = function(candname)
{
	// Check if this name is already used
	const identifier_index = this.identifiers.indexOf(candname);
	if (identifier_index >= 0)
	{
		const type = this.identifiers_deftype[identifier_index]
		const definition_string = (type !== identifier_type_object) ? ' as ' + identifier_type_as_text[type] : '';
		const l = this.identifiers_lineNumbers[identifier_index];
		logError('Object "' + candname.toUpperCase() + '" already defined' + definition_string + ' on ' + makeLinkToLine(l, 'line ' + l.toString()), this.lineNumber);
		return false;
	}

	// Warn if the name is a keyword
	if (keyword_array.indexOf(candname) >= 0)
	{
		logWarning('You named an object "' + candname.toUpperCase() + '", but this is a keyword. Don\'t do that!', this.lineNumber);
	}
	return true;
}

// TODO: add a syntax to name collision_layers and use their name as a property?
// -> Actually, we should check that the identifiers given in a layer form a valid property definition.
//    or simply we check that a name given in a collision layer is not the name of an aggregate.
PuzzleScriptParser.prototype.addIdentifierInCurrentCollisionLayer = function(candname)
{
	// we have a name: let's see if it's valid

	if (candname === 'background')
	{
		if ( (this.collisionLayers.length > 0) && (this.collisionLayers[this.collisionLayers.length-1].length > 0) )
		{
			logError("Background must be in a layer by itself.", this.lineNumber);
		}
		this.tokenIndex = 1;
	} else if (this.tokenIndex !== 0)
	{
		logError("Background must be in a layer by itself.", this.lineNumber);
	}

	if (this.collisionLayers.length === 0)
	{
		logError("no layers found.", this.lineNumber);
		return false;
	}
	
	// list other layers that contain an object that candname can be, as an object cannot appear in two different layers
	// Note: a better way to report this would be to tell "candname {is/can be a X, which} is already defined in layer N" depending on the type of candname
	const cand_index = this.identifiers.indexOf(candname);
	if (cand_index < 0)
	{
		logWarning('You are trying to add an object named '+candname.toUpperCase()+' in a collision layer, but no object with that name has been defined.', this.lineNumber);
		return false;
	}

	const ar = this.getObjectsForIdentifier(cand_index);
	var identifier_added = true;
	for (const objpos of ar)
	{
		const obj = this.objects[objpos];
		const l = obj.layer;
		if ( (l !== undefined) && (l != this.collisionLayers.length-1) )
		{
			identifier_added = false;
			logWarning('Object "' + obj.name.toUpperCase() + '" appears in multiple collision layers. I ignored it, but you should fix this!', this.lineNumber);
			// TODO: I changed default PuzzleScript behavior, here, which was to change the layer of the object. -- ClementSparrow.
		}
		else
		{
			this.objects[objpos].layer = this.collisionLayers.length - 1;
			this.collisionLayers[this.collisionLayers.length - 1].add(objpos);
		}
	}
	return identifier_added;
}




//  ======== LEXER USING CODEMIRROR'S API =========


PuzzleScriptParser.prototype.parse_keyword_or_identifier = function(stream)
{
	const match = stream.match(/[\p{Separator}]*[\p{Letter}\p{Number}_]+[\p{Separator}]*/u);
	return (match !== null) ? match[0].trim() : null;
}

PuzzleScriptParser.prototype.parse_sprite_pixel = function(stream)
{
	return stream.eat(/[.\d]/); // a digit or a dot
}






// ====== PARSING TOKENS IN THE DIFFERENT SECTIONS OF THE FILE =======

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


PuzzleScriptParser.prototype.tokenInPreambleSection = function(is_start_of_line, stream, mixedCase)
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
				stream.string = mixedCase;
			}
			
			var m2 = stream.match(reg_notcommentstart, false); // TODO: to end of line, not comment (see above)
			
			if(m2 != null)
			{
				this.registerMetaData(token, m2[0].trim())
			} else {
				logError('MetaData "'+token+'" needs a value.', this.lineNumber);
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
		logError('Unrecognised stuff in the prelude.', this.lineNumber);
		return 'ERROR';
	}
	if (this.tokenIndex == -1) // TODO: it seems we can never reach this point?
	{
		logError('MetaData "'+token+'" has no parameters.', this.lineNumber);
		return 'ERROR';
	}
	return 'METADATA';
}



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
			const tagclass_name = stream.match(reg_name_nospace, true);
			if (tagclass_name === null)
			{
				logError('Unrecognised stuff in the tags section.', this.lineNumber)
				stream.match(reg_notcommentstart, true);
				return 'ERROR'
			}
			if (stream.match(/[\p{Separator}]*=/u, false) === null) // not followed by an = sign
			{
				logError('I was expecting an "=" sign after the tag type name.', this.lineNumber)
				stream.match(reg_notcommentstart, true);
				return 'ERROR'
			}
			// TODO: register the tag class name tagclass_name[0]
			this.tokenIndex = 1;
			return 'NAME';
		}
		case 1: // equal sign
		{
			stream.next();
			this.tokenIndex = 2;
			return 'ASSIGNMENT'
		}
		case 2:
		{
			const tagname = stream.match(reg_name_nospace, true);
			// todo: register the name
			return 'NAME';
		}
		default:
		{
			logError('I reached a part of the code I should never have reached. Please submit a bug repport to ClementSparrow!')
			stream.match(reg_notcommentstart, true);
			return null;
		}
	}
}

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
		return match[0]; // TODO: we need to use a name index instead of candname
	}
	return null;
}



PuzzleScriptParser.prototype.tryParseName = function(is_start_of_line, stream, mixedCase)
{
	//LOOK FOR NAME
	var match_name = is_start_of_line ? stream.match(reg_name, true) : stream.match(/[^\p{Separator}\()]+\p{Separator}*/u, true);
	if (match_name == null)
	{
		stream.match(reg_notcommentstart, true);
		if (stream.pos>0)
		{
			logWarning('Unknown junk in object section (possibly: sprites have to be 5 pixels wide and 5 pixels high exactly. Or maybe: the main names for objects have to be words containing only the letters a-z0.9 - if you want to call them something like ",", do it in the legend section).', this.lineNumber);
		}
		return 'ERROR';
	}

	const candname = match_name[0].trim();

	if ( ! this.checkIfNewIdentifierIsValid(candname) )
		return 'ERROR'

	if (is_start_of_line)
	{
		this.objects_candindex = this.objects.length
		this.registerNewObject(candname, findOriginalCaseName(candname, mixedCase))
	} else {
		//set up alias
		this.registerNewSynonym(candname, findOriginalCaseName(candname, mixedCase), this.objects[this.objects_candindex].identifier_index)
	}
	this.objects_section = 1;
	return 'NAME';
}


PuzzleScriptParser.prototype.tokenInObjectsSection = function(is_start_of_line, stream, mixedCase)
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
			return this.tryParseName(is_start_of_line, stream, mixedCase);
		}
	case 2:
		{
			//LOOK FOR COLOR
			this.tokenIndex = 0;

			var match_color = stream.match(reg_color, true);
			if (match_color == null)
			{
				var str = stream.match(reg_name, true) || stream.match(reg_notcommentstart, true);
				logError('Was looking for color for object ' + this.objects[this.objects_candindex].name.toUpperCase() + ', got "' + str + '" instead.', this.lineNumber);
				return 'ERROR';
			}

			if (this.objects[this.objects_candindex].colors === undefined)
			{
				this.objects[this.objects_candindex].colors = [match_color[0].trim()];
			} else {
				this.objects[this.objects_candindex].colors.push(match_color[0].trim());
			}

			var candcol = match_color[0].trim().toLowerCase();
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
					return this.tryParseName(is_start_of_line, stream, mixedCase);
				logError('Unknown junk in spritematrix for object ' + this.objects[this.objects_candindex].name.toUpperCase() + '.', this.lineNumber);
				stream.match(reg_notcommentstart, true);
				return null;
			}

			if (is_start_of_line)
			{
				spritematrix.push('');
			}

			var o = this.objects[this.objects_candindex];

			spritematrix[spritematrix.length - 1] += ch;
			if (spritematrix[spritematrix.length-1].length>5)
			{
				logError('Sprites must be 5 wide and 5 high.', this.lineNumber);
				stream.match(reg_notcommentstart, true);
				return null;
			}
			o.spritematrix = this.objects_spritematrix;
			if (spritematrix.length === 5 && spritematrix[spritematrix.length - 1].length == 5)
			{
				this.objects_section = 0;
			}

			if (ch!=='.')
			{
				var n = parseInt(ch);
				if (n >= o.colors.length)
				{
					logError("Trying to access color number "+n+" from the color palette of sprite " +this.objects[this.objects_candindex].name.toUpperCase()+", but there are only "+o.colors.length+" defined in it.", this.lineNumber);
					return 'ERROR';
				}
				if (isNaN(n))
				{
					logError('Invalid character "' + ch + '" in sprite for ' + this.objects[this.objects_candindex].name.toUpperCase(), this.lineNumber);
					return 'ERROR';
				}
				return 'COLOR BOLDCOLOR COLOR-' + o.colors[n].toUpperCase();
			}
			return 'COLOR FADECOLOR';
		}
	default:
		window.console.logError("EEK shouldn't get here.");
	}
}



// TODO: when defining an abrevation to use in a level, give the possibility to follow it with a (background) color that will be used in the editor to display the levels
// Or maybe we want to directly use the object's sprite as a background image?
// Also, it would be nice in the level editor to have the letter displayed on each tile (especially useful for transparent tiles) and activate it with that key.
PuzzleScriptParser.prototype.tokenInLegendSection = function(is_start_of_line, stream, mixedCase)
{
	if (is_start_of_line)
	{

		//step 1 : verify format
		var longer = stream.string.replace('=', ' = ');
		longer = reg_notcommentstart.exec(longer)[0];

		var splits = longer.split(/\p{Separator}/u).filter( v => (v !== '') );
		var ok = true;

		if (splits.length > 0)
		{
			const candname = splits[0].toLowerCase();
			if (splits.indexOf(candname, 2) >= 2)
			{
				logError("You can't define object " + candname.toUpperCase() + " in terms of itself!", this.lineNumber);
				ok = false;
			}
			if ( ! this.checkIfNewIdentifierIsValid(candname) )
			{
				stream.match(reg_notcommentstart, true);
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
			const old_identifier_index = this.identifiers.indexOf(splits[2].toLowerCase());
			if (old_identifier_index < 0)
			{
				// TODO: log error.
			}
			else
			{
				this.registerNewSynonym(splits[0], findOriginalCaseName(splits[0], mixedCase), old_identifier_index)
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
					[ok, objects_in_compound] = this.checkCompoundDefinition(new_definition, new_identifier, compound_type)
					this.registerNewLegend(new_identifier, findOriginalCaseName(new_identifier, mixedCase), objects_in_compound, compound_type);
				} 
			}
		}

		if (ok === false)
		{
			logError('incorrect format of legend - should be one of A = B, A = B or C ( or D ...), A = B and C (and D ...)', this.lineNumber);
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
			stream.match(/\p{Separator}*/u, true);
			return 'ASSIGNMENT';
		}
	default:
		{
			var match_name = stream.match(reg_name, true);
			if (match_name === null) {
				logError("Something bad's happening in the LEGEND", this.lineNumber);
				stream.match(reg_notcommentstart, true);
				return 'ERROR';
			}
			const candname = match_name[0].trim();

			if (this.tokenIndex % 2 === 0)
				return 'LOGICWORD';
			if (this.identifierExists(candname) === false) // TODO: why do we need to test that again?
			{
				logError('Cannot reference "' + candname.toUpperCase() + '" in the LEGEND section; it has not been defined yet.', this.lineNumber);
				return 'ERROR';
			}
			return 'NAME';
		}
	}
}




PuzzleScriptParser.prototype.tokenInSoundsSection = function(is_start_of_line, stream)
{
	if (is_start_of_line)
	{
		var ok = true;
		var splits = reg_notcommentstart.exec(stream.string)[0].split(/\p{Separator}/u).filter( v => (v !== '') );
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
	candname = stream.match(/[^\[\|\]\p{Separator}]*/u, true);
	if (candname!== null)
	{
		var m = candname[0].trim();
		if (this.identifiers.indexOf(m) >= 0)
			return 'NAME';
	}

	candname = stream.match(reg_notcommentstart, true);
	logError('unexpected sound token "'+candname+'".' , this.lineNumber);
	stream.match(reg_notcommentstart, true);
	return 'ERROR';
}



PuzzleScriptParser.prototype.tokenInCollisionLayersSection = function(is_start_of_line, stream)
{
	if (is_start_of_line)
	{
		//create new collision layer
		this.collisionLayers.push(new Set());
		this.tokenIndex = 0;
	}

	const match_name = stream.match(reg_name, true);

	// ignore spaces and commas in the list
	if (match_name === null)
	{
		//then strip spaces and commas
		const prepos = stream.pos;
		stream.match(reg_csv_separators, true);
		if (stream.pos == prepos)
		{
			logError("error detected - unexpected character " + stream.peek(), this.lineNumber);
			stream.next();
		}
		return null;
	}
	
	if ( ! this.addIdentifierInCurrentCollisionLayer( match_name[0].trim() ) )
		return 'ERROR' // this is a semantic rather than a syntactic error
	return 'NAME'

}

PuzzleScriptParser.prototype.tokenInRulesSection = function(is_start_of_line, stream, mixedCase, ch)
{
	if (is_start_of_line)
	{
		var rule = reg_notcommentstart.exec(stream.string)[0];
		this.rules.push([rule, this.lineNumber, mixedCase]);
		this.tokenIndex = 0;//in rules, records whether bracket has been found or not
	}

	if (this.tokenIndex === -4)
	{
		stream.skipToEnd();
		return 'MESSAGE';
	}
	if (stream.match(/\p{Separator}*->\p{Separator}*/u, true)) // TODO: also match the unicode arrow character
		return 'ARROW';
	if (ch === '[' || ch === '|' || ch === ']' || ch==='+')
	{
		if (ch !== '+')
		{
			this.tokenIndex = 1;
		}
		stream.next();
		stream.match(/\p{Separator}*/u, true);
		return 'BRACKET';
	}

	const m = stream.match(/[^\[\|\]\p{Separator}]*/u, true)[0].trim();

	if (this.tokenIndex === 0 && reg_loopmarker.exec(m))
		return 'BRACKET'; // styled as a bracket but actually a keyword
	if (this.tokenIndex === 0 && reg_ruledirectionindicators.exec(m))
	{
		stream.match(/\p{Separator}*/u, true);
		return 'DIRECTION';
	}
	if (this.tokenIndex === 1 && reg_directions.exec(m))
	{
		stream.match(/\p{Separator}*/u, true);
		return 'DIRECTION';
	}
	if (this.identifiers.indexOf(m) >= 0)
	{
		if (is_start_of_line)
		{
			logError('Identifiers cannot appear outside of square brackets in rules, only directions can.', this.lineNumber);
			return 'ERROR';
		}
		stream.match(/\p{Separator}*/u, true);
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
	logError('Name "' + m + '", referred to in a rule, does not exist.', this.lineNumber);
	return 'ERROR';
}


PuzzleScriptParser.prototype.tokenInWinconditionsSection = function(is_start_of_line, stream)
{
	if (is_start_of_line)
	{
		var tokenized = reg_notcommentstart.exec(stream.string);
		var splitted = tokenized[0].split(/\p{Separator}/u);
		var filtered = splitted.filter( v => (v !== '') );
		filtered.push(this.lineNumber);
		
		this.winconditions.push(filtered);
		this.tokenIndex = -1;
	}
	this.tokenIndex++;

	const candword = this.parse_keyword_or_identifier(stream)
	if (candword === null)
	{
		logError('incorrect format of win condition.', this.lineNumber);
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
			if (this.identifiers.indexOf(candword) === -1)
			{
				logError('Error in win condition: "' + candword.toUpperCase() + '" is not a valid object name.', this.lineNumber);
				return 'ERROR';
			}
			return 'NAME';
	}
}


PuzzleScriptParser.prototype.tokenInLevelsSection = function(is_start_of_line, stream, mixedCase, ch)
{
	if (is_start_of_line)
	{
		if (stream.match(/\p{Separator}*message\b\p{Separator}*/u, true))
		{
			this.tokenIndex = 1;//1/2 = message/level
			var newdat = ['\n', mixedCase.slice(stream.pos).trim(), this.lineNumber];
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
						logWarning("Maps must be rectangular, yo (In a level, the length of each row must be the same).", this.lineNumber);
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
			logError('Key "' + ch.toUpperCase() + '" not found. Do you need to add it to the legend, or define a new object?', this.lineNumber);
			return 'ERROR';
		}
	}
}


PuzzleScriptParser.prototype.parseActualToken = function(stream, mixedCase, ch) // parses something that is not white space or comment
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

		//	Check mandatory sections that should have been seen before this one.
			const failed_constraints = section_constraints[sectionIndex].filter(
				sec_name => ( this.visitedSections.indexOf(sec_name) < 0 && !section_optional[sectionNames.indexOf(sec_name)] )
			);
			for (const failed_constraint of failed_constraints)
			{
				logError('The mandatory section ' + failed_constraint.toUpperCase() + ' should be provided before section ' + this.section.toUpperCase() + '.', this.lineNumber);
			}

		//	Check that this section is not provided after a section it provides information for.
			if (section_optional[sectionIndex])
			{
				const failed_constraints = [...section_constraints.entries()].filter(
					([sec_index, sec_names]) => ( (sec_names.indexOf(this.section) >= 0) && (this.visitedSections.indexOf(sectionNames[sec_index]) >= 0) )
				);
				for (const [missing_section_index, missing_section_constraints] of failed_constraints)
				{
					logError('Optional section '+this.section.toUpperCase()+' provides information for section '+sectionNames[missing_section_index].toUpperCase()+' and should therefore be provided before it, not after.', this.lineNumber);
				}
			}

			this.visitedSections.push(this.section);

		//	Initialize the parser state for some sections depending on what has been parsed before

			if (this.section === 'levels')
			{
				//populate character abbreviations
				this.abbrevNames = this.identifiers.filter( (identifier, i) => ( (identifier.length == 1) && (this.identifiers_deftype[i] != identifier_type_property) ) );
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
				return this.tokenInObjectsSection(is_start_of_line, stream, mixedCase)
			case 'legend':
				return this.tokenInLegendSection(is_start_of_line, stream, mixedCase)
			case 'sounds':
				return this.tokenInSoundsSection(is_start_of_line, stream)
			case 'collisionlayers':
				return this.tokenInCollisionLayersSection(is_start_of_line, stream)
			case 'rules':
				return this.tokenInRulesSection(is_start_of_line, stream, mixedCase, ch)
			case 'winconditions':
				return this.tokenInWinconditionsSection(is_start_of_line, stream)
			case 'levels':
				return this.tokenInLevelsSection(is_start_of_line, stream, mixedCase, ch)
			default://if you're in the preamble
				return this.tokenInPreambleSection(is_start_of_line, stream, mixedCase)
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
	var mixedCase = stream.string;
	const token_starts_line = stream.sol();
	if (token_starts_line)
	{
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
	// stream.eatWhile(/[\p{Separator}]/u);
	if ( (this.commentLevel === 0) && (this.tokenIndex !== -4) && (stream.match(/[\p{Separator}\)]+/u, true) || stream.eol()) )
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
	// else if (ch === ')') // NOTE: this case should normally only happen when commentLevel>0 and would then be dealt with in the loop below, but it is treated here so that we can have unmatched )'s in the text to ease the commenting of full sections.
	// {
	// 	stream.next();
	// 	if (this.commentLevel > 0)
	// 	{
	// 		this.commentLevel--;
	// 		if (this.commentLevel === 0)
	// 			return 'comment';
	// 	}
	// }
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

	const result = this.parseActualToken(stream, mixedCase, ch);
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
