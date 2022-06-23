function isValidHttpsUrl(string) // adapted from Pavlo https://stackoverflow.com/a/43467144/5306613
{
	if (string.startsWith('www.'))
		string = 'https://'+string

	let url
	try {
		url = new URL(string)
	} catch (_) {
		return ['Your browser does not recognize this as a valid URL. Maybe you forgot the https:// at the beginning?', string]
	}

	switch (url.protocol)
	{
		case 'http:':
			return [ '', 'https:'+url.href.substring(5) ]
		case 'https:':
			const hostname = url.hostname
			return [
				( hostname.includes('.') && ! hostname.includes('..') && ! hostname.endsWith('.') ) ? ''
					: 'This is technically a valid website URL, but please use a more conventional one.',
				url.href
			]
		default:
			return [ 'Only the https: protocol is allowed!', url.href ]
	}
}

function alwaysValid(string) { return ['', string] }


// keyword, is_mandatory?, default_value, check_function, html_element_attribute
const metadata_in_tab = {
// { name: 'About the game', content: [
	title: [ true, 'My Game', alwaysValid, 'value' ],
	author: [ true, 'My Name Here', alwaysValid, 'value' ],
	homepage: [ false, '', isValidHttpsUrl, 'value' ],
	description: [ false, '', alwaysValid, 'value' ],
	// ['vignette', false, alwaysValid, null ],
// ] },
// { name: 'Colors', content: [
// 	color_palette: [ true, 'arne', check_palette_name ],
// 	background_color: [ true, '#000000FF', color_picker ],
// 	text_color: [ true, '#FFFFFFFF', color_picker ],
// 	title_color: [ false, undefined(text_color), color_picker ],
// 	author_color: [ false, undefined(text_color), color_picker ],
// 	keyhint_color: [ false, undefined(text_color), color_picker ],
// ] },
// { name: 'Timing', content: [
// 	key_repeat_interval: [ true, 0.15, is_number ], // TODO: we should have a value to forbid key repeats?
// 	realtime_interval: [ true, 0, is_number ],
// 	again_interval: [ true, 0.15, is_number ],
// ] },
// { name: 'Dimensions', content: [
// 	flickscreen: [ false, null, check_dim ],
// 	zoomscreen: [ false, null, check_dim ],
// 	sprite_size: [ true, [5, 5], check_dim ], // TODO: rename it
// ] },
// { name: 'Gameplay options', content: [
	run_rules_on_level_start: [ true, false, alwaysValid, 'checked' ],
	throttle_movement: [ true, false, alwaysValid, 'checked' ], // TODO: should be grayed if realtime_interval==0
	noaction: [ true, false, alwaysValid, 'checked' ], // TODO: should be automatically detected.
	noundo: [ true, false, alwaysValid, 'checked' ],
	norestart: [ true, false, alwaysValid, 'checked' ],
	norepeat_action: [ true, false, alwaysValid, 'checked' ], // TODO: should be grayed if noaction is set
	require_player_movement: [ true, false, alwaysValid, 'checked' ],
// ] },
// // obsolete:
// // 	youtube false '' URL // Broken, do not use. // TODO: add a music file selector instead
// // 	debug true false null // Use the buton above the console instead.
// // 	verbose_logging true false null // Use the buton above the console instead.
// // hidden:
// // 	save_date
// // 	save_name
// // 	save_format_version
// // 	extensions_used
}



function MetaDataTabManager(html_container)
{
	this.name = 'meta'
	this.html_container = html_container
	html_container.oninput = (event) => this.updateModelFromView()

	// Set custom getters and setters for the game_def properties that will be managed by the HTML fields
	this.content = {}
	for (const [keyword, [is_mandatory, default_value, check_func, html_node_field]] of Object.entries(metadata_in_tab))
	{
		const desc = Object.getOwnPropertyDescriptor(game_def, keyword)
		let new_desc = { enumerable: true, configurable: true, }
		if ( (desc !== undefined) && (desc.set||desc.get) )
		{
			Object.defineProperty(this.content, keyword, desc)
		}
		this.content[keyword] = game_def[keyword]
		new_desc.get = () => this.content[keyword]
		new_desc.set = (val) => { this.updateModelSafely(keyword, val, false) }
		Object.defineProperty(game_def, keyword, new_desc)
	}
}

MetaDataTabManager.prototype =
{

updateHTMLField: function(keyword, html_node_field, value)
{
	document.querySelector('[name="meta_'+keyword+'"]')[html_node_field] = value
},

updateModelFromView: function()
{
	for (const [keyword, [is_mandatory, default_value, check_func, html_node_field]] of Object.entries(metadata_in_tab))
	{
		const field = document.querySelector('[name="meta_'+keyword+'"]')
		const field_value = field[html_node_field]
		const [ mandatory_test_field, mandatory_test_value] = ({value:['value', ''], checked:['indeterminate', true]})[html_node_field]
		const [error_msg, fixed_value] = ( ! is_mandatory || (field[mandatory_test_field] != mandatory_test_value) )
			? check_func(field_value)
			: ['This field is required. Please fill it!', field_value]
		field.setCustomValidity(error_msg) // '' if the field is valid
		if (error_msg.length == 0)
		{
			if (fixed_value !== this.content[keyword])
			{
				// WIP TODO: do not update the field while it is edited, only when it is validated or the user moves to another field?
				this.content[keyword] = fixed_value
				this.updateHTMLField(keyword, html_node_field, fixed_value)
			}
			continue
		}
		// WIP TODO: the field is invalid, we should add a sign with the message next to it!
		// we should also say what value will be used (the last valid one if there is one, otherwise the default value)
	}
	tabs.checkDirty()
},

updateModelSafely: function(keyword, val, use_default)
{
	const [is_mandatory, default_value, check_func, html_node_field] = metadata_in_tab[keyword]
	const [error_msg, fixed_value] = check_func( (val === undefined) ? default_value : val )
	if (error_msg.length == 0)
	{
		this.content[keyword] = fixed_value
	}
	else if (use_default === true)
	{
		this.content[keyword] = default_value
	}
	this.updateHTMLField(keyword, html_node_field, fixed_value)
},

// Fills in the fields with the provided content or default values.
// Only call this function when loading a game.
// It does not trigger updateModelFromView, but the fields are updated directly when the model (game_def) is modified.
setContent: function(content)
{
	for (const keyword of Object.keys(metadata_in_tab))
	{
		// TODO: this will call the check_func, which SHOULD filter out dangerous values (like code injection)!
		this.updateModelSafely(keyword, content[keyword], true)
	}
},
getContent: function() { return Object.fromEntries(Object.keys(metadata_in_tab).map(k => [k, game_def[k]])) },
checkDirty: function(saved) { return Object.keys(metadata_in_tab).some( (k) => saved[k] != game_def[k]) },
setLoading: function() { },
removeFocus: function() { },
setLightMode: function(mode) { },
}
