
// Sprite Editor Screen
// ====================

function SpriteEditorScreen()
{
	EditorScreen.call(this, 'spriteEditor')
}
SpriteEditorScreen.prototype = Object.create(EditorScreen.prototype)
SpriteEditorScreen.prototype.get_palette_length = () => 1

SpriteEditorScreen.prototype.redraw_palette = function(ctx)
{
	// TODO
}

SpriteEditorScreen.prototype.compute_tooltip = function()
{
	// Legend for highlighted editor icon
	if (this.hovered_glyph_index !== null)
		return this.hovered_glyph_index + ': ' // TODO: add hex color representation

	if ( this.hovered_level_cell === null )
	return ''

	// pixel in the sprite
	const pixel_index = this.hovered_level_cell[3]*this.content.width + this.hovered_level_cell[2]
	const color_index = this.content.pixels[pixel_index]
	return color_index // TODO: add hex color representation
}

SpriteEditorScreen.prototype.hover_palette = function(gridCoordX, gridCoordY)
{
	return null // TODO
}


SpriteEditorScreen.prototype.select_hovered_legend_item = function()
{
	this.glyphSelectedIndex = this.hovered_glyph_index
	return 1
}

SpriteEditorScreen.prototype.edit_hovered_cell = function(right_mouse_button)
{
	const pixel_index = this.hovered_level_cell[2] + this.hovered_level_cell[3]*this.content.width

	const new_color_index = this.glyphSelectedIndex
	const current_color_index = this.content.pixels[pixel_index]
	if (new_color_index == current_color_index)
		return 0
	// TODO: UNDO
	// if (this.anyEditsSinceMouseDown === false)
	// {
	// 	this.anyEditsSinceMouseDown = true
	// 	execution_context.pushToUndoStack() // todo: should use 'this' directly instead of through global var 'level'
	// }

	this.content.pixels[pixel_index] = new_color_index
	return 1
}

SpriteEditorScreen.prototype.resize_content = function(horizontal, near_origin, shrink)
{
	// TODO
}

// Sprite Screen
// =============

const sprite_magnification = 7

function SpriteScreen()
{
	EmptyScreen.call(this, 'sprite_screen')
	this.width = sprite_width
	this.height = sprite_height
	this.pixels = new Int32Array(sprite_width*sprite_height)
}
SpriteScreen.prototype = Object.create(EmptyScreen.prototype)
SpriteScreen.prototype.get_nb_tiles = function() { return [this.width, this.height] }
SpriteScreen.prototype.get_virtual_screen_size = function()
{
	const [w,h] = this.get_nb_tiles()
	return [w*sprite_magnification, h*sprite_magnification]
}
SpriteScreen.prototype.get_viewport = function() { return [0, 0, this.width, this.height] }

SpriteScreen.prototype.redraw_virtual_screen = function(ctx)
{
	for (var j = 0; j < this.height; j++)
	{
		const y = j * sprite_magnification
		for (var i = 0; i < this.width; i++)
		{
			const x = i * sprite_magnification
			const pixel_index = i + j*this.width
			ctx.fillStyle = (pixel_index%2 == 0) ? 'blue' : 'red' // get_color(this.pixels[pixel_index])
			ctx.fillRect(x, y, sprite_magnification, sprite_magnification)
		}
	}
}


// Sprite Editor Widget
// ====================

function SpriteEditor()
{
	ScreenLayout.call(this, document.getElementById('spriteeditor'))
	const e = this.content = new SpriteEditorScreen()
	const s = e.content = new SpriteScreen()
}
SpriteEditor.prototype = Object.create(ScreenLayout.prototype)
// const sprite_editor = new SpriteEditor()
