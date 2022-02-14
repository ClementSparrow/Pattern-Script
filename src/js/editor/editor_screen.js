// TODO: editors should be split into a legend_EditorScreen and a content_EditorScreen
function EditorScreen(screen_type)
{
	EmptyScreen.call(this, screen_type)
	this.content = empty_screen
	this.editorRowCount = 1
	this.hovered_level_cell = null
	this.hovered_glyph_index = null
	this.hovered_content_resize = null
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
EditorScreen.prototype.get_tile_size = function() { return this.content.get_tile_size() }



EditorScreen.prototype.draw_cell_border = function(ctx, x, y, line_width, color)
{
	const [tile_w, tile_h] = this.get_tile_size()
	ctx.lineWidth = line_width
	ctx.strokeStyle = color
	ctx.strokeRect(x*tile_w+line_width/2, y*tile_h+line_width/2, tile_w-line_width, tile_h-line_width)
}

EditorScreen.prototype.draw_highlight = function(ctx, x, y)
{
	this.draw_cell_border(ctx, x, y, 1, '#ffffff')
}

EditorScreen.prototype.draw_selected_cell = function(ctx, x, y)
{
	this.draw_cell_border(ctx, x, y, 2, 'yellow')
}

EditorScreen.prototype.draw_resize_signifier = function(ctx)
{
	const [content_w, content_h] = this.get_nb_tiles()
	const [tile_w, tile_h] = this.get_tile_size()
	const [horiz, vert] = [this.hovered_content_resize[2], this.hovered_content_resize[3]]

	const arrow_vec = [0, 0]
	const arrow_start = [
		(this.hovered_content_resize[0]+0.5)*tile_w,
		(this.hovered_content_resize[1]+0.5)*tile_h
	]

	ctx.strokeStyle = '#eeeeee'
	ctx.lineWidth = 1
	ctx.lineJoin = 'bevel'
	ctx.beginPath()

	if (horiz != 0)
	{
		arrow_vec[0] += horiz*(tile_w-1)
		arrow_start[0] += (1-tile_w)*horiz/2
		ctx.moveTo(arrow_start[0], (this.editorRowCount+1)*tile_h-1)
		ctx.lineTo(arrow_start[0], (content_h-1)*tile_h+1)
	}

	if (vert != 0)
	{
		arrow_vec[1] += vert*(tile_h-1)
		arrow_start[1] += (1-tile_h)*vert/2
		ctx.moveTo(tile_w-1, arrow_start[1])
		ctx.lineTo((content_w-1)*tile_w+1, arrow_start[1])
	}

	ctx.moveTo(...arrow_start)
	ctx.lineTo(arrow_start[0]+arrow_vec[0], arrow_start[1]+arrow_vec[1])
	const ortho = [arrow_vec[1], -arrow_vec[0]]
	const ahl = 0.5 // arrow head length
	ctx.moveTo(arrow_start[0]+arrow_vec[0]*(1-ahl)-ortho[0]*ahl, arrow_start[1]+arrow_vec[1]*(1-ahl)-ortho[1]*ahl)
	ctx.lineTo(arrow_start[0]+arrow_vec[0], arrow_start[1]+arrow_vec[1])
	ctx.lineTo(arrow_start[0]+arrow_vec[0]*(1-ahl)+ortho[0]*ahl, arrow_start[1]+arrow_vec[1]*(1-ahl)+ortho[1]*ahl)
	ctx.stroke()

}

EditorScreen.prototype.redraw_virtual_screen = function(ctx)
{
	const [tile_w, tile_h] = this.get_tile_size()

	// Draw the edited content
	// =======================

	ctx.save()
	ctx.translate(tile_w, tile_h * (1+this.editorRowCount) )
	this.content.redraw_virtual_screen(ctx)
	ctx.restore()

	// Draw the palette
	// ================

	this.redraw_palette(ctx)
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

EditorScreen.prototype.redraw_highlights = function(ctx, margins, m, width)
{
	ctx.save()
	ctx.translate(...margins)
	ctx.scale(m, m)
	this.draw_palette_highlights(ctx)
	if (this.hovered_content_resize !== null)
	{
		this.draw_resize_signifier(ctx)
	}
	else if (this.hovered_level_cell !== null)
	{
		this.draw_highlight(ctx, this.hovered_level_cell[0], this.hovered_level_cell[1])
	}
	ctx.restore()
}

EditorScreen.prototype.redraw_hidef = function(ctx, margins, m, width)
{
	this.redraw_tooltip(ctx, margins[1], m, width)
	this.redraw_highlights(ctx, margins, m, width)
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
	// high-resolution drawings
	this.content.redraw_hidef(this.ctx, this.margins, this.magnification, this.canvas.width)
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
	const [tile_w, tile_h] = this.get_tile_size()
	const gridCoordX = Math.floor(virtualscreenCoordX/tile_w)
	const gridCoordY = Math.floor(virtualscreenCoordY/tile_h)

	this.hovered_glyph_index  = null
	this.hovered_level_cell   = null
	this.hovered_content_resize = null

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
		this.hovered_content_resize = [
			gridCoordX, gridCoordY,
			(x == -1) ? -1 : (x == w) ? 1 : 0,
			(y == -1) ? -1 : (y == h) ? 1 : 0
		]
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

	if ( ( ! click ) || (this.hovered_content_resize === null) )
		return 0

	const [w, h] = this.content.get_nb_tiles()

	if (this.hovered_content_resize[2] != 0)
	{
		this.resize_content(true, this.hovered_content_resize[2] == -1, right_mouse_button)
	}
	if (this.hovered_content_resize[3] != 0)
	{
		this.resize_content(false, this.hovered_content_resize[3] == -1, right_mouse_button)
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
