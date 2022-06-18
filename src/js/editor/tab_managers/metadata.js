function isValidHttpsUrl(string) // adapted from Pavlo https://stackoverflow.com/a/43467144/5306613
{
	var url
	try {
		url = new URL(string)
	} catch (_) {
		return 'Your browser does not recognize this as a valid URL. Maybe you forgot the https:// at the beginning?'
	}
	if (url.protocol !== 'https:')
		return 'Only the https: protocol is allowed!'
	const hostname = url.hostname
	return ( hostname.includes('.') && ! hostname.includes('..') && ! hostname.endsWith('.') ) ? ''
		: 'This is technically a valid website URL, but please use a more conventional one.'
}


// keyword, is_mandatory?, default_value, check_function, html_element_attribute
const metadata_in_tab = {
// { name: 'About the game', content: [
	title: [ true, 'My Game', null, 'value' ],
	author: [ true, 'My Name Here', null, 'value' ],
	homepage: [ false, '', isValidHttpsUrl, 'value' ],
	description: [ false, '', null, 'value' ],
	// ['vignette', false, null, null ],
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
	run_rules_on_level_start: [ true, false, null, 'checked' ],
	throttle_movement: [ true, false, null, 'checked' ], // TODO: should be grayed if realtime_interval==0
	noaction: [ true, false, null, 'checked' ], // TODO: should be automatically detected.
	noundo: [ true, false, null, 'checked' ],
	norestart: [ true, false, null, 'checked' ],
	norepeat_action: [ true, false, null, 'checked' ], // TODO: should be grayed if noaction is set
	require_player_movement: [ true, false, null, 'checked' ],
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
	this.html_container = html_container
	this.content = {}
	html_container.oninput = (event) => this.contentUpdated()
}

MetaDataTabManager.prototype =
{

contentUpdated: function()
{
	for (const [keyword, [is_mandatory, default_value, check_func, html_node_field]] of Object.entries(metadata_in_tab))
	{
		const field = document.querySelector('[name="meta_'+keyword+'"]')
		const field_value = field[html_node_field]
		const [ mandatory_test_field, mandatory_test_value] = ({value:['value', ''], checked:['indeterminate', true]})[html_node_field]
		const error_msg = ( ! is_mandatory || (field[mandatory_test_field] != mandatory_test_value) )
			? (check_func === null) ? '' : check_func(field_value)
			: 'This field is required. Please fill it!'
		field.setCustomValidity(error_msg) // '' if the field is valid
		if (error_msg.length == 0)
		{
			this.content[keyword] = field_value
			continue
		}
// WIP TODO: the field is invalid, we should add a sign with the message next to it!
		this.content[keyword] ||= default_value
	}
},

setContent: function(content)
{
	if (content === undefined)
		content = {}
	this.content = content
	for (const [keyword, [is_mandatory, default_value, check_func, html_node_field]] of Object.entries(metadata_in_tab))
	{
		document.querySelector('[name="meta_'+keyword+'"]')[html_node_field] = content[keyword] || default_value
	}
},
getContent: function() { return this.content },
setLoading: function() { },
removeFocus: function() { },
setLightMode: function(mode) { },
}
