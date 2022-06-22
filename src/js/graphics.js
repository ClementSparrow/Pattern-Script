function centerAndMagnify(content_size, container_size)
{
	const pixel_sizes = content_size.map( (s, i) => (container_size[i] / s) )
	const magnification = Math.max(1, Math.floor(Math.min(...pixel_sizes)) )
	return [ magnification, container_size.map( (s, i) => Math.floor( (s - content_size[i]*magnification)/2 ) ) ];
}

function makeSpriteCanvas(width=sprite_width, height=sprite_height)
{
	var canvas = document.createElement('canvas')
	canvas.width  = width
	canvas.height = height
	return canvas
}

function createSprite(spritegrid, colors, margins, mag = 1, offset = [0,0])
{
	if (colors === undefined)
	{
		colors = [game_def.background_color, game_def.text_color]
	}
	if (margins === undefined)
	{
		margins = [0, 0]
	}

	const sprite_w = spritegrid.reduce( (m, line) => Math.max(m, line.length), 0 )
	const sprite_h = spritegrid.length

	var sprite = makeSpriteCanvas(sprite_w, sprite_h)
	sprite.offset = offset

	var spritectx = sprite.getContext('2d')
	spritectx.clearRect(0, 0, sprite_w, sprite_h)
	spritectx.fillStyle = game_def.text_color
	spritectx.translate(margins[0]*mag, margins[1]*mag)
	for (const [j, line] of spritegrid.entries())
	{
		for (const [k, val] of line.entries())
		{
			if (val >= 0)
			{
				spritectx.fillStyle = colors[val]
				spritectx.fillRect(Math.floor(k*mag), Math.floor(j*mag), mag, mag)
			}
		}
	}

	return sprite;
}

function forceRegenImages()
{
	regenSpriteImages()
}

var spriteimages = []
function regenSpriteImages()
{
	var sprites = []
	for (const o of state.identifiers.objects)
	{
		sprites[o.id] = o
	}
	spriteimages = sprites.map(
		o => createSprite(o.spritematrix, o.colors, undefined, undefined, o.sprite_offset)
	)
}


// ==========
// REDRAW
// ==========

TextModeScreen.prototype.redraw_virtual_screen = function(ctx)
{
	const char_width  = font_width
	const char_height = font_height
	const grid_width  = (1+font_width)
	const grid_height = (1+font_height)
	for (const [j, [line, color]] of this.text.entries() )
	{
		const f = font.colored_font(color)
		if (f === null)
			return
		for (var i = 0; i < line.length; i++)
		{
			draw_char(ctx, f, line.charAt(i), i*grid_width, j*grid_height, char_width, char_height)
		}
	}
}

LevelScreen.prototype.redraw_virtual_screen = function(ctx)
{
	const [ mini, minj, maxi, maxj ] = this.get_viewport()
	const [ size_x, size_y ] = [ maxi-mini, maxj-minj ]

	for (const layer_group of state.collision_layer_groups)
	{
		const Δhoriz = layer_group.leftward ? -sprite_width  : sprite_width
		const Δvert  = layer_group.upward   ? -sprite_height : sprite_height
		const Δi_horiz = layer_group.leftward ? -this.level.height : this.level.height
		const Δi_vert  = layer_group.upward ? -1 : 1
		const initial_col = layer_group.leftward ? size_x-1 : 0
		const initial_row = layer_group.upward   ? size_y-1 : 0

		const [ size1, size2 ] = layer_group.horizontal_first ? [ size_x, size_y ] : [ size_y, size_x ]
		const [ Δx1, Δy1, Δx2, Δy2 ] = layer_group.horizontal_first ? [ Δhoriz, 0, 0, Δvert ] : [ 0, Δvert, Δhoriz, 0 ]
		const [ Δi1, Δi2 ] = layer_group.horizontal_first ? [ Δi_horiz, Δi_vert] : [ Δi_vert, Δi_horiz ]

		let x2 = initial_col*sprite_width
		let y2 = (initial_row+1)*sprite_height
		let i2 = (minj+initial_row) + (mini+initial_col)*this.level.height

		for (let counter2 = size2; counter2 > 0; counter2--)
		{
			let i1 = i2
			let x1 = x2
			let y1 = y2
			for (let counter1 = size1; counter1 > 0; counter1--)
			{
				this.level.mapCellObjects(
					i1,
					function(k) {
						if ( (k >= layer_group.first_id) && (k <= layer_group.last_id) )
							ctx.drawImage(spriteimages[k], x1+spriteimages[k].offset[0], y1+spriteimages[k].offset[1]-spriteimages[k].height)
					}
				)
				i1 += Δi1
				x1 += Δx1
				y1 += Δy1
			}
			i2 += Δi2
			x2 += Δx2
			y2 += Δy2
		}
	}
}

