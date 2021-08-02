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

function createSprite(name, spritegrid, colors)
{
	if (colors === undefined) {
		colors = [state.bgcolor, state.fgcolor];
	}

	var sprite = makeSpriteCanvas(name);
	var spritectx = sprite.getContext('2d');

	spritectx.clearRect(0, 0, sprite_width * screen_layout.magnification, sprite_height * screen_layout.magnification)

	const sprite_w = spritegrid[0].length;
	const sprite_h = spritegrid.length;
	spritectx.fillStyle = state.fgcolor;
	for (var j = 0; j < sprite_h; j++) {
		for (var k = 0; k < sprite_w; k++) {
			var val = spritegrid[j][k];
			if (val >= 0)
			{
				spritectx.fillStyle = colors[val];
				spritectx.fillRect(Math.floor(k * screen_layout.magnification), Math.floor(j * screen_layout.magnification), screen_layout.magnification, screen_layout.magnification);
			}
		}
	}

	return sprite;
}

var spriteimages;

// called only by redraw() (if spriteimages is undefined) and canvasResize() (if forceRegenImages is true or one of the layout parameters has changed)
function regenSpriteImages()
{
	if (textMode)
		return;
	
	if (state.levels.length === 0)
		return;

	spriteimages = [];

	for (var i = 0; i < sprites.length; i++)
	{
		if (sprites[i] !== undefined)
		{
			spriteimages[i] = createSprite(i.toString(), sprites[i].dat, sprites[i].colors);
		}
	}

	if (canOpenEditor) {
		generateGlyphImages();
	}
}


// ==============
// EDITOR SPRITES (should be in a separate file)
// ==============

const editor_s_grille = [
	[0,1,1,1,0],
	[1,0,0,0,0],
	[0,1,1,1,0],
	[0,0,0,0,1],
	[0,1,1,1,0]
];

var glyphImagesCorrespondance;
var glyphImages;
var glyphHighlight;
var glyphHighlightResize;
var glyphPrintButton;
var glyphMouseOver;
var glyphSelectedIndex = 0;

// uses state.glyphDict and state.identifiers
function generateGlyphImages()
{
	if (screen_layout.magnification === 0)
		return;

	glyphImagesCorrespondance = [];
	glyphImages = [];
	
	// loop on legend symbols
	for (const [identifier_index, g] of state.glyphDict.entries())
	{
		const n = state.identifiers.names[identifier_index];
		
		if ( (n.length > 1) || (! [identifier_type_object, identifier_type_property, identifier_type_aggregate].includes(state.identifiers.comptype[identifier_index])) )
			continue;

		var sprite = makeSpriteCanvas("C"+n)
		var spritectx = sprite.getContext('2d');
		glyphImagesCorrespondance.push(identifier_index);
		// TODO: shouldn't we always start by drawing a background tile, since it will always be created if not present in the legend symbol definition?
		for (const id of g)
		{
			if (id === -1)
				continue;
			spritectx.drawImage(spriteimages[id], 0, 0);
		}
		glyphImages.push(sprite);
	}

	const sprite_w = sprite_width  * screen_layout.magnification
	const sprite_h = sprite_height * screen_layout.magnification

	{ // TODO: do we really need a sprite for that, when it could simply be realized as a stroke square?
		//make highlight thingy for hovering the level's cells
		glyphHighlight = makeSpriteCanvas("highlight");
		var spritectx = glyphHighlight.getContext('2d');
		spritectx.fillStyle = '#FFFFFF';

		spritectx.fillRect(0, 0,  sprite_w, 1)
		spritectx.fillRect(0, 0,  1, sprite_h)
		spritectx.fillRect(0, sprite_h-1,  sprite_w, 1)
		spritectx.fillRect(sprite_w-1, 0,  1, sprite_h)
	}

	{ // TODO: should be an icon loaded from an image
		glyphPrintButton = createSprite('chars', editor_s_grille, undefined)
	}
	{ // TODO: do we really need a sprite for that?
		//make + symbol to add rows/columns
		glyphHighlightResize = makeSpriteCanvas("highlightresize");
		var spritectx = glyphHighlightResize.getContext('2d');
		spritectx.fillStyle = '#FFFFFF';
		
		const minx = Math.floor((sprite_w/2) )-1
		const miny = Math.floor((sprite_h/2))-1
		const xsize = sprite_w - minx - 1 - minx
		const ysize = sprite_h - miny - 1 - minx

		spritectx.fillRect(minx, 0,  xsize, sprite_h)
		spritectx.fillRect(0, miny,  sprite_w, ysize)
	}

	{ // TODO: do we really need a sprite for that, when it could simply be realized as a stroke square?
		//make highlight thingy. This one is for the mouse hover on legend glyphs
		glyphMouseOver = makeSpriteCanvas();
		var spritectx = glyphMouseOver.getContext('2d');
		spritectx.fillStyle = 'yellow';
		
		spritectx.fillRect(0, 0,  sprite_w, 2)
		spritectx.fillRect(0, 0,  2, sprite_h)
		spritectx.fillRect(0, sprite_h-2,  sprite_w, 2)
		spritectx.fillRect(sprite_w-2, 0,  2, sprite_h)
	}
}

// TODO: this should be in a file for the console, so that we can ship the game without it.
var highlighted_cell = null;
function highlightCell(coords)
{
	highlighted_cell = coords;
	redraw()
}


// ==========
// REDRAW
// ==========

window.addEventListener('resize', canvasResize, false);

var canvas = document.getElementById('gameCanvas');
var ctx = canvas.getContext('2d');

