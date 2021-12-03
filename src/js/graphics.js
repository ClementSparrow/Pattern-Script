function centerAndMagnify(content_size, container_size)
{
	const pixel_sizes = content_size.map( (s, i) => (container_size[i] / s) )
	const magnification = Math.max(1, Math.floor(Math.min(...pixel_sizes)) )
	return [ magnification, container_size.map( (s, i) => Math.floor( (s - content_size[i]*magnification)/2 ) ) ];
}

var canvasdict = {}

function makeSpriteCanvas(name)
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
	canvas.width  = sprite_width
	canvas.height = sprite_height
	return canvas
}

function createSprite(name, spritegrid, colors, margins, mag = 1)
{
	if (colors === undefined)
	{
		colors = [state.bgcolor, state.fgcolor]
	}
	if (margins === undefined)
	{
		margins = [0, 0]
	}

	var sprite = makeSpriteCanvas(name);
	var spritectx = sprite.getContext('2d');

	spritectx.clearRect(0, 0, sprite_width, sprite_height)

	const sprite_w = spritegrid[0].length
	const sprite_h = spritegrid.length
	const pixel_size = mag

	spritectx.fillStyle = state.fgcolor
	for (var j = 0; j < sprite_h; j++) {
		for (var k = 0; k < sprite_w; k++) {
			var val = spritegrid[j][k]
			if (val >= 0)
			{
				spritectx.fillStyle = colors[val]
				spritectx.fillRect(Math.floor( (k+margins[0]) * pixel_size ), Math.floor( (j+margins[1]) * pixel_size ), pixel_size, pixel_size)
			}
		}
	}

	return sprite;
}

var spriteimages = []
function regenSpriteImages()
{
	spriteimages = []

	for (var i = 0; i < sprites.length; i++)
	{
		if (sprites[i] !== undefined)
		{
			spriteimages[i] = createSprite(i.toString(), sprites[i].dat, sprites[i].colors);
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

	const sprite_w = sprite_width
	const sprite_h = sprite_height

	for (var i = mini; i < maxi; i++)
	{
		for (var j = minj; j < maxj; j++)
		{
			this.level.mapCellObjects( j + i*this.level.height,
				k => ctx.drawImage(spriteimages[k], (i-mini) * sprite_w, (j-minj) * sprite_h)
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

ScreenLayout.prototype.redraw = function()
{
	if (this.magnification === 0)
		return

	// Draw virtual screen's content
	this.vc_ctx.clearRect(0, 0, this.virtual_screen_canvas.width, this.virtual_screen_canvas.height)
	this.content.redraw_virtual_screen(this.vc_ctx)

	// clear background
	this.ctx.fillStyle = state.bgcolor
	this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

	// Center screen content
	this.ctx.save()
	this.ctx.translate(this.margins[0], this.margins[1])
	this.ctx.scale(this.magnification, this.magnification)

	// Draw content
	if (this.magnification == 1)
	{
		this.ctx.drawImage(this.virtual_screen_canvas, 0, 0)
	}
	else
	{
		const vc_pixels = this.vc_ctx.getImageData(0, 0, this.virtual_screen_canvas.width, this.virtual_screen_canvas.height).data
		for (var i = 0; i < vc_pixels.length; i += 4)
		{
			this.ctx.fillStyle = 'rgba(' + vc_pixels.slice(i, i+4).join() + ')'
			this.ctx.fillRect( ((i/4) % this.virtual_screen_canvas.width), Math.floor((i/4) / this.virtual_screen_canvas.width), 1, 1)
		}
	}
	this.content.redraw_hidef(this.ctx)

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

	var vc = this.virtual_screen_canvas
	var vc_size = this.content.get_virtual_screen_size()
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

