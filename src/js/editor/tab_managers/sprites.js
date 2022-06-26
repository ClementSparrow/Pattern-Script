function SpritesTabManager(html_list)
{
	this.html_list = html_list
}

SpritesTabManager.prototype = {

	addNewSpriteWidget: function(sprite_def)
	{
		// WIP TODO
		const widget = document.createElement('li')
		if (sprite_def.name.length > 0)
		{
			widget.setAttribute('data-name', sprite_def.name)
			game_def.sprites.push(sprite_def)
		}

		const name_label = document.createElement('label')
		name_label.innerText = 'Sprite name:'
		const name_field = document.createElement('input')
		name_field.setAttribute('type', 'text')
		name_field.value = sprite_def.name
		// WIP TODO: add callback when the name changes, because it can now become a name used in the objects
		name_label.appendChild(name_field)
		widget.appendChild(name_label)

		const matrix_textarea = document.createElement('textarea')
		matrix_textarea.setAttribute('cols', sprite_width)
		matrix_textarea.setAttribute('rows', sprite_height)
		matrix_textarea.setAttribute('autocomplete', 'off')
		matrix_textarea.setAttribute('spellcheck', 'false')
		matrix_textarea.setAttribute('minlength', '1')
		matrix_textarea.value = '.'
		// WIP TODO: add callback when the content of the textarea changes, tu update the visual sprite editor and redraw the game
		// also add error checking and copy/paste options
		widget.appendChild(matrix_textarea)

		const sprite_editor_container = document.createElement('div')
		sprite_editor_container.setAttribute('width', '500px')
		sprite_editor_container.setAttribute('height', '200px')
		const sprite_editor_canvas = document.createElement('canvas')
		sprite_editor_container.appendChild(sprite_editor_canvas)
		widget.appendChild(sprite_editor_container)

		const delete_button = document.createElement('button')
		delete_button.innerText = 'delete sprite'
		delete_button.addEventListener('click', (e) => this.removeSprite(widget, sprite_def.name) )
		widget.appendChild(delete_button)

		this.html_list.appendChild(widget)

		const this_sprite_editor = new SpriteEditor(sprite_editor_canvas)
		this_sprite_editor.resize_canvas()
	},

	addNewBlankSpriteWidget: function(sprite_def)
	{
		this.addNewSpriteWidget({
			name: '',
			matrix: [[-1]],
		})
	},

	// WIP TODO: the delete button should be grayed if the sprite is used, otherwise it can cause issues with live update
	removeSprite: function(widget, name)
	{
		this.html_list.removeChild(widget)
		if (name.length > 0)
			delete game_def.sprites[name]
	},

	setContent: function(content)
	{
		this.html_list.textContent = ''
		game_def.sprites = {}
		content.forEach(sprite_def => this.addNewSpriteWidget(sprite_def))
		// Or simply set the content of game_def.sprites and set getters and setters in the constructor so that modifying
		// a sprite in game_def.sprites automatically updates the widgets? I don't think it's a good idea, here, since the
		// parser will not extract the sprites and the player will not change the sprites (and even if sprites could change
		// dynamically in the game, we would not want that to change the game's definition in the editor).
		// So it seems simpler to only have setContent that will change game_def.sprites and the Sprites tab widgets that
		// also update game_def.sprites.
	},

	getContent: function()
	{
		return Array.from(this.html_list.querySelectorAll('li[data-name]')).map(widget => SpriteWidgetToSpritedef(widget))
	},

	checkDirty: function(saved)
	{
		const current = this.getContent()
		return (saved.length != current.length) || saved.some( ([s,i]) => ! sameSprite(s, current[i]) )
	},

	setLoading: function() { },
	removeFocus: function() { },
	setLightMode: function(mode) { },
}
