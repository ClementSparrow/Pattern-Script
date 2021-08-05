
// =============
// SCREEN LAYOUT
// =============

// TODO: the level editor should be split into a legend_EditorScreen and a levelContent_EditorScreen
function LevelEditorScreen()
{
	LevelScreen.call(this, 'levelEditor')
	this.noAutoTick = true
	this.noSwipe = true
	this.alwaysAllowUndo = true
	this.dontDoWin = true
	this.content = empty_screen
	this.editorRowCount = 1
	this.hovered_level_cell = null
	this.hovered_glyph_index = null
	this.hovered_level_resize = null
	this.glyphSelectedIndex = null
	this.anyEditsSinceMouseDown = false
}
LevelEditorScreen.prototype = Object.create(LevelScreen.prototype)
LevelEditorScreen.prototype.get_nb_tiles = function()
{
	const [w, h] = this.content.get_nb_tiles()
	this.editorRowCount = Math.ceil( state.abbrevNames.length / (w+1) ) // we could do better than that and use more space horizontally
	return [ w + 2, h + 2 + this.editorRowCount ];
}

LevelEditorScreen.prototype.toggle = function()
{
	if ( ! (screen_layout.content instanceof LevelScreen) )
	{
		if (state.title === 'EMPTY GAME')
		{
			compile(["loadFirstNonMessageLevel"])
		}
		else
		{
			nextLevel() // TODO: we should actually skip all message 'levels' until a playable one is found or we reach the end of the game (then, create a new level)
		}
	}
	else if (screen_layout.content instanceof LevelEditorScreen)
	{
		printLevel()
	}

	if (screen_layout.content instanceof LevelEditorScreen)
	{
		// close
		screen_layout.content = screen_layout.content.content
	}
	else
	{
		this.content = screen_layout.content
		screen_layout.content = this
	}

	restartTarget = backupLevel()
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

// uses state.glyphDict and state.identifiers
// function generateGlyphImages()
LevelEditorScreen.prototype.regenResources = function(magnification)
{
	if (magnification === 0)
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
			spritectx.drawImage(this.content.spriteimages[id], 0, 0);
		}
		glyphImages.push(sprite);
	}

	const sprite_w = sprite_width  * magnification
	const sprite_h = sprite_height * magnification

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
		const [mag, margins] = centerAndMagnify([5, 5], [sprite_width, sprite_height])
		glyphPrintButton = createSprite('chars', editor_s_grille, undefined, margins, mag)
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

LevelEditorScreen.prototype.updateResources = function(magnification)
{
	this.content.updateResources(magnification) // will update spriteimages if necessary so that we can use it too.
	EmptyScreen.prototype.updateResources.call(this, magnification)
}



// =============
// REDRAW EDITOR
// =============

