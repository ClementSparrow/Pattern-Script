
SpriteWidget = function(container, item_def)
{
	this.palette_name = Object.keys(game_def.palettes)[0] || 'default_palette'
	// WIP TODO: we cannot put images in "select" elements, so it would be nice to display a grid of palette icons
	// with mouseovers to display the name in the palette name text field and in the sprite
	const palette_selector_container = make_HTML('div', {classes:['palette_selector']})
	palette_selector_container.appendChild(
		make_name_inputline(
			'Edit with palette:',
			this.palette_name,
			{ change: (e) => this.changePaletteName(e.target.value) },
			{ list: 'palette_names' }
		)
	)
	palette_selector_container.appendChild( make_HTML('div', {classes:['palette_selector_grid']}) )
	container.appendChild(palette_selector_container)

	this.matrix_textarea = make_HTML('textarea', {
		attr: {
			cols: Math.max(item_def.matrix.map(l => l.length)),
			rows: item_def.matrix.length,
			autocomplete: 'off', spellcheck: 'false',
			minlength: '1',
		},
		value: item_def.matrix.join('\n')
	})
	// WIP TODO: add callback when the content of the textarea changes, to update the visual sprite editor and redraw the game
	// also add error checking and copy/paste options
	container.appendChild(this.matrix_textarea)

	// WIP TODO: have a dropdown menu to select the palette that will be used in the visual sprite editor.
	// The menu should only contain the palettes that have enough colors in them compared to what the sprite uses.
	// Maybe sort the menu by the number of colors in the palette?
	// WIP TODO: the canvas of the sprite editor should be resizable (and the size remembered for new sprites).
	this.sprite_editor_canvas = make_HTML('canvas', { style: {width: '500px', height: '200px'} })
	container.appendChild(this.sprite_editor_canvas)
}

SpriteWidget.prototype = {

	changePaletteName: function(new_name)
	{
		palettes_tabmanager.disconnectSprite(this, this.palette_name)
		this.palette_name = new_name
		const palette = palettes_tabmanager.connectSprite(this, new_name)
		if (palette !== undefined)
			this.updatePalette(palette)
	},

	updatePalette: function(palette)
	{
		this.sprite_editor.content.content.palette = palette.map(color => 'rgb('+color.join(',')+')')
		this.sprite_editor.redraw()
	},

	finalize: function(item_def)
	{
		const colors = palettes_tabmanager.connectSprite(this, this.palette_name)
		const palette = (colors === undefined) ? [] : colors.map(color => 'rgb('+color.join(',')+')')
		this.sprite_editor = new SpriteEditor(this.sprite_editor_canvas, undefined, undefined, palette)
		this.sprite_editor.resize_canvas()
	},

	sameItems: function(item1, item2)
	{

	},

}


function SpritesTabManager(html_list)
{
	ListTabManager.call(this, html_list, 'sprites', 'Sprite', SpriteWidget)
}
SpritesTabManager.prototype = Object.create(ListTabManager.prototype)

SpritesTabManager.prototype.addNewBlankWidget = function()
{
	this.addNewWidget('', { matrix: new Array(sprite_height).fill('.'.repeat(sprite_width)) })
}

SpritesTabManager.prototype.widgetContentChanged = function(name_field, widget)
{
	// TODO
}

SpritesTabManager.prototype.onRemoveWidget = function(widget, name)
{
	// TODO
}
