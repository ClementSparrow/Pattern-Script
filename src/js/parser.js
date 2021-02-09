/*
credits

brunt of the work by stephen lavelle (www.increpare.com)

all open source mit license blah blah

testers:
none, yet

code used

colors used
color values for named colours from arne, mostly (and a couple from a 32-colour palette attributed to him)
http://androidarts.com/palette/16pal.htm

the editor is a slight modification of codemirro (codemirror.net), which is crazy awesome.

for post-launch credits, check out activty on github.com/increpare/PuzzleScript

*/

function blankLineHandle(state)
{
	if (state.section === 'levels')
	{
		if (state.levels[state.levels.length - 1].length > 0)
		{
			state.levels.push([]);
		}
	} else if (state.section === 'objects')
	{
		state.objects_section = 0;
	}
}

//for IE support
if (typeof Object.assign != 'function') {
  (function () {
	Object.assign = function (target) {
	  'use strict';
	  // We must check against these specific cases.
	  if (target === undefined || target === null) {
		throw new TypeError('Cannot convert undefined or null to object');
	  }
 
	  var output = Object(target);
	  for (var index = 1; index < arguments.length; index++) {
		var source = arguments[index];
		if (source !== undefined && source !== null) {
		  for (var nextKey in source) {
			if (source.hasOwnProperty(nextKey)) {
			  output[nextKey] = source[nextKey];
			}
		  }
		}
	  }
	  return output;
	};
  })();
}


