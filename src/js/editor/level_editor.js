
// =============
// SCREEN LAYOUT
// =============

function LevelEditorScreen()
{
	EditorScreen.call(this, 'levelEditor')
	this.noAutoTick = true
	this.noSwipe = true
	this.alwaysAllowUndo = true
	this.dontDoWin = true
}
LevelEditorScreen.prototype = Object.create(EditorScreen.prototype)
LevelEditorScreen.prototype.get_palette_length = () => state.abbrevNames.length

LevelEditorScreen.prototype.toggle = function()
{
	if (screen_layout.content instanceof LevelEditorScreen)
	{
		screen_layout.content.content.level.printToConsole()
		screen_layout.content = screen_layout.content.content // close
	}
	else
	{
		while ( ! (screen_layout.content instanceof LevelScreen) )
		{
			if (screen_layout.content instanceof MenuScreen)
				return // TODO: we should exit the menu and get to the next level, but let's the user do it for now.
			if (state.title === 'EMPTY GAME')
			{
				compile( new LevelState(0, 2) )
			}
			else
			{
				nextLevel() // TODO: we should actually skip all message 'levels' until a playable one is found or we reach the end of the game (then, create a new level)
			}
		}	
		this.content = screen_layout.content // open
		screen_layout.content = this
	}
	execution_context.setRestartTarget() // TODO: should use 'this' directly rather than indirectly through global var 'level'
	canvasResize()
}

var level_editor_screen = new LevelEditorScreen()


// ==============
// EDITOR SPRITES
// ==============

const editor_s_grille = [
	[0,1,1,1,0],
	[1,0,0,0,0],
	[0,1,1,1,0],
	[0,0,0,0,1],
	[0,1,1,1,0]
]

var glyphImagesCorrespondance
var glyphImages
var glyphPrintButton

// uses state.glyphDict and state.identifiers
function regenLevelEditorImages()
{
	glyphImagesCorrespondance = []
	glyphImages = []
	
	// loop on legend symbols
	for (const [identifier_index, g] of state.glyphDict.entries())
	{
		const n = state.identifiers.names[identifier_index];
		
		if ( (n.length > 1) || (! [identifier_type_object, identifier_type_property, identifier_type_aggregate].includes(state.identifiers.comptype[identifier_index])) )
			continue

		var sprite = makeSpriteCanvas('C'+n)
		var spritectx = sprite.getContext('2d')
		glyphImagesCorrespondance.push(identifier_index)
		// TODO: shouldn't we always start by drawing a background tile, since it will always be created if not present in the legend symbol definition?
		for (const id of g)
		{
			if (id === -1)
				continue
			spritectx.drawImage(spriteimages[id], 0, 0)
		}
		glyphImages.push(sprite)
	}

	{ // TODO: should be an icon loaded from an image
		const [mag, margins] = centerAndMagnify([5, 5], [sprite_width, sprite_height])
		glyphPrintButton = createSprite('chars', editor_s_grille, undefined, margins, mag)
	}
}


function forceRegenImages() // redeclaration from the one in graphics.js
{
	regenSpriteImages()
	regenEditorImages()
	regenLevelEditorImages()
}



// =============
// REDRAW EDITOR
// =============

LevelEditorScreen.prototype.redraw_palette = function(ctx)
{
	const [w, h] = this.get_nb_tiles()
	const glyphsToDisplay = glyphImages.length

	// draw the print icon
	// ===================

	ctx.drawImage(glyphPrintButton, 0, 0, sprite_width, sprite_height)
	// draw a mouse hover if the mouse is on the print button
	if (this.hovered_glyph_index === -1)
	{
		ctx.drawImage(glyphMouseOver, 0, 0)
	}

	// draw the legend glyphs
	// ======================

	for (const [i, sprite] of glyphImages.entries())
	{
		const xpos = i%(w-1);
		const ypos = Math.floor(i/(w-1));
		ctx.drawImage(sprite, (xpos+1)*sprite_width, ypos*sprite_height)
		if (this.hovered_glyph_index === i)
		{
			ctx.drawImage(glyphMouseOver, (xpos+1)*sprite_width, ypos*sprite_height)
		}
		if (i === this.glyphSelectedIndex)
		{
			ctx.drawImage(glyphHighlight, (xpos+1)*sprite_width, ypos*sprite_height)
		} 		
	}
}

// highlight the cell hovered in the output of verbose_logging.
const level_redraw = LevelScreen.prototype.redraw_virtual_screen
LevelScreen.prototype.redraw_virtual_screen = function(ctx)
{
	level_redraw.call(this, ctx)
	if (highlighted_cell === null)
		return

	const [ mini, minj, maxi, maxj ] = this.get_viewport()
	ctx.drawImage(glyphHighlight, (highlighted_cell[0]-mini) * sprite_width, (highlighted_cell[1]-minj) * sprite_height)
}

