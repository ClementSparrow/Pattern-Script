// TODO: editors should be split into a legend_EditorScreen and a content_EditorScreen
function EditorScreen(screen_type)
{
	EmptyScreen.call(this, screen_type)
	this.content = empty_screen
	this.editorRowCount = 1
	this.hovered_level_cell = null
	this.hovered_glyph_index = null
	this.hovered_level_resize = null
	this.glyphSelectedIndex = 0
	this.anyEditsSinceMouseDown = false
}
EditorScreen.prototype = Object.create(EmptyScreen.prototype)
EditorScreen.prototype.get_palette_length = () => 0

EditorScreen.prototype.get_nb_tiles = function()
{
	const [w, h] = this.content.get_nb_tiles()
	this.editorRowCount = Math.ceil( this.get_palette_length() / (w+1) ) // we could do better than that and use more space horizontally
	return [w+2, h+2+this.editorRowCount]
}

EditorScreen.prototype.get_virtual_screen_size = function()
{
	const [w, h] = this.get_nb_tiles()
	return [w*sprite_width, h*sprite_height]
}


var glyphHighlight
var glyphHighlightResize
var glyphMouseOver

function regenHighlight(name, color, sprite_w, sprite_h, border_width=1)
{
	const result = makeSpriteCanvas(name)
	const spritectx = result.getContext('2d')
	spritectx.fillStyle = color

	spritectx.fillRect(0, 0,  sprite_w, border_width)
	spritectx.fillRect(0, 0,  border_width, sprite_h)
	spritectx.fillRect(0, sprite_h-border_width,  sprite_w, border_width)
	spritectx.fillRect(sprite_w-border_width, 0,  border_width, sprite_h)
	return result
}

function regenEditorImages()
{
	const sprite_w = sprite_width
	const sprite_h = sprite_height

	// TODO: do we really need a sprite for that, when it could simply be realized as a stroke square?
	//make highlight thingy for hovering the level's cells
	glyphHighlight = regenHighlight('highlight', '#FFFFFF', sprite_w, sprite_h)

	{ // TODO: do we really need a sprite for that?
		//make + symbol to add rows/columns
		glyphHighlightResize = makeSpriteCanvas('highlightresize')
		let spritectx = glyphHighlightResize.getContext('2d')
		spritectx.fillStyle = '#FFFFFF'
		
		const minx = Math.floor((sprite_w-1)/2)
		const miny = Math.floor((sprite_h-1)/2)
		const xsize = sprite_w - 2*minx
		const ysize = sprite_h - 2*miny

		spritectx.fillRect(minx, 0,  xsize, sprite_h)
		spritectx.fillRect(0, miny,  sprite_w, ysize)
	}

	// TODO: do we really need a sprite for that, when it could simply be realized as a stroke square?
	//make highlight thingy. This one is for the mouse hover on legend glyphs
	glyphMouseOver = regenHighlight(undefined, 'yellow', sprite_w, sprite_h, 2)
}


EditorScreen.prototype.redraw_virtual_screen = function(ctx)
{
	// Draw the edited content
	// =======================

	ctx.save()
	ctx.translate(sprite_width, sprite_height * (1+this.editorRowCount) )
	this.content.redraw_virtual_screen(ctx)
	ctx.restore()

	// Draw the palette
	// ================

	this.redraw_palette(ctx)

	// Mouse hover level
	// =================

	if ( this.hovered_level_resize !== null)
	{
		// show "+" cursor to resize the edited content
		ctx.drawImage(glyphHighlightResize, this.hovered_level_resize[0] * sprite_width, this.hovered_level_resize[1] * sprite_height)
	}
	else if (this.hovered_level_cell !== null)
	{
		// highlight cell in edited content
		ctx.drawImage(glyphHighlight, this.hovered_level_cell[0] * sprite_width, this.hovered_level_cell[1] * sprite_height)
	}
}

EditorScreen.prototype.redraw_tooltip = function(ctx, y, m, width)
{
	const tooltip_string = this.compute_tooltip()
	if (tooltip_string.length <= 0)
		return
	// show tooltip
	ctx.fillStyle = state.fgcolor
	ctx.font = 4*m + 'px sans-serif'
	ctx.textAlign = 'center'
	ctx.textBaseline = 'middle'
	ctx.fillText(tooltip_string, width/2, y+(this.editorRowCount + 0.5) * sprite_height*m, width)
}

