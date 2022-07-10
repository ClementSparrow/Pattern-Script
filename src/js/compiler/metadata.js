// This is called by the compiler, not by the parser.
// It can be ignored in the exported games, where the resulting game_def is provided directly
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
	const code_txt = editor_tabmanager.getContent().split('\n')
	const initial_code_txt_length = code_txt.length
	for (let i=state.metadata_lines.length-1; i>=0; --i)
	{
		if (state.metadata_lines[i] === null)
			continue
		code_txt.splice(i, 1)
	}
	// WIP TODO: setContent scrolls back the editor to the top of the document. That's not a problem when we compile on load,
	// but it is an issue when we compile on user's input. But in that case, unless the user adds an obsolete preamble command
	// in the code, there will be no line deleted, so we can simply avoid setContent as a quick fix.
	if (code_txt.length < initial_code_txt_length)
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