LevelEditorScreen.prototype.redraw = function(magnification)
{
	// draw the level's content
	// ========================

	ctx.save()
	ctx.translate(magnification * sprite_width, magnification * sprite_height * (1+this.editorRowCount) )
	this.content.redraw.call(this.content, magnification)
	ctx.restore()

	if (glyphImages === undefined)
	{
		generateGlyphImages()
	}

	const [ mini, minj, maxi, maxj ] = this.content.get_viewport.call(this.content)

	const sprite_w = sprite_width  * magnification
	const sprite_h = sprite_height * magnification
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




// ===================
// CHANGE LEVEL'S SIZE
// ===================

function adjustLevel(level, widthdelta, heightdelta)
{
	backups.push(backupLevel());
	var oldlevel = level.clone();
	level.width += widthdelta;
	level.height += heightdelta;
	level.n_tiles = level.width * level.height;
	level.objects = new Int32Array(level.n_tiles * STRIDE_OBJ);
	var bgMask = new BitVec(STRIDE_OBJ);
	bgMask.ibitset(state.backgroundid);
	for (var i=0; i<level.n_tiles; ++i) 
		level.setCell(i, bgMask);
	level.movements = new Int32Array(level.objects.length);
	RebuildLevelArrays();
	return oldlevel;
}

function copyLevelRegion(oldlevel, level, dx, dy)
{
	const xmin = Math.max(0, dx) // x >= 0 and x-dx >= 0
	const xmax = Math.min(level.width, oldlevel.width+dx) // x < level.width and x-dx < oldlevel.width
	const ymin = Math.max(0, dy) // y >= 0 and y-dy >= 0
	const ymax = Math.min(level.height, oldlevel.height+dy) // y < level.height and y-dy < oldlevel.height
	for (var x=xmin; x<xmax; ++x)
	{
		for (var y=ymin; y<ymax; ++y)
		{
			const index = x*level.height + y;
			const old_index = (x-dx)*oldlevel.height + y-dy
			level.setCell(index, oldlevel.getCell(old_index))
		}
	}
}

function addLeftColumn()
{
	copyLevelRegion(adjustLevel(level, 1, 0), level, 1, 0)
}

function addRightColumn()
{
	copyLevelRegion(adjustLevel(level, 1, 0), level, 0, 0)
}

function addTopRow()
{
	copyLevelRegion(adjustLevel(level, 0, 1), level, 0, 1)
}

function addBottomRow()
{
	copyLevelRegion(adjustLevel(level, 0, 1), level, 0, 0)
}

function removeLeftColumn()
{
	if (level.width > 1)
		copyLevelRegion(adjustLevel(level, -1, 0), level, -1, 0)
}

function removeRightColumn()
{
	if (level.width > 1)
		copyLevelRegion(adjustLevel(level, -1, 0), level, 0, 0)
}

function removeTopRow()
{
	if (level.height > 1)
		copyLevelRegion(adjustLevel(level, 0, -1), level, 0, -1)
}

function removeBottomRow()
{
	if (level.height > 1)
		copyLevelRegion(adjustLevel(level, 0, -1), level, 0, 0)
}




// ===========
// PRINT LEVEL
// ===========

function selectText(containerid,e)
{
	e = e || window.event;
	var myspan = document.getElementById(containerid);
	if (e&&(e.ctrlKey || e.metaKey)) {
		var levelarr = ["console"].concat(myspan.innerHTML.split("<br>"));
		var leveldat = levelFromString(state,levelarr);
		loadLevelFromLevelDat(state,leveldat,null);
		canvasResize();
	} else {
		if (document.selection) {
			var range = document.body.createTextRange();
			range.moveToElementText(myspan);
			range.select();
		} else if (window.getSelection) {
			var range = document.createRange();
			range.selectNode(myspan);
			window.getSelection().addRange(range);
		}
	}
}

function matchGlyph(inputmask, glyphAndMask)
{
	// find mask with closest match
	var highestbitcount=-1;
	var highestmask;
	for (var i=0; i<glyphAndMask.length; ++i) {
		var glyphname = glyphAndMask[i][0];
		var glyphmask = glyphAndMask[i][1];
		var glyphbits = glyphAndMask[i][2];
		//require all bits of glyph to be in input
		if (glyphmask.bitsSetInArray(inputmask.data)) {
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
	
	logErrorNoLine("Wasn't able to approximate a glyph value for some tiles, using '.' as a placeholder.",true);
	return '.';
}

const htmlEntityMap = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': '&quot;',
	"'": '&#39;',
	"/": '&#x2F;'
};

var selectableint  = 0;

function printLevel()
{
	var glyphMasks = [];
	for (const [identifier_index, glyph] of state.glyphDict.entries())
	{
		const glyphName = state.identifiers.names[identifier_index];
		if ( (glyphName.length === 1) && [identifier_type_object, identifier_type_aggregate].includes(state.identifiers.comptype[identifier_index]) )
		{
			// var glyph = state.glyphDict[glyphName];
			var glyphmask = makeMaskFromGlyph(glyph);
			var glyphbits = glyphmask.clone();
			//register the same - backgroundmask with the same name
			var bgMask = state.layerMasks[state.backgroundlayer];
			glyphmask.iclear(bgMask);
			glyphMasks.push([glyphName, glyphmask, glyphbits]);
		}
	}
	selectableint++;
	var tag = 'selectable'+selectableint;
	var output="Printing level contents:<br><br><span id=\""+tag+"\" onclick=\"selectText('"+tag+"',event)\">";
	for (var j=0;j<level.height;j++) {
		for (var i=0;i<level.width;i++) {
			var cellIndex = j+i*level.height;
			var cellMask = level.getCell(cellIndex);
			var glyph = matchGlyph(cellMask,glyphMasks);
			if (glyph in htmlEntityMap) {
				glyph = htmlEntityMap[glyph]; 
			}
			output = output+glyph;
		}
		if (j<level.height-1){
			output=output+"<br>";
		}
	}
	output+="</span><br><br>"
	consolePrint(output,true);
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
	const coords = relMouseCoords(e, canvas);
	const virtualscreenCoordX = Math.floor( (coords.x - screen_layout.margins[0]) / screen_layout.magnification )
	const virtualscreenCoordY = Math.floor( (coords.y - screen_layout.margins[1]) / screen_layout.magnification )
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
			printLevel()
		}
		else
		{
			glyphSelectedIndex = this.hovered_glyph_index
			redraw()
		}
		return;
	}

	if (this.hovered_level_cell !== null)
	{
		var glyphmask = makeMaskFromGlyph( state.glyphDict[ glyphImagesCorrespondance[glyphSelectedIndex] ] );

		var backgroundMask = state.layerMasks[state.backgroundlayer];
		if (glyphmask.bitsClearInArray(backgroundMask.data))
		{
			// If we don't already have a background layer, mix in  the default one.
			glyphmask.ibitset(state.backgroundid);
		}

		const coordIndex = this.hovered_level_cell[3] + this.hovered_level_cell[2]*level.height;
		const getcell = level.getCell(coordIndex);
		if (getcell.equals(glyphmask))
			return;
		if (this.anyEditsSinceMouseDown === false)
		{
			this.anyEditsSinceMouseDown = true
			backups.push(backupLevel())
		}
		level.setCell(coordIndex, glyphmask);
		redraw();
		return;
	}

	if ( ( ! click ) || (this.hovered_level_resize === null) )
		return;

	const [w, h] = this.content.get_nb_tiles()

	if (this.hovered_level_resize[2] == -1)
	{
		addLeftColumn();			
	}
	else if (this.hovered_level_resize[2] == w)
	{
		addRightColumn();
	}

	if (this.hovered_level_resize[3] == -1)
	{
		addTopRow();
	}
	else if (this.hovered_level_resize[3] == h)
	{
		addBottomRow();
	}

	canvasResize()
	this.setMouseCoord(event)
	redraw()
}

