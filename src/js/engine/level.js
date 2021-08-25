// uses: STRIDE_OBJ, STRIDE_MOV

// levels are only constructed in engine/engine_base.js/unloadGame and compiler.js/levelFromString
function Level(width, height, objects)
{
	// Definition of the level layout (should be constant)
	this.width = width
	this.height = height
	this.n_tiles = width * height
	// This is both the initial state of the level (constant) and the current state (mutable).
	this.objects = objects
}

Level.prototype.clone = function()
{
	return new Level(this.width, this.height, new Int32Array(this.objects))
}

Level.prototype.cellCoord = function(cell_index)
{
	return [ (cell_index/this.height)|0, (cell_index%this.height) ]
}

Level.prototype.delta_index = function(direction)
{
	const [dx, dy] = dirMasksDelta[direction]
	return dx*this.height + dy
}

Level.prototype.getCell = function(index)
{
	return new BitVec(this.objects.subarray(index * STRIDE_OBJ, index * STRIDE_OBJ + STRIDE_OBJ));
}

Level.prototype.getCellInto = function(index, targetarray)
{
	for (var i=0;i<STRIDE_OBJ;i++) {
		targetarray.data[i] = this.objects[index*STRIDE_OBJ+i];
	}
	return targetarray;
}

Level.prototype.mapCellObjects = function(index, func)
{
	for (var i=0; i<STRIDE_OBJ; i++)
	{
		var bits = this.objects[index*STRIDE_OBJ+i]
		for (k=0; bits != 0; k++)
		{
			if (bits & 1)
			{
				func(i*32+k)
			}
			bits >>>= 1
		}
	}
}

Level.prototype.setCell = function(index, vec)
{
	for (var i = 0; i < vec.data.length; ++i)
	{
		this.objects[index * STRIDE_OBJ + i] = vec.data[i];
	}
}


// a set of static movement bitvecs to use as needed.
var _movementVecs
var _movementVecIndex = 0

Level.prototype.getMovements = function(index) // !!! increments _movementVecIndex !
{
	var _movementsVec =_movementVecs[_movementVecIndex]
	_movementVecIndex = (_movementVecIndex+1) % _movementVecs.length

	for (var i=0; i<STRIDE_MOV; i++)
	{
		_movementsVec.data[i] = this.movements[index*STRIDE_MOV + i];	
	}
	return _movementsVec;
}

Level.prototype.setMovements = function(index, vec)
{
	for (var i = 0; i < vec.data.length; ++i)
	{
		this.movements[index*STRIDE_MOV + i] = vec.data[i]
	}
}

Level.prototype.calculateRowColMasks = function()
{
	for(var i=0; i<this.mapCellContents.length; i++)
	{
		this.mapCellContents[i] = 0
	}

	for (var i=0; i<this.width; i++)
	{
		this.colCellContents[i].setZero()
	}

	for (var i=0; i<this.height; i++)
	{
		this.rowCellContents[i].setZero()
	}

	for (var i=0; i<this.width; i++)
	{
		for (var j=0; j<this.height; j++)
		{
			const cellContents = this.getCellInto(j + i*this.height, _o9)
			this.mapCellContents.ior(cellContents)
			this.rowCellContents[j].ior(cellContents)
			this.colCellContents[i].ior(cellContents)
		}
	}
}

Level.prototype.updateCellContent = function(cell_index, cellMask, movMask)
{
	this.setCell(cell_index, cellMask)
	this.setMovements(cell_index, movMask)

	const [x, y] = this.cellCoord(cell_index)
	this.colCellContents[x].ior(cellMask)
	this.rowCellContents[y].ior(cellMask)
	this.mapCellContents.ior(cellMask)
}

Level.prototype.rebuildArrays = function()
{
	this.movements = new Int32Array(this.n_tiles * STRIDE_MOV);

	this.rigidMovementAppliedMask = [];
	this.rigidGroupIndexMask = [];
	this.rowCellContents = [];
	this.colCellContents = [];
	this.mapCellContents = new BitVec(STRIDE_OBJ);
	_movementVecs = [ new BitVec(STRIDE_MOV), new BitVec(STRIDE_MOV), new BitVec(STRIDE_MOV) ]

	static_CellReplacement = make_static_CellReplacement()
	_o2_5 = new BitVec(STRIDE_OBJ);
	_o3 = new BitVec(STRIDE_OBJ);
	_o6 = new BitVec(STRIDE_OBJ);
	_o7 = new BitVec(STRIDE_OBJ);
	_o8 = new BitVec(STRIDE_OBJ);
	_o9 = new BitVec(STRIDE_OBJ);
	_o10 = new BitVec(STRIDE_OBJ);
	_o11 = new BitVec(STRIDE_OBJ);
	_m3 = new BitVec(STRIDE_MOV);

	for (var i=0; i<this.height; i++) {
		this.rowCellContents[i] = new BitVec(STRIDE_OBJ);	    	
	}
	for (var i=0; i<this.width; i++) {
		this.colCellContents[i] = new BitVec(STRIDE_OBJ);	    	
	}

	for (var i=0; i<this.n_tiles; i++)
	{
		this.rigidMovementAppliedMask[i] = new BitVec(STRIDE_MOV);
		this.rigidGroupIndexMask[i] = new BitVec(STRIDE_MOV);
	}
}

Level.prototype.backUp = function()
{
	return {
		objects: new Int32Array(this.objects),
		width:  this.width,
		height: this.height,
	}
}

Level.prototype.forSerialization = function()
{
	return {
		objects : Array.from(this.objects),
		width :  this.width,
		height : this.height,
	}
}

Level.prototype.restore = function(lev)
{
	this.objects = new Int32Array(lev.objects)

	if ( (this.width !== lev.width) || (this.height !== lev.height) )
	{
		this.width = lev.width
		this.height = lev.height
		this.n_tiles = lev.width * lev.height
		this.rebuildArrays() //regenerate all other stride-related stuff
	}
	else 
	{
		// layercount doesn't change
		for (var i=0; i<this.n_tiles; i++)
		{
			this.movements[i] = 0
			this.rigidMovementAppliedMask[i] = 0
			this.rigidGroupIndexMask[i] = 0
		}	

		for (var i=0; i<this.height; i++)
		{
			this.rowCellContents[i].setZero();
		}
		for (var i=0; i<this.width; i++)
		{
			this.colCellContents[i].setZero();
		}
	}

	againing = false
}
