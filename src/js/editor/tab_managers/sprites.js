SpriteWidget = function(container, item_def)
{
	this.matrix_textarea = document.createElement('textarea')
	this.matrix_textarea.setAttribute('cols', sprite_width)
	this.matrix_textarea.setAttribute('rows', sprite_height)
	this.matrix_textarea.setAttribute('autocomplete', 'off')
	this.matrix_textarea.setAttribute('spellcheck', 'false')
	this.matrix_textarea.setAttribute('minlength', '1')
	this.matrix_textarea.value = '.'
	// WIP TODO: add callback when the content of the textarea changes, tu update the visual sprite editor and redraw the game
	// also add error checking and copy/paste options
	container.appendChild(this.matrix_textarea)

	// WIP TODO: have a dropdown menu to select the palette that will be used in the visual sprite editor.
	// The menu should only contain the palettes that have enough colors in them compared to what the sprite uses.
	// Maybe sort the menu by the number of colors in the palette?
	// Of course, it requires to have a colors or palettes tab…
	this.sprite_editor_container = document.createElement('div')
	this.sprite_editor_container.setAttribute('width', '500px')
	this.sprite_editor_container.setAttribute('height', '200px')
	this.sprite_editor_canvas = document.createElement('canvas')
	this.sprite_editor_container.appendChild(this.sprite_editor_canvas)
	container.appendChild(this.sprite_editor_container)
}

SpriteWidget.prototype = {

	finalize: function(item_def)
	{
		this.sprite_editor = new SpriteEditor(this.sprite_editor_canvas)
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
