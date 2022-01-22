
// =============
// SCREEN LAYOUT
// =============

// TODO: the level editor should be split into a legend_EditorScreen and a levelContent_EditorScreen
function LevelEditorScreen()
{
	EmptyScreen.call(this, 'levelEditor')
	this.noAutoTick = true
	this.noSwipe = true
	this.alwaysAllowUndo = true
	this.dontDoWin = true
	this.content = empty_screen
	this.editorRowCount = 1
	this.hovered_level_cell = null
	this.hovered_glyph_index = null
	this.hovered_level_resize = null
	this.glyphSelectedIndex = 0
	this.anyEditsSinceMouseDown = false
}
LevelEditorScreen.prototype = Object.create(EmptyScreen.prototype)
LevelEditorScreen.prototype.get_nb_tiles = function()
{
	const [w, h] = this.content.get_nb_tiles()
	this.editorRowCount = Math.ceil( state.abbrevNames.length / (w+1) ) // we could do better than that and use more space horizontally
	return [ w + 2, h + 2 + this.editorRowCount ];
}
LevelEditorScreen.prototype.get_virtual_screen_size = function()
{
	const [w, h] = this.get_nb_tiles()
	return [ w*sprite_width, h*sprite_height ]
}

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
			if (state.title === 'EMPTY GAME')
			{
				compile(
					function findFirstNonMessageLevel(levels)
					{
						for (var i=0; i<levels.length; i++)
						{
							if ( ! levels[i].hasOwnProperty('message') )
								return i
						}
						return undefined
					}
				)
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
];

var glyphImagesCorrespondance;
var glyphImages;
var glyphHighlight;
var glyphHighlightResize;
var glyphPrintButton;
var glyphMouseOver;


function regenHighlight(name, color, sprite_w, sprite_h, border_width=1)
{
	var result = makeSpriteCanvas(name)
	var spritectx = result.getContext('2d')
	spritectx.fillStyle = color

	spritectx.fillRect(0, 0,  sprite_w, border_width)
	spritectx.fillRect(0, 0,  border_width, sprite_h)
	spritectx.fillRect(0, sprite_h-border_width,  sprite_w, border_width)
	spritectx.fillRect(sprite_w-border_width, 0,  border_width, sprite_h)
	return result
}