LevelEditorScreen.prototype.levelEditorRightClick = function(event, click)
{	
	// TODO: [ClementSparrow] This doesn't make sense to me... shouldn't it be the same code than in levelEditorClick?
	if ( click && (this.hovered_glyph_index !== null) )
	{
		glyphSelectedIndex = mouseCoordX;
		redraw();
		return;
	}

	if (this.hovered_level_cell !== null)
	{
		const coordIndex = this.hovered_level_cell[3] + this.hovered_level_cell[2]*level.height;
		var glyphmask = new BitVec(STRIDE_OBJ);
		glyphmask.ibitset(state.backgroundid); // TODO: shouldn't it be the same code than in levelEditorClick?
		level.setCell(coordIndex, glyphmask);
		redraw();
		return;
	}

	if ( ( ! click ) || (this.hovered_level_resize === null) )
		return;

	const [w, h] = this.content.get_nb_tiles()

	if (this.hovered_level_resize[2] == -1)
	{
		//add a left row to the map
		removeLeftColumn();			
	}
	else if (this.hovered_level_resize[2] == w)
	{
		removeRightColumn();
	} 

	if (this.hovered_level_resize[3] == -1)
	{
		removeTopRow();
	}
	else if (this.hovered_level_resize[3] == h)
	{
		removeBottomRow();
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
				glyphSelectedIndex = num;
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
			if (glyphSelectedIndex > 0)
			{
				glyphSelectedIndex--
				canvasResize()
				return true;
			}	
			break;	
		}
		case 187://+
		{
			if (glyphSelectedIndex+1 < glyphImages.length)
			{
				glyphSelectedIndex++
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