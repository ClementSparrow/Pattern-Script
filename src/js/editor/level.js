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
	loadLevelFromLevelDat(state, levelFromString(state, { width: lines[0].length, height: lines.length, grid:lines, lineNumber:'console', }), null)
}

// find mask with closest match
function matchGlyph(inputmask, glyphAndMask)
{
	let highestbitcount = -1
	let highestmask
	for (const [glyphname, glyphmask, glyphbits] of glyphAndMask)
	{
		//require all bits of glyph to be in input
		if (glyphmask.bitsSetInArray(inputmask.data))
		{
			let bitcount = 0
			for (let bit = 0; bit < 32*STRIDE_OBJ; ++bit)
			{
				if (glyphbits.get(bit) && inputmask.get(bit))
					bitcount++
				if (glyphmask.get(bit) && inputmask.get(bit))
					bitcount++
			}
			if (bitcount > highestbitcount)
			{
				highestbitcount = bitcount
				highestmask = glyphname
			}
		}
	}
	if (highestbitcount > 0)
		return highestmask
	
	logError("Wasn't able to approximate a glyph value for some tiles, using '.' as a placeholder.", undefined, true)
	return '.'
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
	const glyphMasks = []
	for (const [identifier_index, glyph] of state.glyphDict.entries())
	{
		const glyphName = state.identifiers.names[identifier_index]
		if ( (glyphName.length === 1) && [identifier_type_object, identifier_type_aggregate].includes(state.identifiers.comptype[identifier_index]) )
		{
			const glyphmask = makeMaskFromGlyph(glyph)
			const glyphbits = glyphmask.clone()
			//register the same - backgroundmask with the same name
			glyphmask.iclear(state.layerMasks[state.backgroundlayer])
			glyphMasks.push([glyphName, glyphmask, glyphbits])
		}
	}
	let output = ''
	for (let j = 0; j < this.height; j++)
	{
		for (let i = 0; i < this.width; i++)
		{
			let glyph = matchGlyph(this.getCell(j + i*this.height), glyphMasks)
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

