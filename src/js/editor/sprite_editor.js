
// Sprite Editor Screen
// ====================

function SpriteEditorScreen(content)
{
	EditorScreen.call(this, 'spriteEditor', content)
}
SpriteEditorScreen.prototype = Object.create(EditorScreen.prototype)
SpriteEditorScreen.prototype.get_palette_length = function() { return this.content.palette.length }

SpriteEditorScreen.prototype.position_of_palette_item = function(index)
{
	const [w, h] = this.get_nb_tiles()
	const xpos = index % w
	const ypos = Math.floor(index / w)
	return [xpos, ypos]
}

SpriteEditorScreen.prototype.redraw_palette = function(ctx)
{
	const [tile_w, tile_h] = this.get_tile_size()
	for (const [index, color] of this.content.palette.entries())
	{
		const [x, y] = this.position_of_palette_item(index)
		ctx.fillStyle = color
		ctx.fillRect(x*tile_w, y*tile_h, tile_w, tile_h)
	}
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
	const [w, h] = this.get_nb_tiles()
	const index = gridCoordY * w + gridCoordX
	return (index < this.get_palette_length()) ? index : null
}


SpriteEditorScreen.prototype.select_hovered_legend_item = function()
{
	this.glyphSelectedIndex = this.hovered_glyph_index
	return 1
}

SpriteEditorScreen.prototype.edit_hovered_cell = function(right_mouse_button)
{
	const pixel_index = this.hovered_level_cell[2] + this.hovered_level_cell[3]*this.content.width

	const new_color_index = right_mouse_button ? -1 : this.glyphSelectedIndex
	const current_color_index = this.content.pixels[pixel_index]
	if ( (new_color_index == current_color_index) || (new_color_index === null) )
		return 1 // redraw anyway to update highlight
	// TODO: UNDO
	// if (this.anyEditsSinceMouseDown === false)
	// {
	// 	this.anyEditsSinceMouseDown = true
	// 	execution_context.pushToUndoStack() // todo: should use 'this' directly instead of through global var 'level'
	// }

	this.content.pixels[pixel_index] = new_color_index
	this.onChange()
	return 1
}

SpriteEditorScreen.prototype.resize_content = function(horizontal, near_origin, shrink)
{
	this.content.resize(horizontal, near_origin, shrink)
	this.onChange()
}

SpriteEditorScreen.prototype.onChange = () => null

// Sprite Screen
// =============

const sprite_magnification = 7

function SpriteScreen(width, height, palette)
{
	EmptyScreen.call(this, 'sprite_screen')
	this.width = width || sprite_width
	this.height = height || sprite_height
	this.palette = (palette !== undefined) ? palette : ['blue', 'red']
	this.pixels = new Int32Array(this.width*this.height).fill(-1)
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
			const color = this.palette[color_index] // get_color(color_index)
			if (color === undefined)
				continue
			ctx.fillStyle = color
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

function SpriteEditor(canvas, ...sprite_screen_args)
{
	ScreenLayout.call(this, canvas)
	const e = this.content = new SpriteEditorScreen(new SpriteScreen(...sprite_screen_args))
	this.register_listeners()
}
SpriteEditor.prototype = Object.create(ScreenLayout.prototype)
