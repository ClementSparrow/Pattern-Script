//	------- METADATA --------

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

// TODO: merge with twiddleMetaData defined in compiler.js. Also, it should be done directly as we parse, not after the preamble.
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
// WIP TODO: we should take all the keys that have been found and transfer them to the HTML fields
// WIP TODO: then, in another function after the parsing, we should remove from the text all
// the lines that contained preamble declarations that have been transfered to the HTML,
// taking the list backward (so that the line numbers stay valid).
// note that metadata can be redeclared, so normally we should log multiple lines...
}

// This is called by the compiler, not by the parser.
function twiddleMetaData(state)
{
	let tabcontent = metadata_tabmanager.getContent()
	let newmetadata = {}
	for (const [i, key] of state.metadata_keys.entries())
	{
		if (key in metadata_in_tab)
		{
			tabcontent[key] = state.metadata_values[i]
		}
		else
		{
			state.metadata_lines[i] = null // don't delete
		}
		newmetadata[key] = state.metadata_values[i] // WIP TODO: once the values of the metadata_tabmanager will be used instead of state.metadata, move that line in the else block above.
	}
	
	metadata_tabmanager.setContent(tabcontent) // fill in the UI fields

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

	if (newmetadata.flickscreen !== undefined)
	{
		const coords = newmetadata.flickscreen.split('x')
		newmetadata.flickscreen = [parseInt(coords[0]), parseInt(coords[1])]
	}
	if (newmetadata.zoomscreen !== undefined)
	{
		const coords = newmetadata.zoomscreen.split('x')
		newmetadata.zoomscreen = [parseInt(coords[0]), parseInt(coords[1])]
	}
	[ sprite_width, sprite_height ] = newmetadata['sprite_size']


	// get colorpalette name
	// TODO: move that in the parser so that it can display the exact colors
	let colorPalette = colorPalettes.arnecolors
	if ('color_palette' in newmetadata)
	{
		let val = newmetadata.color_palette
		if (val in colorPalettesAliases)
		{
			val = colorPalettesAliases[val]
		}
		if (colorPalettes[val] === undefined)
		{
			logError(['palette_not_found', val]) // WIP TODO: use the line number of the palette declaration, and don't delete the line
		}
		else
		{
			colorPalette = colorPalettes[val]
		}
	}
	newmetadata.color_palette = colorPalette

	const color_metadata = [
		[ 'background_color', 'bgcolor', '#000000FF' ],
		[ 'text_color', 'fgcolor', '#FFFFFFFF'],
		[ 'title_color', 'titlecolor', undefined],
		[ 'author_color', 'authorcolor', undefined],
		[ 'keyhint_color', 'keyhintcolor', undefined],
	]
	for (const [metadata_key, state_key, default_color] of color_metadata)
	{
		const color = (metadata_key in newmetadata) ? colorToHex(colorPalette, newmetadata[metadata_key]) : (default_color || newmetadata.fgcolor)
		if ( isColor(color) )
		{
			newmetadata[state_key] = color
		}
		else
		{
			const final_color = (default_color || newmetadata.fgcolor)
			logError(metadata_key + ' in incorrect format - found '+color+", but I expect a color name (like 'pink') or hex-formatted color (like '#1412FA').  Defaulting to "+final_color+'.')
			newmetadata[state_key] = final_color
		}
		state[state_key] = newmetadata[state_key] // WIP TODO: stop using these and delete this line
	}

	state.metadata = newmetadata

	// now we need to fill in the fields for all meta_data that have an UI field, and remove the corresponding line(s) from the file, in reverse order.
}