function redraw_textmode(magnification)
{
	const f = font.colored_font(state.fgcolor)
	if (f === null)
		return;

	const char_width  = magnification * font_width
	const char_height = magnification * font_height
	const grid_width  = magnification * (1+font_width)
	const grid_height = magnification * (1+font_height)
	for (var j = 0; j < titleHeight; j++)
	{
		for (var i = 0; i < titleWidth; i++)
		{
			draw_char(ctx, f, titleImage[j].charAt(i), i*grid_width, j*grid_height, char_width, char_height)
		}
	}
}

function set_camera_on_player()
{
	const playerPositions = getPlayerPositions();
	if (playerPositions.length == 0)
		return oldflickscreendat;

	const playerPosition = playerPositions[0];
	const px = Math.floor(playerPosition/level.height);
	const py = (playerPosition%level.height);

	const [mini, minj] = this.get_viewport_for_focus_point(px, py)
	const [w, h] = this.get_nb_tiles()
	const maxi = Math.min(mini + w, level.width);
	const maxj = Math.min(minj + h, level.height);
	oldflickscreendat = [mini, minj, maxi, maxj];
	return oldflickscreendat;
}

function redraw_level_viewport(magnification)
{
	const [ mini, minj, maxi, maxj ] = this.get_viewport()

	const sprite_w = sprite_width  * magnification
	const sprite_h = sprite_height * magnification

	for (var i = mini; i < maxi; i++)
	{
		for (var j = minj; j < maxj; j++)
		{
			const posMask = level.getCellInto(j + i*level.height, _o12);
			for (var k = 0; k < state.objectCount; k++)
			{
				if (posMask.get(k) != 0)
				{
					ctx.drawImage(spriteimages[k], (i-mini) * sprite_w, (j-minj) * sprite_h)
				}
			}
		}
	}
}

function redraw()
{
	if (screen_layout.magnification === 0)
		return;

	if (spriteimages === undefined)
	{
		regenSpriteImages();
	}


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


function redraw_levelEditor(magnification)
{
	// draw the level's content
	// ========================

	ctx.save()
	ctx.translate(magnification * sprite_width, magnification * sprite_height * (1+this.editorRowCount) )
	this.content.redraw.call(this.content, magnification)
	ctx.restore()

	const [ mini, maxi, minj, maxj ] = this.content.get_viewport.call(this.content)

	const sprite_w = sprite_width  * magnification
	const sprite_h = sprite_height * magnification
	const [w, h] = this.get_nb_tiles()

	const glyphsToDisplay = glyphImages.length

	// draw the print icon
	// ===================

	ctx.drawImage(glyphPrintButton, 0, 0, 5, 5, 0, 0, sprite_w, sprite_h) // it has a fixed 5x5 size
	// draw a mouse hover if the mouse is on the print button
	if ( this.hovered_glyph_index === -1 )
	{
		ctx.drawImage(glyphMouseOver, 0, 0)
	}

	// draw the legend glyphs
	// ======================

	for (const [i, sprite] of glyphImages.entries())
	{
		const xpos = i%(w-1);
		const ypos = Math.floor(i/(w-1));
		ctx.drawImage(sprite, (xpos+1)*sprite_w, ypos*sprite_h)
		if (this.hovered_glyph_index === i)
		{
			ctx.drawImage(glyphMouseOver, (xpos+1)*sprite_w, ypos*sprite_h)
		}
		if (i === glyphSelectedIndex)
		{
			ctx.drawImage(glyphHighlight, (xpos+1)*sprite_w, ypos*sprite_h)
		} 		
	}

	// Tooltips
	// ========

	var tooltip_string = ''
	var tooltip_objects = null
	// prepare tooltip: legend for highlighted editor icon
	if ( (this.hovered_glyph_index !== null) && (this.hovered_glyph_index >= 0) )
	{
		const identifier_index = glyphImagesCorrespondance[this.hovered_glyph_index]
		tooltip_string = state.identifiers.names[identifier_index] + ' = '
		tooltip_objects = state.identifiers.getObjectsForIdentifier(identifier_index)
	}
	// prepare tooltip: content of a level's cell
	else if ( this.hovered_level_cell !== null )
	{
		const posMask = level.getCellInto((this.hovered_level_cell[3]+minj) + (this.hovered_level_cell[2]+mini)*level.height, _o12);
		tooltip_objects = state.idDict.filter( (x,k) => (posMask.get(k) != 0) )
	}
	// prepare tooltip: object names
	if (tooltip_objects !== null)
	{
		tooltip_string = tooltip_string + Array.from(tooltip_objects, oi => state.identifiers.objects[oi].name).join(' ')
	}
	// show tooltip
	if (tooltip_string.length > 0)
	{
		ctx.fillStyle = state.fgcolor
		ctx.fillText(tooltip_string, 0, (this.editorRowCount + 0.6) * sprite_h)
	}

	// Mouse hover level
	// =================

	if ( this.hovered_level_resize !== null)
	{
		// show "+" cursor to resize the level
		ctx.drawImage(glyphHighlightResize, this.hovered_level_resize[0] * sprite_w, this.hovered_level_resize[1] * sprite_h);
	}
	else if (this.hovered_level_cell !== null)
	{
		// highlight cell in level
		ctx.drawImage(glyphHighlight, this.hovered_level_cell[0] * sprite_w, this.hovered_level_cell[1] * sprite_h)
	}
	else if (highlighted_cell !== null)
	{
		// highlight the cell hovered in the output of verbose_logging.
		ctx.drawImage(glyphHighlight, (highlighted_cell[0]-mini) * sprite_w, (highlighted_cell[1]-minj) * sprite_h)
	}
}




// ==========
// RESIZE
// ==========

function canvasResize()
{
	// Resize canvas
	canvas.width  = canvas.parentNode.clientWidth;
	canvas.height = canvas.parentNode.clientHeight;

	screen_layout.resize( [canvas.width, canvas.height] )
	redraw()
}
