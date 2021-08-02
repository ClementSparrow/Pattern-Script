function ScreenLayout()
{
	// content of the virtual screen
	this.content = empty_Screen
	// layout parameters
	this.magnification = 0
	this.margins = [ 0, 0]
}

var forceRegenImages = false;

// Sets:
// - all members of this.
// - dirty state: forceRegenImages, oldcellheight, oldcellwidth, oldtextmode, oldfgcolor
// Uses:
// - level
// - state.metadata
// - state.abbrevNames
ScreenLayout.prototype.resize = function(canvas_size)
{
	// Update content
	// ==============

	// TODO: it should not be the role of this class to update the content: it should be done by the game engine

	this.content = empty_Screen
	if (state !== undefined)
	{
		if (state.metadata.flickscreen !== undefined)
		{
			this.content = tiledWorld_Screen
		}
		else if (state.metadata.zoomscreen  !== undefined)
		{
			this.content = cameraOnPlayer_Screen
		}
		else
		{
			this.content = level_Screen
		}
		if (levelEditorOpened && this.content !== null)
		{
			levelEditor_Screen.content = this.content
			this.content = levelEditor_Screen
		}
	}

	if (textMode)
	{
		this.content = textMode_Screen
	}

	// Update layout parameters
	// ========================

	const virtual_screen_size = this.content.get_virtual_screen_size.call(this.content)
	const pixel_sizes = virtual_screen_size.map( (s, i) => (canvas_size[i] / s) )
	this.magnification = Math.max(1, Math.floor(Math.min(...pixel_sizes)) )
	this.margins = canvas_size.map( (s, i) => Math.floor( (s - virtual_screen_size[i]*this.magnification)/2 ) )

	// Should we update sprites?
	// =========================

	if ( (this.content.last_magnification !== this.magnification) || forceRegenImages)
	{
		forceRegenImages = false
		regenSpriteImages() // TODO: I want to get rid of that by rendering the virtual screen in an offscreen canvas at 1:1 pixel ratio, and then scaling the resulting image
		// TODO: call a content-specific regen function
	}

	this.content.last_magnification = this.magnification
}

// TODO: add pickup methods

var empty_Screen = {
	last_magnification: null,
	screen_type: 'empty',
	get_virtual_screen_size: () => [ 0, 0 ],
	redraw: () => null
}

var textMode_Screen = {
	last_magnification: null,
	screen_type: 'text',
	get_nb_tiles: () => [ titleWidth, titleHeight ],
	get_virtual_screen_size: () => [ titleWidth*(font_width+1), titleHeight*(font_height+1) ],
	redraw: redraw_textmode
}

// TODO: level_Screen, tiledWorld_Screen, and cameraOnPlayer_Screen should be the same object/class, with a member defining how the viewport is computed
var level_Screen = {
	last_magnification: null,
	screen_type: 'level',
	get_nb_tiles: () => [ level.width, level.height ],
	get_virtual_screen_size: function()
	{
		const [w,h] = this.get_nb_tiles();
		return [ w*sprite_width, h*sprite_height ];
	},
	get_viewport: () => [0, 0, level.width, level.height],
	redraw: redraw_level_viewport
}

var tiledWorld_Screen = {
	last_magnification: null,
	screen_type: 'flickscreen',
	get_nb_tiles: () => state.metadata.flickscreen,
	get_virtual_screen_size: level_Screen.get_virtual_screen_size,
	get_viewport: set_camera_on_player,
	get_viewport_for_focus_point: function(px, py)
	{
		const [w, h] = this.get_nb_tiles()
		return [ Math.floor(px/w) * w, Math.floor(py/h) * h ];
	},
	redraw: redraw_level_viewport
}

var cameraOnPlayer_Screen = {
	last_magnification: null,
	screen_type: 'zoomscreen',
	get_nb_tiles: () => state.metadata.zoomscreen,
	get_virtual_screen_size: level_Screen.get_virtual_screen_size,
	get_viewport: set_camera_on_player,
	get_viewport_for_focus_point: function(px, py)
	{
		const [w, h] = this.get_nb_tiles()
		const result = [
			Math.max( 0, Math.min(px - Math.floor(w/2), level.width  - w) ),
			Math.max( 0, Math.min(py - Math.floor(h/2), level.height - h) )
		]
		return result;
	},
	redraw: redraw_level_viewport
}

// TODO: the level editor should be split into a legend_EditorScreen and a levelContent_EditorScreen
var levelEditor_Screen = {
	content: empty_Screen,
	editorRowCount: 1,
	hovered_level_cell: null,
	hovered_glyph_index: null,
	hovered_level_resize: null,
	last_magnification: null,
	screen_type: 'levelEditor',
	get_nb_tiles: function()
	{
		const [w, h] = this.content.get_nb_tiles()
		this.editorRowCount = Math.ceil( state.abbrevNames.length / (w+1) ) // we could do better than that and use more space horizontally
		return [ w + 2, h + 2 + this.editorRowCount ];
	},
	get_virtual_screen_size: level_Screen.get_virtual_screen_size,
	redraw: redraw_levelEditor
}

var screen_layout = new ScreenLayout()

