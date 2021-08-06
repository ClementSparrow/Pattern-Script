function centerAndMagnify(content_size, container_size)
{
	const pixel_sizes = content_size.map( (s, i) => (container_size[i] / s) )
	const magnification = Math.max(1, Math.floor(Math.min(...pixel_sizes)) )
	return [ magnification, container_size.map( (s, i) => Math.floor( (s - content_size[i]*magnification)/2 ) ) ];
}

var canvasdict = {}

function makeSpriteCanvas(name)
{
	var canvas;
	if (name in canvasdict)
	{
		canvas = canvasdict[name];
	} else {
		canvas = document.createElement('canvas');
		canvasdict[name] = canvas;
	}
	canvas.width  = screen_layout.magnification * sprite_width
	canvas.height = screen_layout.magnification * sprite_height
	return canvas;
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

	spritectx.clearRect(0, 0, sprite_width * screen_layout.magnification, sprite_height * screen_layout.magnification)

	const sprite_w = spritegrid[0].length
	const sprite_h = spritegrid.length
	const pixel_size = mag * screen_layout.magnification

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

LevelScreen.prototype.regenResources = function(magnification)
{
	this.spriteimages = []

	for (var i = 0; i < sprites.length; i++)
	{
		if (sprites[i] !== undefined)
		{
			this.spriteimages[i] = createSprite(i.toString(), sprites[i].dat, sprites[i].colors);
		}
	}
}


// ==========
// REDRAW
// ==========

var canvas = document.getElementById('gameCanvas');
var ctx = canvas.getContext('2d');

TextModeScreen.prototype.redraw = function(magnification)
{
	const f = font.colored_font(state.fgcolor)
	if (f === null)
		return;

	const char_width  = magnification * font_width
	const char_height = magnification * font_height
	const grid_width  = magnification * (1+font_width)
	const grid_height = magnification * (1+font_height)
	for (var j = 0; j < terminal_height; j++)
	{
		for (var i = 0; i < terminal_width; i++)
		{
			draw_char(ctx, f, this.text[j].charAt(i), i*grid_width, j*grid_height, char_width, char_height)
		}
	}
}

LevelScreen.prototype.redraw = function(magnification)
{
	if (this.spriteimages === undefined)
	{
		this.regenResources(magnification)
	}

	const [ mini, minj, maxi, maxj ] = this.get_viewport()

	const sprite_w = sprite_width  * magnification
	const sprite_h = sprite_height * magnification

	for (var i = mini; i < maxi; i++)
	{
		for (var j = minj; j < maxj; j++)
		{
			level.mapCellObjects( j + i*level.height,
				k => ctx.drawImage(this.spriteimages[k], (i-mini) * sprite_w, (j-minj) * sprite_h)
			)
		}
	}
}

function redraw()
{
	if (screen_layout.magnification === 0)
		return;

	// clear background
	ctx.fillStyle = state.bgcolor;
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	// Center screen content
	ctx.save()
	ctx.translate(screen_layout.margins[0], screen_layout.margins[1])

	const redraw_func = screen_layout.content.redraw
	if (redraw_func !== null)
	{
		redraw_func.call(screen_layout.content, screen_layout.magnification)
	}

	ctx.restore()
}


// ==========
// RESIZE
// ==========

function canvasResize()
{
	// Resize canvas
	canvas.width  = canvas.parentNode.clientWidth
	canvas.height = canvas.parentNode.clientHeight

	screen_layout.resize( [canvas.width, canvas.height] )
	redraw()
}

window.addEventListener('resize', canvasResize, false)