// uses state.glyphDict and state.identifiers
function regenEditorImages()
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

	const sprite_w = sprite_width
	const sprite_h = sprite_height

	// TODO: do we really need a sprite for that, when it could simply be realized as a stroke square?
	//make highlight thingy for hovering the level's cells
	glyphHighlight = regenHighlight('highlight', '#FFFFFF', sprite_w, sprite_h)

	{ // TODO: should be an icon loaded from an image
		const [mag, margins] = centerAndMagnify([5, 5], [sprite_width, sprite_height])
		glyphPrintButton = createSprite('chars', editor_s_grille, undefined, margins, mag)
	}
	{ // TODO: do we really need a sprite for that?
		//make + symbol to add rows/columns
		glyphHighlightResize = makeSpriteCanvas('highlightresize')
		var spritectx = glyphHighlightResize.getContext('2d')
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

function forceRegenImages() // redeclaration from the one in graphics.js
{
	regenSpriteImages()
	regenEditorImages()
}



// =============
// REDRAW EDITOR
// =============

LevelEditorScreen.prototype.redraw_virtual_screen = function(ctx)
{
	// draw the level's content
	// ========================

	ctx.save()
	ctx.translate(sprite_width, sprite_height * (1+this.editorRowCount) )
	this.content.redraw_virtual_screen(ctx)
	ctx.restore()

	const sprite_w = sprite_width
	const sprite_h = sprite_height
	const [w, h] = this.get_nb_tiles()

	const glyphsToDisplay = glyphImages.length

	// draw the print icon
	// ===================

	ctx.drawImage(glyphPrintButton, 0, 0, sprite_w, sprite_h)
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
		if (i === this.glyphSelectedIndex)
		{
			ctx.drawImage(glyphHighlight, (xpos+1)*sprite_w, ypos*sprite_h)
		} 		
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

LevelEditorScreen.prototype.redraw_tooltip = function(ctx, y, m, width)
{
	// Tooltips
	// ========

	var tooltip_string = ''
	var tooltip_objects = null
	// prepare tooltip: legend for highlighted editor icon
	if (this.hovered_glyph_index !== null)
	{
		if (this.hovered_glyph_index === -1)
		{
			tooltip_string = 'Print current level state to console.'
		}
		else
		{
			const identifier_index = glyphImagesCorrespondance[this.hovered_glyph_index]
			tooltip_string = state.identifiers.names[identifier_index] + ' = '
			tooltip_objects = state.identifiers.getObjectsForIdentifier(identifier_index)
		}
	}
	// prepare tooltip: content of a level's cell
	else if ( this.hovered_level_cell !== null )
	{
		tooltip_objects = []
		const [ mini, minj, maxi, maxj ] = this.content.get_viewport.call(this.content)
		this.content.level.mapCellObjects(this.hovered_level_cell[3]+minj + (this.hovered_level_cell[2]+mini)*this.content.level.height, k => tooltip_objects.push(state.idDict[k]) )
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
		ctx.font = 4*m + 'px sans-serif'
		ctx.textAlign = 'center'
		ctx.textBaseline = 'middle'
		ctx.fillText(tooltip_string, width/2, y+(this.editorRowCount + 0.5) * sprite_height*m, width)
	}
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


// ===================
// CHANGE LEVEL'S SIZE
// ===================

// TODO: the new Level function should be in a new file named editor/level.js
Level.prototype.adjust = function(widthdelta, heightdelta)
{
	execution_context.pushToUndoStack() // todo: this should use 'this' directly instead of indirectly using global var 'level'
	const oldlevel = this.clone()
	execution_context.resetCommands()
	this.width += widthdelta;
	this.height += heightdelta;
	this.n_tiles = this.width * this.height;
	this.objects = new Int32Array(this.n_tiles * STRIDE_OBJ);
	var bgMask = new BitVec(STRIDE_OBJ);
	bgMask.ibitset(state.backgroundid);
	for (var i=0; i<this.n_tiles; ++i) 
		this.setCell(i, bgMask);
	this.movements = new Int32Array(this.objects.length);
	this.rebuildArrays();
	return oldlevel;
}

Level.prototype.copyRegion = function(oldlevel, dx, dy)
{
	const xmin = Math.max(0, dx) // x >= 0 and x-dx >= 0
	const xmax = Math.min(this.width, oldlevel.width+dx) // x < this.width and x-dx < oldlevel.width
	const ymin = Math.max(0, dy) // y >= 0 and y-dy >= 0
	const ymax = Math.min(this.height, oldlevel.height+dy) // y < this.height and y-dy < oldlevel.height
	for (var x=xmin; x<xmax; ++x)
	{
		for (var y=ymin; y<ymax; ++y)
		{
			const index = x*this.height + y;
			const old_index = (x-dx)*oldlevel.height + y-dy
			this.setCell(index, oldlevel.getCell(old_index))
		}
	}
}

Level.prototype.addLeftColumn = function()  { this.copyRegion(this.adjust(1, 0), 1, 0) }
Level.prototype.addRightColumn = function() { this.copyRegion(this.adjust(1, 0), 0, 0) }
Level.prototype.addTopRow = function()      { this.copyRegion(this.adjust(0, 1), 0, 1) }
Level.prototype.addBottomRow = function()   { this.copyRegion(this.adjust(0, 1), 0, 0) }

Level.prototype.removeLeftColumn = function()  { if (this.width > 1)  this.copyRegion(this.adjust(-1, 0), -1,  0) }
Level.prototype.removeRightColumn = function() { if (this.width > 1)  this.copyRegion(this.adjust(-1, 0),  0,  0) }
Level.prototype.removeTopRow = function()      { if (this.height > 1) this.copyRegion(this.adjust(0, -1),  0, -1) }
Level.prototype.removeBottomRow = function()   { if (this.height > 1) this.copyRegion(this.adjust(0, -1),  0,  0) }




// ===========
// PRINT LEVEL
// ===========

function loadInLevelEditor(lines)
{
	loadLevelFromLevelDat(state, levelFromString(state, ['console'].concat(lines)), null)
}

// find mask with closest match
function matchGlyph(inputmask, glyphAndMask)
{
	var highestbitcount=-1;
	var highestmask;
	for (const [glyphname, glyphmask, glyphbits] of glyphAndMask)
	{
		//require all bits of glyph to be in input
		if (glyphmask.bitsSetInArray(inputmask.data))
		{
			var bitcount = 0;
			for (var bit=0;bit<32*STRIDE_OBJ;++bit) {
				if (glyphbits.get(bit) && inputmask.get(bit))
					bitcount++;
				if (glyphmask.get(bit) && inputmask.get(bit))
					bitcount++;
			}
			if (bitcount>highestbitcount) {
				highestbitcount=bitcount;
				highestmask=glyphname;
			}
		}
	}
	if (highestbitcount>0) {
		return highestmask;
	}
	
	logError("Wasn't able to approximate a glyph value for some tiles, using '.' as a placeholder.", undefined, true)
	return '.';
}

const htmlEntityMap = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': '&quot;',
	"'": '&#39;',
	"/": '&#x2F;'
}

Level.prototype.printToConsole = function()
{
	var glyphMasks = [];
	for (const [identifier_index, glyph] of state.glyphDict.entries())
	{
		const glyphName = state.identifiers.names[identifier_index];
		if ( (glyphName.length === 1) && [identifier_type_object, identifier_type_aggregate].includes(state.identifiers.comptype[identifier_index]) )
		{
			var glyphmask = makeMaskFromGlyph(glyph);
			var glyphbits = glyphmask.clone();
			//register the same - backgroundmask with the same name
			var bgMask = state.layerMasks[state.backgroundlayer];
			glyphmask.iclear(bgMask);
			glyphMasks.push([glyphName, glyphmask, glyphbits]);
		}
	}
	var output = ''
	for (var j=0; j<this.height; j++)
	{
		for (var i=0; i<this.width; i++)
		{
			var glyph = matchGlyph(this.getCell(j + i*this.height), glyphMasks);
			if (glyph in htmlEntityMap)
			{
				glyph = htmlEntityMap[glyph]
			}
			output += glyph
		}
		if (j < this.height-1)
		{
			output += "<br>"
		}
	}
	consolePrint(
		'Printing level contents:<br><br>'
		+ makeSelectableText(output, 'loadInLevelEditor')
		+ '<br><br>(Click to select, ctrl-click to load in level editor, shift-click to copy)<br><br>',
		true
	)
}




// ============
// MOUSE EVENTS
// ============

function relMouseCoords(event, canvas)
{
	const origin = (event.touches == null) ? event : event.touches[0]
	var result = { x: origin.pageX, y: origin.pageY }

	var currentElement = canvas

	do {
		result.x -= currentElement.offsetLeft - currentElement.scrollLeft
		result.y -= currentElement.offsetTop  - currentElement.scrollTop
	}
	while(currentElement = currentElement.offsetParent)

	return result;
}

LevelEditorScreen.prototype.setMouseCoord = function(e)
{
	const coords = relMouseCoords(e, screen_layout.canvas)
	const virtualscreenCoordX = Math.floor( (coords.x*window.devicePixelRatio - screen_layout.margins[0]) / screen_layout.magnification )
	const virtualscreenCoordY = Math.floor( (coords.y*window.devicePixelRatio - screen_layout.margins[1]) / screen_layout.magnification )
	const gridCoordX = Math.floor(virtualscreenCoordX/sprite_width  );
	const gridCoordY = Math.floor(virtualscreenCoordY/sprite_height );

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


LevelEditorScreen.prototype.levelEditorClick = function(event, click) // click is false if we're in a drag gesture
{
	if ( click && (this.hovered_glyph_index !== null) )
	{
		if (this.hovered_glyph_index == -1)
		{
			this.content.level.printToConsole()
		}
		else
		{
			this.glyphSelectedIndex = this.hovered_glyph_index
			redraw()
		}
		return;
	}

	if (this.hovered_level_cell !== null)
	{
		var glyphmask = makeMaskFromGlyph( state.glyphDict[ glyphImagesCorrespondance[this.glyphSelectedIndex] ] );

		var backgroundMask = state.layerMasks[state.backgroundlayer];
		if (glyphmask.bitsClearInArray(backgroundMask.data))
		{
			// If we don't already have a background layer, mix in  the default one.
			glyphmask.ibitset(state.backgroundid);
		}

		const coordIndex = this.hovered_level_cell[3] + this.hovered_level_cell[2]*level.height
		const getcell = this.content.level.getCell(coordIndex)
		if (getcell.equals(glyphmask))
			return
		if (this.anyEditsSinceMouseDown === false)
		{
			this.anyEditsSinceMouseDown = true
			execution_context.pushToUndoStack() // todo: should use 'this' directly instead of through global var 'level'
		}
		this.content.level.setCell(coordIndex, glyphmask)
		redraw()
		return
	}

	if ( ( ! click ) || (this.hovered_level_resize === null) )
		return;

	const [w, h] = this.content.get_nb_tiles()

	if (this.hovered_level_resize[2] == -1)
	{
		this.content.level.addLeftColumn()
	}
	else if (this.hovered_level_resize[2] == w)
	{
		this.content.level.addRightColumn()
	}

	if (this.hovered_level_resize[3] == -1)
	{
		this.content.level.addTopRow()
	}
	else if (this.hovered_level_resize[3] == h)
	{
		this.content.level.addBottomRow()
	}

	canvasResize()
	this.setMouseCoord(event)
	redraw()
}

LevelEditorScreen.prototype.levelEditorRightClick = function(event, click)
{	
	if ( click && (this.hovered_glyph_index !== null) )
	{
		// TODO: shouldn't this be the same code than in levelEditorClick?
		this.glyphSelectedIndex = this.hovered_glyph_index
		redraw()
		return
	}

	if (this.hovered_level_cell !== null)
	{
		const coordIndex = this.hovered_level_cell[3] + this.hovered_level_cell[2]*this.content.level.height
		var glyphmask = new BitVec(STRIDE_OBJ)
		glyphmask.ibitset(state.backgroundid) // TODO: shouldn't it be the same code than in levelEditorClick?
		this.content.level.setCell(coordIndex, glyphmask)
		redraw()
		return
	}

	if ( ( ! click ) || (this.hovered_level_resize === null) )
		return;

	const [w, h] = this.content.get_nb_tiles()

	if (this.hovered_level_resize[2] == -1)
	{
		//add a left row to the map
		this.content.level.removeLeftColumn()
	}
	else if (this.hovered_level_resize[2] == w)
	{
		this.content.level.removeRightColumn()
	} 

	if (this.hovered_level_resize[3] == -1)
	{
		this.content.level.removeTopRow()
	}
	else if (this.hovered_level_resize[3] == h)
	{
		this.content.level.removeBottomRow()
	}

	canvasResize()
	this.setMouseCoord(event)
	redraw()
}

LevelEditorScreen.prototype.leftMouseClick = function(event)
{
	this.setMouseCoord(event)
	dragging = true
	rightdragging = false
	this.anyEditsSinceMouseDown = false
	this.levelEditorClick(event,true)
	return true;
}

LevelEditorScreen.prototype.rightMouseClick = function(event)
{
	this.setMouseCoord(event)
	this.levelEditorRightClick(event, true)
	return true;
}


LevelEditorScreen.prototype.mouseMove = function(event)
{
	this.setMouseCoord(event)
	if (dragging)
	{
		this.levelEditorClick(event, false)
	}
	else if (rightdragging)
	{
		this.levelEditorRightClick(event, false)
	}
	redraw()
}

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

			canvasResize()
			return true;
		}
		case 189://-
		{
			if (this.glyphSelectedIndex > 0)
			{
				this.glyphSelectedIndex--
				canvasResize()
				return true;
			}	
			break;	
		}
		case 187://+
		{
			if (this.glyphSelectedIndex+1 < glyphImages.length)
			{
				this.glyphSelectedIndex++
				canvasResize()
				return true;
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