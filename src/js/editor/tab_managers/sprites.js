SpriteWidget = function(container, item_def)
{
	// WIP TODO: we cannot put images in "select" elements, so it would be nice to display a grid of palette icons
	// with mouseovers to display the name in the palette name text field and in the sprite
	const palette_selector_container = make_HTML('div', {classes:['palette_selector']})
	{
		const palette_selector_label = make_HTML('label', {attr: {required: ''}, text: 'Edit with palette:'})
		this.palette_name = make_HTML('input', {
			attr: { type: 'text', list: 'palette_names' },
			value: Object.keys(game_def.palettes)[0] || 'default_palette',
			events: { change: (e) => this.changePalette() }
		})
		palette_selector_label.appendChild(this.palette_name)
		palette_selector_container.appendChild(palette_selector_label)
		
		palette_selector_container.appendChild( make_HTML('div', {classes:['palette_selector_grid']}) )
	}
	container.appendChild(palette_selector_container)

	this.matrix_textarea = make_HTML('textarea', {
		attr: {
			cols: sprite_width, rows: sprite_height,
			autocomplete: 'off', spellcheck: 'false',
			minlength: '1',
		},
		value: '.'
	})
	// WIP TODO: add callback when the content of the textarea changes, tu update the visual sprite editor and redraw the game
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

	changePalette: function()
	{
		const palette_name = this.palette_name.value
		const palette = game_def.palettes[palette_name]
		if (palette === undefined)
			return
		this.sprite_editor.content.content.palette = palette
		this.sprite_editor.redraw()
	},

	finalize: function(item_def)
	{
		const palette = game_def.palettes[this.palette_name.value]
		this.sprite_editor = new SpriteEditor(this.sprite_editor_canvas, undefined, undefined, palette)
		this.sprite_editor.resize_canvas()
	},

	toDef: function(widget)
	{

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

SpritesTabManager.prototype.addNewBlankSpriteWidget = function()
{
	this.addNewWidget({
		name: '',
		matrix: [[-1]],
	})
}
