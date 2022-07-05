
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
		value: item_def.matrix.join('\n'),
		events: { input: (e) => this.updateFromTextArea(e.target.value) },
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
		const editor_view = this.sprite_editor.content
		editor_view.glyphSelectedIndex = clamp(0, editor_view.glyphSelectedIndex, palette.length-1)
		editor_view.content.palette = palette.map(color => 'rgb('+color.join(',')+')')
		this.sprite_editor.redraw()
	},

	updateFromTextArea: function(new_text_matrix)
	{
		if (/[^.\d\n\P{Separator}]/.test(new_text_matrix))
		{
			console.log('invalid character')
			return
		}
		const new_matrix = rectanglify(new_text_matrix.trim().split('\n'))
		this.widget.def.matrix = new_matrix
		this.updateSpriteEditorFromModel(new_matrix)
	},
	updateSpriteEditorFromModel: function(new_matrix)
	{
		const new_pixels = spriteMatrixTextLinesToArrays(new_matrix)
		const editor_view = this.sprite_editor.content.content
		editor_view.height = new_pixels.length
		editor_view.width = new_pixels[0].length
		editor_view.pixels = new Int32Array([].concat(...new_pixels))
		this.sprite_editor.resize_canvas()
	},

	updateFromSpriteEditor: function()
	{
		const editor_view = this.sprite_editor.content.content
		let result = ''
		for(let y = 0, i=0; y<editor_view.height; ++y)
		{
			for (let x=0; x<editor_view.width; ++x, ++i)
			{
				const v = editor_view.pixels[i]
				result += ((v>=0) && (v<=9)) ? v+'' : '.'
			}
			result += '\n'
		}
		result = result.substring(0, result.length-1)
		this.widget.def.matrix = result.split('\n')
		this.matrix_textarea.value = result
	},

	finalize: function(item_def)
	{
		const colors = palettes_tabmanager.connectSprite(this, this.palette_name)
		const palette = (colors === undefined) ? [] : colors.map(color => 'rgb('+color.join(',')+')')
		this.sprite_editor = new SpriteEditor(this.sprite_editor_canvas, undefined, undefined, palette)
		this.sprite_editor.content.onChange = () => this.updateFromSpriteEditor()
		this.updateSpriteEditorFromModel(item_def.matrix)
	},

	deepCopy: function(item)
	{
		return { matrix: Array.from(item.matrix) }
	},

	sameItems: function(item1, item2)
	{
		return item1.matrix.join('') == item2.matrix.join('')
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