const absolutedirs = ['up', 'down', 'right', 'left'];
const relativedirs = ['^', 'v', '<', '>', 'moving','stationary','parallel','perpendicular', 'no'];
const logicWords = ['all', 'no', 'on', 'some'];
const sectionNames = ['objects', 'legend', 'sounds', 'collisionlayers', 'rules', 'winconditions', 'levels'];
const commandwords = ["sfx0","sfx1","sfx2","sfx3","sfx4","sfx5","sfx6","sfx7","sfx8","sfx9","sfx10","cancel","checkpoint","restart","win","message","again"];
const reg_commands = /\p{Z}*(sfx0|sfx1|sfx2|sfx3|Sfx4|sfx5|sfx6|sfx7|sfx8|sfx9|sfx10|cancel|checkpoint|restart|win|message|again)\p{Z}*/u;
const reg_name = /[\p{L}\p{N}_]+[\p{Z}]*/u;///\w*[a-uw-zA-UW-Z0-9_]/;
const reg_number = /[\d]+/;
const reg_soundseed = /\d+\b/;
const reg_spriterow = /[\.0-9]{5}\p{Z}*/u;
const reg_sectionNames = /(objects|collisionlayers|legend|sounds|rules|winconditions|levels)(?![\p{L}\p{N}_])[\p{Z}]*/u;
const reg_equalsrow = /[\=]+/;
const reg_notcommentstart = /[^\(]+/;
const reg_csv_separators = /[ \,]*/;
const reg_soundverbs = /(move|action|create|destroy|cantmove|undo|restart|titlescreen|startgame|cancel|endgame|startlevel|endlevel|showmessage|closemessage|sfx0|sfx1|sfx2|sfx3|sfx4|sfx5|sfx6|sfx7|sfx8|sfx9|sfx10)\p{Z}+/u;
const reg_directions = /^(action|up|down|left|right|\^|v|\<|\>|moving|stationary|parallel|perpendicular|horizontal|orthogonal|vertical|no|randomdir|random)$/;
const reg_loopmarker = /^(startloop|endloop)$/;
const reg_ruledirectionindicators = /^(up|down|left|right|horizontal|vertical|orthogonal|late|rigid)$/;
const reg_sounddirectionindicators = /\p{Z}*(up|down|left|right|horizontal|vertical|orthogonal)\p{Z}*/u;
const reg_winconditionquantifiers = /^(all|any|no|some)$/;
const reg_keywords = /(checkpoint|objects|collisionlayers|legend|sounds|rules|winconditions|\.\.\.|levels|up|down|left|right|^|\||\[|\]|v|\>|\<|no|horizontal|orthogonal|vertical|any|all|no|some|moving|stationary|parallel|perpendicular|action)/;
const keyword_array = ['checkpoint','objects', 'collisionlayers', 'legend', 'sounds', 'rules', '...','winconditions', 'levels','|','[',']','up', 'down', 'left', 'right', 'late','rigid', '^','v','\>','\<','no','randomdir','random', 'horizontal', 'vertical','any', 'all', 'no', 'some', 'moving','stationary','parallel','perpendicular','action','message'];

//  var keywordRegex = new RegExp("\\b(("+cons.join(")|(")+"))$", 'i');


function PuzzleScriptParser()
{
	/*
		permanently useful
	*/
	this.objects = {} // TODO: why use an object instead of an Array?

	/*
		for parsing
	*/
	this.lineNumber = 0

	this.commentLevel = 0

	this.section = ''
	this.visitedSections = []

	// parsing state data used only in the OBJECTS section. Will be deleted by compiler.js/loadFile.
	this.objects_candname = '' // The name of the object currently parsed
	this.objects_section = 0 //whether reading name/color/spritematrix
	this.objects_spritematrix = []

	this.collisionLayers = []

	this.tokenIndex = 0

	// data for the LEGEND section. Only used in this file, compiler.js (generateExtraMembers and generateExtraMasks) and codemirror/anyword-hints.js (CodeMirror.registerHelper)
	// Aggregates are "obj1 and obj2" that can appear in the definition of a legend character.
	// Properties are "obj1 or obj2".
	// Synonyms are "new_obj = old_obj" and can therefore be used either as Properties or Aggregates.
	this.legend_synonyms = []
	this.legend_aggregates = []
	this.legend_properties = []

	this.sounds = []
	this.rules = []

	this.names = []

	this.winconditions = []
	this.metadata = [] // A list of 2n entries where even entries are the name of a metadata defined in the preamble and odd entries behind them are the value of the metadata.
	                   // This structure is only used for the parsing and in compiler.js/generateExtraMembers.
	                   // It will be changed in compiler.js/twiddleMetaData to an associative array, and the values of some parameters will be further parsed then.
	                   // In my mind, this should be done directly in the parser -- ClementSparrow

	this.original_case_names = {} // retain the original case of a name so that the editor can suggest it as autocompletion.

	this.abbrevNames = []

	this.levels = [[]]

	this.subsection = ''
}

PuzzleScriptParser.prototype.copy = function()
{
	var result = new PuzzleScriptParser()

	result.lineNumber = this.lineNumber

	result.objects = {};
	for (var i in this.objects) {
		if (this.objects.hasOwnProperty(i)) {
			var o = this.objects[i];
			result.objects[i] = {
			  colors: o.colors.concat([]),
			  lineNumber : o.lineNumber,
			  spritematrix: o.spritematrix.concat([])
			}
		}
	}

	result.collisionLayers = this.collisionLayers.map( i => i.concat([]) )

	result.commentLevel = this.commentLevel
	result.section = this.section
	result.visitedSections = this.visitedSections.concat([])

	result.objects_candname = this.objects_candname
	result.objects_section = this.objects_section
	result.objects_spritematrix = this.objects_spritematrix.concat([])

	result.tokenIndex = this.tokenIndex
	result.legend_synonyms = this.legend_synonyms.map( i => i.concat([]) )
	result.legend_aggregates = this.legend_aggregates.map( i => i.concat([]) )
	result.legend_properties = this.legend_properties.map( i => i.concat([]) )

	result.sounds = this.sounds.map( i => i.concat([]) )

	result.rules = this.rules.concat([])

	result.names = this.names.concat([])

	result.winconditions = this.winconditions.map( i => i.concat([]) )

	result.original_case_names = Object.assign({}, this.original_case_names);

	result.abbrevNames = this.abbrevNames.concat([])

	result.metadata = this.metadata.concat([])

	result.levels = this.levels.map( i => i.concat([]) )

	result.STRIDE_OBJ = this.STRIDE_OBJ
	result.STRIDE_MOV = this.STRIDE_MOV

	return result;
}


PuzzleScriptParser.prototype.blankLine = function()
{
	if (state.section === 'levels')
	{
		if (state.levels[state.levels.length - 1].length > 0)
		{
			state.levels.push([]);
		}
	}
}


const metadata_with_value = ['title','author','homepage','background_color','text_color','key_repeat_interval','realtime_interval','again_interval','flickscreen','zoomscreen','color_palette','youtube']
const metadata_without_value = ['run_rules_on_level_start','norepeat_action','require_player_movement','debug','verbose_logging','throttle_movement','noundo','noaction','norestart','scanline']

PuzzleScriptParser.prototype.tokenInPreambleSection = function(is_start_of_line, stream, mixedCase)
{
	if (is_start_of_line)
	{
		this.tokenIndex=0;
	}
	if (this.tokenIndex==0)
	{
		var match = stream.match(/[\p{Z}]*[\p{L}\p{N}_]+[\p{Z}]*/u);	                    
		if (match !== null)
		{
			const token = match[0].trim();
			if (is_start_of_line)
			{
				if (metadata_with_value.indexOf(token)>=0)
				{
					
					if (token==='youtube' || token==='author' || token==='homepage' || token==='title')
					{
						stream.string = mixedCase;
					}
					
					var m2 = stream.match(reg_notcommentstart, false);
					
					if(m2 != null)
					{
						this.metadata.push(token);
						this.metadata.push(m2[0].trim());                                            
					} else {
						logError('MetaData "'+token+'" needs a value.',this.lineNumber);
					}
					this.tokenIndex = 1;
					return 'METADATA';
				} else if ( metadata_without_value.indexOf(token)>=0)
				{
					this.metadata.push(token);
					this.metadata.push("true");
					this.tokenIndex = -1;
					return 'METADATA';
				} else  {
					logError('Unrecognised stuff in the prelude.', this.lineNumber);
					return 'ERROR';
				}
			} else if (this.tokenIndex == -1)
			{
				logError('MetaData "'+token+'" has no parameters.',this.lineNumber);
				return 'ERROR';
			}
			return 'METADATA';
		}       
	} else {
		stream.match(reg_notcommentstart, true);
		return "METADATATEXT";
	}
}


PuzzleScriptParser.prototype.registerOriginalCaseName = function(candname, mixedCase)
{
	function escapeRegExp(str)
	{
	  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
	}

	var nameFinder =  new RegExp("\\b"+escapeRegExp(candname)+"\\b","i")
	var match = mixedCase.match(nameFinder);
	if (match != null)
	{
		this.original_case_names[candname] = match[0];
	}
}



PuzzleScriptParser.prototype.tryParseName = function(is_start_of_line, stream, mixedCase)
{
	//LOOK FOR NAME
	var match_name = is_start_of_line ? stream.match(reg_name, true) : stream.match(/[^\p{Z}\()]+\p{Z}*/u,true);
	if (match_name == null)
	{
		stream.match(reg_notcommentstart, true);
		if (stream.pos>0)
		{
			logWarning('Unknown junk in object section (possibly: sprites have to be 5 pixels wide and 5 pixels high exactly. Or maybe: the main names for objects have to be words containing only the letters a-z0.9 - if you want to call them something like ",", do it in the legend section).',this.lineNumber);
		}
		return 'ERROR';
	}

	const candname = match_name[0].trim();

	// Check if there is already an object definition for this name
	if (this.objects[candname] !== undefined)
	{
		logError('Object "' + candname.toUpperCase() + '" defined multiple times.', this.lineNumber);
		return 'ERROR';
	}

	// Check if this name is already used as a legend synonym
	for (const entry of this.legend_synonyms)
	{
		if (entry[0]==candname)
		{
			logError('Name "' + candname.toUpperCase() + '" already in use.', this.lineNumber);                                		
		}
	}

	// Warn if the name is a keyword
	if (keyword_array.indexOf(candname)>=0)
	{
		logWarning('You named an object "' + candname.toUpperCase() + '", but this is a keyword. Don\'t do that!', this.lineNumber);
	}

	if (is_start_of_line)
	{
		this.objects_candname = candname;
		this.registerOriginalCaseName(candname, mixedCase);
		this.objects[this.objects_candname] = {
			lineNumber: this.lineNumber,
			colors: [],
			spritematrix: []
		};
	} else {
		//set up alias
		this.registerOriginalCaseName(candname, mixedCase);
		var synonym = [candname, this.objects_candname];
		synonym.lineNumber = this.lineNumber;
		this.legend_synonyms.push(synonym);
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
	case 1: // name of the object
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
				logError('Was looking for color for object ' + this.objects_candname.toUpperCase() + ', got "' + str + '" instead.', this.lineNumber);
				return null;
			}

			if (this.objects[this.objects_candname].colors === undefined)
			{
				this.objects[this.objects_candname].colors = [match_color[0].trim()];
			} else {
				this.objects[this.objects_candname].colors.push(match_color[0].trim());
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
			var ch = stream.eat(/[.\d]/);
			var spritematrix = this.objects_spritematrix;
			if (ch === undefined)
			{
				if (spritematrix.length === 0)
					return this.tryParseName(is_start_of_line, stream, mixedCase);
				logError('Unknown junk in spritematrix for object ' + this.objects_candname.toUpperCase() + '.', this.lineNumber);
				stream.match(reg_notcommentstart, true);
				return null;
			}

			if (is_start_of_line)
			{
				spritematrix.push('');
			}

			var o = this.objects[this.objects_candname];

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
					logError("Trying to access color number "+n+" from the color palette of sprite " +this.objects_candname.toUpperCase()+", but there are only "+o.colors.length+" defined in it.",this.lineNumber);
					return 'ERROR';
				}
				if (isNaN(n))
				{
					logError('Invalid character "' + ch + '" in sprite for ' + this.objects_candname.toUpperCase(), this.lineNumber);
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


// All this stuff would be much more simpler if we had a dict for each possible name telling us if it's an object, a synonym, an aggregate or a property,
// along with the expanded definition (if it's an aggregate or property).
PuzzleScriptParser.prototype.substitutor2 = function(n)
{
	n = n.toLowerCase();
	if (n in this.objects)
		return [n];

	for (var a of this.legend_synonyms)
	{
		if (a[0]===n)
			return this.substitutor2(a[1]);
	}
	for (var a of this.legend_aggregates)
	{
		if (a[0]===n)
			return [].concat.apply([],a.slice(1).map(this.substitutor2));
	}
	for (var a of this.legend_properties)
	{
		if (a[0]===n)
		{
			logError("Cannot define an aggregate (using 'and') in terms of properties (something that uses 'or').", this.lineNumber);
			ok=false;
			return [n];
		}
	}
	return [n];
};

PuzzleScriptParser.prototype.substitutor3 = function(n)
{
	n = n.toLowerCase();
	if (n in this.objects)
		return [n];

	for (var a of this.legend_synonyms)
	{
		if (a[0]===n)
			return this.substitutor3(a[1]);
	}
	for (var a of this.legend_aggregates)
	{
		if (a[0]===n)
		{
			logError("Cannot define a property (using 'or') in terms of aggregates (something that uses 'and').", this.lineNumber);
			ok=false;
		}
	}
	for (var a of this.legend_properties)
	{
		if (a[0]===n)
			return [].concat.apply([],a.slice(1).map(this.substitutor3));
	}
	return [n];
};


// TODO: this function is very similar to checkNameNew and the substitutor functions, and their logic should be factorized.
// Also, we should use Array.some instead of for loops
// BUG: in these functions, the paramater n is modified and should be modified when exiting the function but javascript passes non-object parameters by value
//      similarly, some of these functions modify the "ok" variable defined in tokenInLegendSection
PuzzleScriptParser.prototype.wordExists = function(n)
{
	n = n.toLowerCase();
	if (n in this.objects)
		return true;
	for (const a of this.legend_aggregates)
	{
		if (a[0]===n)
			return true;
	}
	for (const a of this.legend_properties)
	{
		if (a[0]===n)
			return true;
	}
	for (const a of this.legend_synonyms)
	{
		if (a[0]===n)
			return true;
	}
	return false;
}


PuzzleScriptParser.prototype.checkNameNew = function(candname)
{
	if (this.objects[candname] !== undefined)
	{
		logError('Object "' + candname.toUpperCase() + '" defined multiple times.', this.lineNumber);
		return 'ERROR';
	}
	for (const entry of this.legend_synonyms)
	{
		if (entry[0]==candname)
		{
			logError('Name "' + candname.toUpperCase() + '" already in use.', this.lineNumber);                                        
		}
	}
	for (const entry of this.legend_aggregates)
	{
		if (entry[0]==candname)
		{
			logError('Name "' + candname.toUpperCase() + '" already in use.', this.lineNumber);                                        
		}
	}
	for (const entry of this.legend_properties)
	{
		if (entry[0]==candname)
		{
			logError('Name "' + candname.toUpperCase() + '" already in use.', this.lineNumber);                                        
		}
	}
}


PuzzleScriptParser.prototype.tokenInLegendSection = function(is_start_of_line, stream, mixedCase)
{
	if (is_start_of_line)
	{

		//step 1 : verify format
		var longer = stream.string.replace('=', ' = ');
		longer = reg_notcommentstart.exec(longer)[0];

		var splits = longer.split(/\p{Z}/u).filter(function(v) {
			return v !== '';
		});
		var ok = true;

		if (splits.length>0)
		{
			var candname = splits[0].toLowerCase();
			if (keyword_array.indexOf(candname) >= 0)
			{
				logWarning('You named an object "' + candname.toUpperCase() + '", but this is a keyword. Don\'t do that!', this.lineNumber);
			}
			if (splits.indexOf(candname, 2) >= 2)
			{
				logError("You can't define object " + candname.toUpperCase() + " in terms of itself!", this.lineNumber);
				ok = false;
			}
			this.checkNameNew(candname);
		}

		if (!ok) {
		} else if (splits.length < 3) {
			ok = false;
		} else if (splits[1] !== '=') {
			ok = false;
		} /*else if (splits[0].charAt(splits[0].length - 1) == 'v') {
			logError('names cannot end with the letter "v", because it\'s is used as a direction.', this.lineNumber);
			stream.match(reg_notcommentstart, true);
			return 'ERROR';
		} */ else if (splits.length === 3)
		{
			var synonym = [splits[0], splits[2].toLowerCase()];
			synonym.lineNumber = this.lineNumber;

			this.registerOriginalCaseName(splits[0], mixedCase);
			this.legend_synonyms.push(synonym);
		} else if (splits.length % 2 === 0) {
			ok = false;
		} else {
			var lowertoken = splits[3].toLowerCase();
			if (lowertoken === 'and') {

				for (var i = 5; i < splits.length; i += 2) {
					if (splits[i].toLowerCase() !== 'and') {
						ok = false;
						break;
					}
				}
				if (ok) {
					var newlegend = [splits[0]]
					for (var i = 2; i < splits.length; i += 2) {
						newlegend = newlegend.concat(this.substitutor2(splits[i]));
					}
					newlegend.lineNumber = this.lineNumber;

					this.registerOriginalCaseName(newlegend[0], mixedCase);
					this.legend_aggregates.push(newlegend);
				}
			} else if (lowertoken === 'or') {

				for (var i = 5; i < splits.length; i += 2) {
					if (splits[i].toLowerCase() !== 'or') {
						ok = false;
						break;
					}
				}
				if (ok) {
					var newlegend = [splits[0]].concat(this.substitutor3(splits[2])).concat(this.substitutor3(splits[4]));
					for (var i = 6; i < splits.length; i += 2) {
						newlegend.push(splits[i].toLowerCase());
					}
					newlegend.lineNumber = this.lineNumber;

					this.registerOriginalCaseName(newlegend[0], mixedCase);
					this.legend_properties.push(newlegend);
				}
			} else {
				ok = false;
			}
		}

		if (ok === false) {
			logError('incorrect format of legend - should be one of A = B, A = B or C ( or D ...), A = B and C (and D ...)', this.lineNumber);
			stream.match(reg_notcommentstart, true);
			return 'ERROR';
		}

		this.tokenIndex = 0;
	}

	// the line has been parsed, now we just consume the words, returning the appropriate token type
	switch (this.tokenIndex)
	{
	case 0:
		{
			stream.match(/[^=]*/, true);
			this.tokenIndex++;
			return 'NAME';
		}
	case 1:
		{
			stream.next();
			stream.match(/\p{Z}*/u, true);
			this.tokenIndex++;
			return 'ASSSIGNMENT';
		}
	default:
		{
			var match_name = stream.match(reg_name, true);
			if (match_name === null) {
				logError("Something bad's happening in the LEGEND", this.lineNumber);
				stream.match(reg_notcommentstart, true);
				return 'ERROR';
			} else {
				const candname = match_name[0].trim();

				if (this.tokenIndex % 2 === 0)
				{
					if (this.wordExists(candname)===false)
					{
						logError('Cannot reference "' + candname.toUpperCase() + '" in the LEGEND section; it has not been defined yet.', this.lineNumber);
						this.tokenIndex++;
						return 'ERROR';
					} else {
						this.tokenIndex++;
						return 'NAME';
					}
				} else {
					this.tokenIndex++;
					return 'LOGICWORD';
				}
			}
		}
	}
}




PuzzleScriptParser.prototype.tokenInSoundsSection = function(is_start_of_line, stream, mixedCase)
{
	if (is_start_of_line)
	{
		var ok = true;
		var splits = reg_notcommentstart.exec(stream.string)[0].split(/\p{Z}/u).filter(function(v) {return v !== ''});                          
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
	candname = stream.match(/[^\[\|\]\p{Z}]*/u, true);
	if (candname!== null)
	{
		var m = candname[0].trim();
		if (this.names.indexOf(m) >= 0)
			return 'NAME';
	}

	candname = stream.match(reg_notcommentstart, true);
	logError('unexpected sound token "'+candname+'".' , this.lineNumber);
	stream.match(reg_notcommentstart, true);
	return 'ERROR';
}

// recursively replace a name that can be used in a CollisionLayer with the list of object names it can correspond to
PuzzleScriptParser.prototype.substitutor = function(n)
{
	n = n.toLowerCase();
	if (n in this.objects)
		return [n];

	for (var a of this.legend_synonyms)
	{
		if (a[0]===n)
			return this.substitutor(a[1]);
	}

	for (var a of this.legend_aggregates)
	{
		if (a[0]===n)
		{
			logError('"'+n+'" is an aggregate (defined using "and"), and cannot be added to a single layer because its constituent objects must be able to coexist.', this.lineNumber);
			return [];         
		}
	}
	for (var a of this.legend_properties)
	{
		if (a[0]===n)
		{
			var result = [].concat.apply([],a.slice(1).map(this.substitutor));
			return result;
		}
	}
	logError('Cannot add "' + candname.toUpperCase() + '" to a collision layer; it has not been declared.', this.lineNumber);                                
	return [];
}

PuzzleScriptParser.prototype.tokenInCollisionLayersSection = function(is_start_of_line, stream, mixedCase)
{
	if (is_start_of_line) {
		//create new collision layer
		this.collisionLayers.push([]);
		this.tokenIndex=0;
	}

	var match_name = stream.match(reg_name, true);
	if (match_name === null) {
		//then strip spaces and commas
		var prepos=stream.pos;
		stream.match(reg_csv_separators, true);
		if (stream.pos==prepos) {
			logError("error detected - unexpected character " + stream.peek(),this.lineNumber);
			stream.next();
		}
		return null;
	} else {
		//have a name: let's see if it's valid
		var candname = match_name[0].trim();

		if (candname==='background' ) {
			if (this.collisionLayers.length>0&&this.collisionLayers[this.collisionLayers.length-1].length>0) {
				logError("Background must be in a layer by itself.",this.lineNumber);
			}
			this.tokenIndex=1;
		} else if (this.tokenIndex!==0) {
			logError("Background must be in a layer by itself.",this.lineNumber);
		}

		var ar = this.substitutor(candname);

		if (this.collisionLayers.length===0) {
			logError("no layers found.",this.lineNumber);
			return 'ERROR';
		}
		
		var foundOthers=[];
		for (var i=0;i<ar.length;i++){
			var candname = ar[i];
			for (var j=0;j<=this.collisionLayers.length-1;j++){
				var clj = this.collisionLayers[j];
				if (clj.indexOf(candname)>=0){
					if (j!=this.collisionLayers.length-1){
						foundOthers.push(j);
					}
				}
			}
		}
		if (foundOthers.length>0){
			var warningStr = 'Object "'+candname.toUpperCase()+'" included in multiple collision layers ( layers ';
			for (var i=0;i<foundOthers.length;i++){
				warningStr+=foundOthers[i]+", ";
			}
			warningStr+=this.collisionLayers.length-1;
			logWarning(warningStr +'). You should fix this!',this.lineNumber);                                        
		}

		this.collisionLayers[this.collisionLayers.length - 1] = this.collisionLayers[this.collisionLayers.length - 1].concat(ar);
		if (ar.length>0) {
			return 'NAME';                            
		} else {
			return 'ERROR';
		}
	}
}

PuzzleScriptParser.prototype.tokenInRulesSection = function(is_start_of_line, stream, mixedCase, ch)
{
	if (is_start_of_line) {
		var rule = reg_notcommentstart.exec(stream.string)[0];
		this.rules.push([rule, this.lineNumber, mixedCase]);
		this.tokenIndex = 0;//in rules, records whether bracket has been found or not
	}

	if (this.tokenIndex===-4) {
		stream.skipToEnd();
		return 'MESSAGE';
	}
	if (stream.match(/\p{Z}*->\p{Z}*/u, true)) {
		return 'ARROW';
	}
	if (ch === '[' || ch === '|' || ch === ']' || ch==='+') {
		if (ch!=='+') {
			this.tokenIndex = 1;
		}
		stream.next();
		stream.match(/\p{Z}*/u, true);
		return 'BRACKET';
	} else {
		var m = stream.match(/[^\[\|\]\p{Z}]*/u, true)[0].trim();

		if (this.tokenIndex===0&&reg_loopmarker.exec(m)) {
			return 'BRACKET';
		} else if (this.tokenIndex === 0 && reg_ruledirectionindicators.exec(m)) {
			stream.match(/\p{Z}*/u, true);
			return 'DIRECTION';
		} else if (this.tokenIndex === 1 && reg_directions.exec(m)) {
			stream.match(/\p{Z}*/u, true);
			return 'DIRECTION';
		} else {
			if (this.names.indexOf(m) >= 0) {
				if (is_start_of_line) {
					logError('Identifiers cannot appear outside of square brackets in rules, only directions can.', this.lineNumber);
					return 'ERROR';
				} else {
					stream.match(/\p{Z}*/u, true);
					return 'NAME';
				}
			} else if (m==='...') {
				return 'DIRECTION';
			} else if (m==='rigid') {
				return 'DIRECTION';
			} else if (m==='random') {
				return 'DIRECTION';
			} else if (commandwords.indexOf(m)>=0) {
				if (m==='message') {
					this.tokenIndex=-4;
				}                                	
				return 'COMMAND';
			} else {
				logError('Name "' + m + '", referred to in a rule, does not exist.', this.lineNumber);
				return 'ERROR';
			}
		}
	}
}


PuzzleScriptParser.prototype.tokenInWinconditionsSection = function(is_start_of_line, stream, mixedCase)
{
	if (is_start_of_line) {
		var tokenized = reg_notcommentstart.exec(stream.string);
		var splitted = tokenized[0].split(/\p{Z}/u);
		var filtered = splitted.filter(function(v) {return v !== ''});
		filtered.push(this.lineNumber);
		
		this.winconditions.push(filtered);
		this.tokenIndex = -1;
	}
	this.tokenIndex++;

	var match = stream.match(/[\p{Z}]*[\p{L}\p{N}_]+[\p{Z}]*/u);
	if (match === null) {
			logError('incorrect format of win condition.', this.lineNumber);
			stream.match(reg_notcommentstart, true);
			return 'ERROR';

	} else {
		var candword = match[0].trim();
		if (this.tokenIndex === 0) {
			if (reg_winconditionquantifiers.exec(candword)) {
				return 'LOGICWORD';
			}
			else {
				return 'ERROR';
			}
		}
		else if (this.tokenIndex === 2) {
			if (candword != 'on') {
				return 'ERROR';
			} else {
				return 'LOGICWORD';
			}
		}
		else if (this.tokenIndex === 1 || this.tokenIndex === 3) {
			if (this.names.indexOf(candword)===-1) {
				logError('Error in win condition: "' + candword.toUpperCase() + '" is not a valid object name.', this.lineNumber);
				return 'ERROR';
			} else {
				return 'NAME';
			}
		}
	}
}


PuzzleScriptParser.prototype.tokenInLevelsSection = function(is_start_of_line, stream, mixedCase, ch)
{
	if (is_start_of_line)
	{
		if (stream.match(/\p{Z}*message\p{Z}*/u, true)) {
			this.tokenIndex = 1;//1/2 = message/level
			var newdat = ['\n', mixedCase.slice(stream.pos).trim(),this.lineNumber];
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
				this.levels.push([this.lineNumber,line]);
			} else {
				if (lastlevel.length==0)
				{
					lastlevel.push(this.lineNumber);
				}
				lastlevel.push(line);  

				if (lastlevel.length>1) 
				{
					if (line.length!=lastlevel[1].length) {
						logWarning("Maps must be rectangular, yo (In a level, the length of each row must be the same).",this.lineNumber);
					}
				}
			}
			
		}
	} else {
		if (this.tokenIndex == 1) {
			stream.skipToEnd();
			return 'MESSAGE';
		}
	}

	if (this.tokenIndex === 2 && !stream.eol()) {
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



PuzzleScriptParser.prototype.token = function(stream)
{
	var mixedCase = stream.string;
	var is_start_of_line = stream.sol();
	if (is_start_of_line)
	{
		stream.string = stream.string.toLowerCase();
		this.tokenIndex = 0;
		/*   if (this.lineNumber==undefined) {
				this.lineNumber=1;
		}
		else {
			this.lineNumber++;
		}*/

	}

	stream.eatWhile(/[ \t]/);

	////////////////////////////////
	// COMMENT PROCESSING BEGIN
	////////////////////////////////

	//NESTED COMMENTS
	var ch = stream.peek();
	if (ch === '(' && this.tokenIndex !== -4) // tokenIndex -4 indicates message command
	{
		stream.next();
		this.commentLevel++;
	} else if (ch === ')')
	{
		stream.next();
		if (this.commentLevel > 0)
		{
			this.commentLevel--;
			if (this.commentLevel === 0)
				return 'comment';
		}
	}
	if (this.commentLevel > 0)
	{
		do
		{
			stream.eatWhile(/[^\(\)]+/);

			if (stream.eol())
				break;

			ch = stream.peek();

			if (ch === '(')
			{
				this.commentLevel++;
			} else if (ch === ')')
			{
				this.commentLevel--;
			}
			stream.next();
		}
		while (this.commentLevel === 0);
		return 'comment';
	}

	stream.eatWhile(/[ \t]/);

	if (is_start_of_line && stream.eol())
		return blankLineHandle(this);

	//  if (is_start_of_line)
	{

		//MATCH '==="s AT START OF LINE
		if (is_start_of_line && stream.match(reg_equalsrow, true))
			return 'EQUALSBIT';

		//MATCH SECTION NAME
		if (stream.match(reg_sectionNames, true))
		{
			this.section = stream.string.slice(0, stream.pos).trim();

		//	Check that we have the right to start this section at this point

			if (this.visitedSections.indexOf(this.section) >= 0)
			{
				logError('cannot duplicate sections (you tried to duplicate \"' + this.section.toUpperCase() + '").', this.lineNumber);
			}
			this.visitedSections.push(this.section);
			const sectionIndex = sectionNames.indexOf(this.section);
			if (sectionIndex == 0)
			{
				this.objects_section = 0;
				if (this.visitedSections.length > 1)
				{
					logError('section "' + this.section.toUpperCase() + '" must be the first section', this.lineNumber);
				}
			} else if (this.visitedSections.indexOf(sectionNames[sectionIndex - 1]) == -1)
			{
				if (sectionIndex === -1) // In theory, we can only get there if reg_sectionNames matches something not in sectionNames
				{
					logError('no such section as "' + this.section.toUpperCase() + '".', this.lineNumber);
				} else {
					logError('section "' + this.section.toUpperCase() + '" is out of order, must follow  "' + sectionNames[sectionIndex - 1].toUpperCase() + '" (or it could be that the section "'+sectionNames[sectionIndex - 1].toUpperCase()+`"is just missing totally.  You have to include all section headings, even if the section itself is empty).`, this.lineNumber);                            
				}
			}

		//	Initialize the parser state for some sections depending on what has been parsed before

			if (this.section === 'sounds')
			{
				//populate names from rules
				for (var n in this.objects) {
					if (this.objects.hasOwnProperty(n))
					{
/*						if (this.names.indexOf(n)!==-1) {
							logError('Object "'+n+'" has been declared to be multiple different things',this.objects[n].lineNumber);
						}*/
						this.names.push(n);
					}
				}
				//populate names from legends
				for (var i = 0; i < this.legend_synonyms.length; i++)
				{
					var n = this.legend_synonyms[i][0];
					/*
					if (this.names.indexOf(n)!==-1) {
						logError('Object "'+n+'" has been declared to be multiple different things',this.legend_synonyms[i].lineNumber);
					}
					*/
					this.names.push(n);
				}
				for (var i = 0; i < this.legend_aggregates.length; i++)
				{
					var n = this.legend_aggregates[i][0];
					/*
					if (this.names.indexOf(n)!==-1) {
						logError('Object "'+n+'" has been declared to be multiple different things',this.legend_aggregates[i].lineNumber);
					}
					*/
					this.names.push(n);
				}
				for (var i = 0; i < this.legend_properties.length; i++)
				{
					var n = this.legend_properties[i][0];
					/*
					if (this.names.indexOf(n)!==-1) {
						logError('Object "'+n+'" has been declared to be multiple different things',this.legend_properties[i].lineNumber);
					}                           
					*/ 
					this.names.push(n);
				}
			}
			else if (this.section === 'levels')
			{
				//populate character abbreviations
				for (var n in this.objects) {
					if (this.objects.hasOwnProperty(n) && n.length == 1)
					{
						this.abbrevNames.push(n);
					}
				}

				for (var i = 0; i < this.legend_synonyms.length; i++)
				{
					if (this.legend_synonyms[i][0].length == 1)
					{
						this.abbrevNames.push(this.legend_synonyms[i][0]);
					}
				}
				for (var i = 0; i < this.legend_aggregates.length; i++)
				{
					if (this.legend_aggregates[i][0].length == 1)
					{
						this.abbrevNames.push(this.legend_aggregates[i][0]);
					}
				}
			}
			return 'HEADER';
		}

		if (this.section === undefined)
		{
			logError('must start with section "OBJECTS"', this.lineNumber);
		}

		if (stream.eol())
		{
			return null;
		}

		switch (this.section)
		{
			case 'objects':
				return this.tokenInObjectsSection(is_start_of_line, stream, mixedCase)
				break;
			case 'legend':
				return this.tokenInLegendSection(is_start_of_line, stream, mixedCase)
				break;
			case 'sounds':
				return this.tokenInSoundsSection(is_start_of_line, stream, mixedCase)
				break;
			case 'collisionlayers':
				return this.tokenInCollisionLayersSection(is_start_of_line, stream, mixedCase)
				break;
			case 'rules':
				return this.tokenInRulesSection(is_start_of_line, stream, mixedCase, ch)
				break;
			case 'winconditions':
				return this.tokenInWinconditionsSection(is_start_of_line, stream, mixedCase)
				break;
			case 'levels':
				return this.tokenInLevelsSection(is_start_of_line, stream, mixedCase, ch)
				break;
			default://if you're in the preamble
				return this.tokenInPreambleSection(is_start_of_line, stream, mixedCase)
				break;
		}
	};

	if (stream.eol()) {
		return null;
	}
	if (!stream.eol()) {
		stream.next();
		return null;
	}
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