LevelEditorScreen.prototype.compute_tooltip = function()
{
	var tooltip_string = ''
	var tooltip_objects = null

	// Legend for highlighted editor icon
	if (this.hovered_glyph_index !== null)
	{
		if (this.hovered_glyph_index === -1)
			return 'Print current level state to console.'
		const identifier_index = glyphImagesCorrespondance[this.hovered_glyph_index]
		tooltip_string = state.identifiers.names[identifier_index] + ' = '
		tooltip_objects = state.identifiers.getObjectsForIdentifier(identifier_index)
	}
	// Content of a level's cell
	else if ( this.hovered_level_cell !== null )
	{
		tooltip_objects = []
		const [ mini, minj, maxi, maxj ] = this.content.get_viewport.call(this.content)
		this.content.level.mapCellObjects(this.hovered_level_cell[3]+minj + (this.hovered_level_cell[2]+mini)*this.content.level.height, k => tooltip_objects.push(state.idDict[k]) )
	}
	// Object names
	if (tooltip_objects !== null)
	{
		tooltip_string = tooltip_string + Array.from(tooltip_objects, oi => state.identifiers.objects[oi].name).join(' ')
	}
	return tooltip_string
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

LevelEditorScreen.prototype.hover = function(virtualscreenCoordX, virtualscreenCoordY)
{
	const gridCoordX = Math.floor(virtualscreenCoordX/sprite_width )
	const gridCoordY = Math.floor(virtualscreenCoordY/sprite_height)

	this.hovered_glyph_index  = null
	this.hovered_level_cell   = null
	this.hovered_level_resize = null

	if (gridCoordY < this.editorRowCount)
	{
		const [w, h] = this.get_nb_tiles()
		if ( (gridCoordX == 0) && (gridCoordY == 0) )
		{
			this.hovered_glyph_index = -1
		}
		else if ( (gridCoordX > 0) && (gridCoordY >= 0) && (gridCoordX <= w-1))
		{
			const index = gridCoordY * (w-1) + (gridCoordX-1)
			if (index < state.abbrevNames.length)
			{
				this.hovered_glyph_index = index
			}
		}
		return;
	}

	const [w, h] = this.content.get_nb_tiles()
	const [x, y] = [ gridCoordX-1, gridCoordY - this.editorRowCount - 1 ]
	if ( (x < -1) || (x > w) || (y > h) )
		return;
	if ( (x == -1) || (y == -1) || (x == w) || (y == h) )
	{
		this.hovered_level_resize = [ gridCoordX, gridCoordY, x, y ]
	}
	else if ( (x >= 0) && (y >= 0) && (x < w) && (y < h) )
	{
		this.hovered_level_cell = [ gridCoordX, gridCoordY, x, y ]
	}
}

LevelEditorScreen.prototype.select_hovered_legend_item = function()
{
	if (this.hovered_glyph_index == -1)
	{
		this.content.level.printToConsole()
		return 0
	}
	this.glyphSelectedIndex = this.hovered_glyph_index
	return 1
}

LevelEditorScreen.prototype.edit_hovered_cell = function(right_mouse_button)
{
	const coordIndex = this.hovered_level_cell[3] + this.hovered_level_cell[2]*this.content.level.height

	var glyphmask
	if (right_mouse_button)
	{
		glyphmask = new BitVec(STRIDE_OBJ)
		glyphmask.ibitset(state.backgroundid)
	}
	else
	{
		glyphmask = makeMaskFromGlyph( state.glyphDict[ glyphImagesCorrespondance[this.glyphSelectedIndex] ] )

		if ( glyphmask.bitsClearInArray(state.layerMasks[state.backgroundlayer].data) )
		{
			// If we don't already have a background layer, mix in the default one.
			glyphmask.ibitset(state.backgroundid)
		}
	}

	const getcell = this.content.level.getCell(coordIndex)
	if (getcell.equals(glyphmask))
		return 0
	if (this.anyEditsSinceMouseDown === false)
	{
		this.anyEditsSinceMouseDown = true
		execution_context.pushToUndoStack() // todo: should use 'this' directly instead of through global var 'level'
	}

	this.content.level.setCell(coordIndex, glyphmask)
	return 1
}

LevelEditorScreen.prototype.resize_content = function(horizontal, near_origin, shrink)
{
	this.content.level.resize(horizontal, near_origin, shrink)
}

// returns 2 if a relayout is required, 1 if a redraw is required, 0 otherwise
LevelEditorScreen.prototype.editor_click = function(click, right_mouse_button) // click is false if we're in a drag gesture
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

LevelEditorScreen.prototype.leftMouseClick = function()
{
	return this.editor_click(true, false)
}

LevelEditorScreen.prototype.rightMouseClick = function()
{
	return this.editor_click(true, true)
}


// only called by ScreenLayout.prototype.mouseMove
LevelEditorScreen.prototype.mouseMove = function(drag_state)
{
	if (drag_state === 1)
		return this.editor_click(false, false)
	if (drag_state === 2)
		return this.editor_click(false, true)
	return 1 // redraw on mouse hover to update tooltips
}


// Key events
// ==========

LevelEditorScreen.prototype.checkKey = function (e, inputdir)
{
	if (this.content.checkKey(e, inputdir))
		return true;

	switch(e.keyCode)
	{
		case 48://0
		case 49://1
		case 50://2
		case 51://3
		case 52://4
		case 53://5
		case 54://6
		case 55://7
		case 56://8
		case 57://9
		{
			const num = (e.keyCode >= 49) ? e.keyCode-49 : 9

			if (num < glyphImages.length)
			{
				this.glyphSelectedIndex = num;
			}
			else
			{
				consolePrint("Trying to select tile outside of range in level editor.", true)
			}

			screen_layout.redraw()
			return true
		}
		case 189://-
		{
			if (this.glyphSelectedIndex > 0)
			{
				this.glyphSelectedIndex--
				screen_layout.redraw()
				return true
			}	
			break;	
		}
		case 187://+
		{
			if (this.glyphSelectedIndex+1 < glyphImages.length)
			{
				this.glyphSelectedIndex++
				screen_layout.redraw()
				return true
			} 
			break;	
		}
	}
	return false;
}

LevelEditorScreen.prototype.checkRepeatableKey = function(e, inputdir)
{
	return this.content.checkRepeatableKey(e, inputdir);
}