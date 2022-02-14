
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

SpriteEditorScreen.prototype.draw_palette_highlights = function(ctx)
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
	this.content.resize(horizontal, near_origin, shrink)
}


// Sprite Screen
// =============

const sprite_magnification = 7

function SpriteScreen()
{
	EmptyScreen.call(this, 'sprite_screen')
	this.width = sprite_width
	this.height = sprite_height
	this.palette = ['blue', 'red']
	this.pixels = Int32Array.from({length: sprite_width*sprite_height}, (_,i) => (i%3)-1)
}
SpriteScreen.prototype = Object.create(EmptyScreen.prototype)
SpriteScreen.prototype.get_nb_tiles = function() { return [this.width, this.height] }
SpriteScreen.prototype.get_tile_size = () => [sprite_magnification, sprite_magnification]
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
			const color_index = this.pixels[pixel_index]
			if (color_index == -1)
				continue
			ctx.fillStyle = this.palette[color_index] // get_color(color_index)
			ctx.fillRect(x, y, sprite_magnification, sprite_magnification)
		}
	}
}

SpriteScreen.prototype.resize = function(horizontal, near_origin, shrink)
{
	const old_pixels = this.pixels
	const delta = shrink ? -1 : 1
	const [size_dx, size_dy] = horizontal ? [delta, 0] : [0, delta]
	if ( (this.width + size_dx <= 0) || (this.height + size_dy <= 0) )
		return
	const [dx, dy] = near_origin ? [size_dx, size_dy] : [0, 0]
	this.width  += size_dx
	this.height += size_dy
	this.pixels = new Int32Array(this.width*this.height)
	this.pixels.fill(-1)
	for (var x=Math.max(0, dx); x<Math.min(this.width, this.width-size_dx+dx); ++x)
	{
		for(var y=Math.max(0, dy); y<Math.min(this.height, this.height-size_dy+dy); ++y)
		{
			this.pixels[y*this.width + x] = old_pixels[(y-dy)*(this.width-size_dx) + x-dx]
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
// sprite_editor.register_listeners()