const screenlayout_redraw = ScreenLayout.prototype.redraw
ScreenLayout.prototype.redraw = function()
{
	if (this.content.editorRowCount === undefined)
	{
		screenlayout_redraw.call(this)
		return
	}
	this.ctx.fillStyle = state.bgcolor
	this.ctx.fillRect(0, this.margins[1]+this.content.editorRowCount*sprite_height*this.magnification, this.canvas.width, sprite_height*this.magnification)
	screenlayout_redraw.call(this)
	this.content.redraw_tooltip(this.ctx, this.margins[1], this.magnification, this.canvas.width)
}



// ============
// MOUSE EVENTS
// ============

ScreenLayout.prototype.hover = function(origin)
{
	var result = { x: origin.pageX, y: origin.pageY }

	var currentElement = this.canvas

	do {
		result.x -= currentElement.offsetLeft - currentElement.scrollLeft
		result.y -= currentElement.offsetTop  - currentElement.scrollTop
	}
	while(currentElement = currentElement.offsetParent)

	return this.content.hover(
		Math.floor( (result.x*window.devicePixelRatio - this.margins[0]) / this.magnification ),
		Math.floor( (result.y*window.devicePixelRatio - this.margins[1]) / this.magnification )
	)
}

EditorScreen.prototype.hover = function(virtualscreenCoordX, virtualscreenCoordY)
{
	const gridCoordX = Math.floor(virtualscreenCoordX/sprite_width )
	const gridCoordY = Math.floor(virtualscreenCoordY/sprite_height)

	this.hovered_glyph_index  = null
	this.hovered_level_cell   = null
	this.hovered_level_resize = null

	if (gridCoordY < this.editorRowCount)
	{
		this.hovered_glyph_index = this.hover_palette(gridCoordX, gridCoordY)
		return
	}

	const [w, h] = this.content.get_nb_tiles()
	const [x, y] = [ gridCoordX-1, gridCoordY - this.editorRowCount - 1 ]
	if ( (x < -1) || (x > w) || (y > h) )
		return
	if ( (x == -1) || (y == -1) || (x == w) || (y == h) )
	{
		this.hovered_level_resize = [ gridCoordX, gridCoordY, x, y ]
	}
	else if ( (x >= 0) && (y >= 0) && (x < w) && (y < h) )
	{
		this.hovered_level_cell = [ gridCoordX, gridCoordY, x, y ]
	}
}

// returns 2 if a relayout is required, 1 if a redraw is required, 0 otherwise
EditorScreen.prototype.editor_click = function(click, right_mouse_button) // click is false if we're in a drag gesture
{
	if (click)
	{
		this.anyEditsSinceMouseDown = false
	}

	// Select legend item
	// ------------------

	if ( click && (this.hovered_glyph_index !== null) )
	{
		return this.select_hovered_legend_item()
	}

	// Edit content
	// ------------

	if (this.hovered_level_cell !== null)
	{
		return this.edit_hovered_cell(right_mouse_button)
	}

	// Resize content
	// --------------

	if ( ( ! click ) || (this.hovered_level_resize === null) )
		return 0

	const [w, h] = this.content.get_nb_tiles()

	if (this.hovered_level_resize[2] == -1)
	{
		this.resize_content(true, true, right_mouse_button)
	}
	else if (this.hovered_level_resize[2] == w)
	{
		this.resize_content(true, false, right_mouse_button)
	}

	if (this.hovered_level_resize[3] == -1)
	{
		this.resize_content(false, true, right_mouse_button)
	}
	else if (this.hovered_level_resize[3] == h)
	{
		this.resize_content(false, false, right_mouse_button)
	}

	return 2
}


// Mouse events logic
// ==================

EditorScreen.prototype.leftMouseClick = function()
{
	return this.editor_click(true, false)
}

EditorScreen.prototype.rightMouseClick = function()
{
	return this.editor_click(true, true)
}


// only called by ScreenLayout.prototype.mouseMove
EditorScreen.prototype.mouseMove = function(drag_state)
{
	if (drag_state === 1)
		return this.editor_click(false, false)
	if (drag_state === 2)
		return this.editor_click(false, true)
	return 1 // redraw on mouse hover to update tooltips
}
