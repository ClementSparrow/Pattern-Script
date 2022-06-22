// WIP TODO: the metadata keys that can be set in the Meta tab should be parsed only when the game is compiled during loading,
// not when codemirror parses the code.

const metadata_with_mixedCase_value = ['youtube', 'author', 'homepage', 'title', 'game_uri']
const metadata_with_value = ['background_color','text_color','title_color','author_color','keyhint_color','key_repeat_interval','realtime_interval','again_interval','flickscreen','zoomscreen','color_palette','sprite_size','level_title_style','auto_level_titles']
const metadata_default_values = { auto_level_titles: 'always' }
const metadata_accepted_values = { auto_level_titles: ['named'], level_title_style: ['noheader', 'header'] }
const metadata_without_value = ['run_rules_on_level_start','norepeat_action','require_player_movement','debug','verbose_logging','throttle_movement','noundo','noaction','norestart','show_level_title_in_menu']

// This function does not rely on CodeMirror's API
PuzzleScriptParser.prototype.registerMetaData = function(key, value, line)
{
	this.metadata_keys.push(key)
	this.metadata_values.push(value)
	this.metadata_lines.push(line || this.lineNumber)
}



// ------ PREAMBLE -------

PuzzleScriptParser.prototype.tokenInPreambleSection = function(is_start_of_line, stream)
{
	if ( ! is_start_of_line ) // we've already parsed the whole line, now we are necessarily in the metadata value's text
	{
		stream.match(reg_notcommentstart, true) // TODO: we probably want to read everything till the end of line instead, because comments should be forbiden on metadata lines as it prevents from putting parentheses in the metadata text...
		return (this.tokenIndex == -1) ? 'ERROR' : 'METADATATEXT'
	}

//	Get the metadata key
	const token = this.parse_keyword_or_identifier(stream)
	if (token === null)
	{
		stream.match(reg_notcommentstart, true);
		return 'ERROR'; // TODO: we should probably log an error, here? It implies that if a line starts with an invalid character, it will be silently ignored...
	}

	if ( metadata_without_value.includes(token) )
	{
		this.registerMetaData(token, 'true') // TODO: return the value instead of a string?
		this.tokenIndex = -1
		return 'METADATA'
	}
	if ( metadata_with_mixedCase_value.includes(token) )
	{
		stream.string = this.mixedCase
	}
	else if ( ! metadata_with_value.includes(token) )
	{
		stream.match(reg_notcommentstart, true)
		this.logError(['unknown_metadata'])
		return 'ERROR'
	}

	this.tokenIndex = 1

	const m2 = stream.match(reg_notcommentstart, false) // TODO: to end of line, not comment (see above)

	if (m2 === null)
	{
		const default_value = metadata_default_values[token]
		if (typeof default_value !== 'undefined')
			this.registerMetaData(token, default_value)
		else
			this.logError('MetaData "'+token+'" needs a value.')
		return 'METADATA'
	}

	const param = m2[0].trim()
	const accepted_values = metadata_accepted_values[token]
	if ( (typeof accepted_values === 'undefined') || accepted_values.includes(param) )
	{
		this.registerMetaData(token, param)
	}
	else
	{
		this.logError(['invalid_preamble_option', param, token])
		this.tokenIndex = -1
	}
	return 'METADATA'
}


PuzzleScriptParser.prototype.finalizeMetaData = function(metadata_name, default_value, error_id, validate_func)
{
	const key_index = this.metadata_keys.indexOf(metadata_name)
	if (key_index < 0)
	{
		this.registerMetaData(metadata_name, default_value, null)
		return
	}

	const value_str = this.metadata_values[key_index]
	const value = validate_func(value_str)
	if (value === null)
	{
		this.logError([error_id, value_str, default_value])
		this.metadata_values[key_index] = default_value
		this.metadata_lines[key_index] = null // do not delete the line
		return
	}

	this.metadata_values[key_index] = value
}

// WIP TODO: these are the metadata that are used at a later stage during the parsing. Soon, these metadata will be
// managed by the metadata_tabmanager (when the editor is opened) or loaded directly by the hosting_manager into game_def.
// So, we should instead rely on the value in game_def, since it will be set to the default value if not specified explicitly.
// Error checking would then be the last concern remaining for finalizePreamble, and only holds for sprite_size. Since the same
// error checking applies to other diemension metadata like flickscreen, it should be moved directly into tokenInPreambleSection.
PuzzleScriptParser.prototype.finalizePreamble = function()
{
// WIP TODO: we should simply fill the html fields if a valid value is found, otherwise
// we let the tabmanager fill in default values.
	this.finalizeMetaData('sprite_size', [5, 5], 'not_a_sprite_size',
		function(s)
		{
			const result = s.split('x').map(str => parseInt(str))
			return result.some(isNaN) ? null : result
		}
	)
	this.finalizeMetaData('level_title_style', 'header', null, s => s)
	this.finalizeMetaData('color_palette', 'arnecolors', 'palette_not_found',
		function(val)
		{
			const palette_num = parseInt(val)
			if ( ( ! isNaN(palette_num) ) && (palette_num > 0) && (palette_num <= colorPalettesAliases.length) )
			{
				val = colorPalettesAliases[palette_num-1]
			}
			return (colorPalettes[val] === undefined) ? null : val
		}
	)
}

// This is called by the compiler, not by the parser.
function twiddleMetaData(state)
{
	for (const [i, key] of state.metadata_keys.entries())
	{
		if ( ! (key in metadata_in_tab) ) // WIP TODO: we should only do that in the editor, not in the player!
		{
			state.metadata_lines[i] = null // don't delete
		}
		game_def[key] = state.metadata_values[i]
	}
	
	// remove the lines from the file that have been used to fill in the UI fields
	let code_txt = editor_tabmanager.getContent().split('\n')
	for (let i=state.metadata_lines.length-1; i>=0; --i)
	{
		if (state.metadata_lines[i] === null)
			continue
		code_txt.splice(i, 1)
	}
	editor_tabmanager.setContent(code_txt.join('\n'))

	delete state.metadata_keys
	delete state.metadata_values
	delete state.metadata_lines

	// Below are the metadata that don't yet have an UI in the Meta tab.

	if (game_def.flickscreen !== undefined)
	{
		const coords = game_def.flickscreen.split('x')
		game_def.flickscreen = [parseInt(coords[0]), parseInt(coords[1])]
	}
	if (game_def.zoomscreen !== undefined)
	{
		const coords = game_def.zoomscreen.split('x')
		game_def.zoomscreen = [parseInt(coords[0]), parseInt(coords[1])]
	}
	;[ sprite_width, sprite_height ] = game_def['sprite_size']


	// get color palette from its name
	game_def.game_palette = colorPalettes[game_def.color_palette]

	const color_metadata = [
		[ 'background_color', '#000000FF' ],
		[ 'text_color', '#FFFFFFFF'],
		[ 'title_color', undefined],
		[ 'author_color', undefined],
		[ 'keyhint_color', undefined],
	]
	for (const [metadata_key, default_color] of color_metadata)
	{
		const color = (game_def[metadata_key] !== undefined) ? colorToHex(game_def.game_palette, game_def[metadata_key]) : (default_color || game_def.text_color)
		if ( isColor(color) )
		{
			game_def[metadata_key] = color
		}
		else
		{
			const final_color = (default_color || game_def.text_color)
			logError(metadata_key + ' in incorrect format - found '+color+", but I expect a color name (like 'pink') or hex-formatted color (like '#1412FA').  Defaulting to "+final_color+'.')
			game_def[metadata_key] = final_color
		}
	}
}
