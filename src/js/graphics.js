function centerAndMagnify(content_size, container_size)
{
	const pixel_sizes = content_size.map( (s, i) => (container_size[i] / s) )
	const magnification = Math.max(1, Math.floor(Math.min(...pixel_sizes)) )
	return [ magnification, container_size.map( (s, i) => Math.floor( (s - content_size[i]*magnification)/2 ) ) ];
}

var canvasdict = {}

function makeSpriteCanvas(name, width=sprite_width, height=sprite_height)
{
	var canvas
	if (name in canvasdict)
	{
		canvas = canvasdict[name]
	}
	else
	{
		canvas = document.createElement('canvas')
		canvasdict[name] = canvas
	}
	canvas.width  = width
	canvas.height = height
	return canvas
}

function createSprite(name, spritegrid, colors, margins, mag = 1, offset = [0,0])
{
	if (colors === undefined)
	{
		colors = [state.bgcolor, state.fgcolor]
	}
	if (margins === undefined)
	{
		margins = [0, 0]
	}

	const sprite_w = spritegrid.reduce( (m, line) => Math.max(m, line.length), 0 )
	const sprite_h = spritegrid.length

	var sprite = makeSpriteCanvas(name, sprite_w, sprite_h)
	sprite.offset = offset

	var spritectx = sprite.getContext('2d')
	spritectx.clearRect(0, 0, sprite_w, sprite_h)
	spritectx.fillStyle = state.fgcolor
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
	spriteimages = []

	for (var i = 0; i < sprites.length; i++)
	{
		if (sprites[i] !== undefined)
		{
			spriteimages[i] = createSprite(i.toString(), sprites[i].dat, sprites[i].colors, undefined, undefined, sprites[i].offset)
		}
	}
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

	for (var i = mini; i < maxi; i++)
	{
		const x = (i-mini) * sprite_width
		for (var j = minj; j < maxj; j++)
		{
			const y = (j+1-minj) * sprite_height
			this.level.mapCellObjects( j + i*this.level.height,
				k => ctx.drawImage(spriteimages[k], x+spriteimages[k].offset[0], y+spriteimages[k].offset[1]-spriteimages[k].height)
			)
		}
	}
}

ScreenLayout.prototype.init_graphics = function(canvas_id = 'gameCanvas')
{
	this.canvas = document.getElementById(canvas_id)
	this.ctx = this.canvas.getContext('2d')
	this.virtual_screen_canvas = document.createElement('canvas')
	this.vc_ctx = this.virtual_screen_canvas.getContext('2d')
}
screen_layout.init_graphics()

function rescale_canvas(m, ctx_from, ctx_to, w, h, margins)
{
	const vc_pixels = ctx_from.getImageData(0, 0, w, h).data
	var scaled_imagedata = ctx_to.getImageData(margins[0], margins[1], w*m, h*m)
	var pixels = scaled_imagedata.data

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
	return scaled_imagedata
}

ScreenLayout.prototype.redraw = function()
{
	if (this.magnification === 0)
		return

	// Draw virtual screen's content
	this.vc_ctx.fillStyle = state.bgcolor
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
		this.ctx.putImageData(
			rescale_canvas(this.magnification, this.vc_ctx, this.ctx, this.virtual_screen_canvas.width, this.virtual_screen_canvas.height, this.margins),
			...this.margins
		)
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

ScreenLayout.prototype.resize_canvas = function(pixel_ratio)
{
	// Resize canvas
	var c = this.canvas
	c.width  = pixel_ratio * c.parentNode.clientWidth
	c.height = pixel_ratio * c.parentNode.clientHeight
	this.resize( [c.width, c.height] )

	// clear background
	this.ctx.fillStyle = state.bgcolor
	this.ctx.fillRect(0, 0, c.width, c.height)

	// Resize virtual canvas
	var vc = this.virtual_screen_canvas
	const vc_size = this.content.get_virtual_screen_size()
	vc.width  = vc_size[0]
	vc.height = vc_size[1]

	this.redraw()
}

function canvasResize()
{
	const pixel_ratio = window.devicePixelRatio || 1
	screen_layout.resize_canvas(pixel_ratio)
}

window.addEventListener('resize', canvasResize, false)