// creates a buffer. To save memory, use rescale_canvas_into.
function rescale_canvas(m, ctx_from, ctx_to, w, h, margins)
{
	const scaled_imagedata = ctx_to.getImageData(margins[0], margins[1], w*m, h*m)
	rescale_canvas_into(m, ctx_from, scaled_imagedata.data, w, h)
	return scaled_imagedata
}

function rescale_canvas_into(m, ctx_from, pixels, w, h)
{
	const vc_pixels = ctx_from.getImageData(0, 0, w, h).data

	const delta_j = w*m*4
	for (var y=0, i=0, j=0; y<h; ++y)
	{
		const jstart = j
		for (var x=0; x<w; ++x, i+=4)
		{
			for (var x2=0; x2<m; ++x2, j+=4)
			{
				pixels[j  ] = vc_pixels[i  ]
				pixels[j+1] = vc_pixels[i+1]
				pixels[j+2] = vc_pixels[i+2]
				pixels[j+3] = vc_pixels[i+3]
			}
		}
		const jend = j
		for (var y2=1; y2<m; ++y2, j+=delta_j)
		{
			pixels.copyWithin(j, jstart, jend)
		}
	}
	return
}

ScreenLayout.prototype.redraw = function()
{
	if (this.magnification === 0)
		return

	// Draw virtual screen's content
	this.vc_ctx.fillStyle = game_def.background_color
	this.vc_ctx.fillRect(0, 0, this.virtual_screen_canvas.width, this.virtual_screen_canvas.height)
	this.content.redraw_virtual_screen(this.vc_ctx)

	// Center screen content
	this.ctx.save()
	this.ctx.translate(this.margins[0], this.margins[1])

	// Draw content
	if (this.magnification == 1)
	{
		this.ctx.drawImage(this.virtual_screen_canvas, 0, 0)
	}
	else
	{
		this.ctx.scale(this.magnification, this.magnification)
		rescale_canvas_into(this.magnification, this.vc_ctx, this.scaled_imagedata.data, this.virtual_screen_canvas.width, this.virtual_screen_canvas.height, this.margins)
		this.ctx.putImageData(this.scaled_imagedata, ...this.margins)
	}

	this.ctx.restore()
}

function redraw()
{
	screen_layout.redraw()
}


// ==========
// RESIZE
// ==========

var screen_layout = new ScreenLayout(document.getElementById('gameCanvas'))

ScreenLayout.prototype.resize_canvas = function()
{
	const pixel_ratio = window.devicePixelRatio || 1
	// Resize canvas
	const c = this.canvas
	c.width  = pixel_ratio * c.parentNode.clientWidth
	c.height = pixel_ratio * c.parentNode.clientHeight
	;[this.magnification, this.margins] = centerAndMagnify(this.content.get_virtual_screen_size(), [c.width, c.height])

	// clear background
	this.ctx.fillStyle = game_def.background_color
	this.ctx.fillRect(0, 0, c.width, c.height)

	// Resize virtual canvas
	const vc = this.virtual_screen_canvas
	const vc_size = this.content.get_virtual_screen_size()
	vc.width  = vc_size[0]
	vc.height = vc_size[1]

	// Get the pixel buffer that we will use
	this.scaled_imagedata = this.ctx.getImageData(this.margins[0], this.margins[1], vc_size[0]*this.magnification, vc_size[1]*this.magnification)

	this.redraw()
}

function canvasResize()
{
	screen_layout.resize_canvas()
}

