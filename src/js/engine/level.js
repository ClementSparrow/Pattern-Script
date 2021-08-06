// uses: STRIDE_OBJ, STRIDE_MOV

// levels are only constructed in engine/engine_base.js/unloadGame and compiler.js/levelFromString
function Level(lineNumber, width, height, layerCount, objects)
{
	// Debug info, should only be needed for the editor, not in the player
	this.lineNumber = lineNumber;
	// Definition of the level layout (should be constant)
	this.width = width;
	this.height = height;
	this.n_tiles = width * height;
	// This has the same value for all levels and should thus be an attribute of the game definition object
	this.layerCount = layerCount;
	// This is both the initial state of the level (constant) and the current state (mutable).
	this.objects = objects;
	// These are game state object (undo history) related to the level but not set or read by this class, and should thus probably be moved out of the class.
	this.commandQueue = [];
	this.commandQueueSourceRules = [];
}

Level.prototype.clone = function()
{
	return new Level(this.lineNumber, this.width, this.height, this.layerCount, new Int32Array(this.objects));
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


// What is this?

var _movementVecs;
var _movementVecIndex = 0;

Level.prototype.getMovements = function(index)
{
	var _movementsVec=_movementVecs[_movementVecIndex];
	_movementVecIndex=(_movementVecIndex+1)%_movementVecs.length;

	for (var i=0; i<STRIDE_MOV; i++)
	{
		_movementsVec.data[i]=this.movements[index*STRIDE_MOV+i];	
	}
	return _movementsVec;
}

Level.prototype.setMovements = function(index, vec)
{
	for (var i = 0; i < vec.data.length; ++i)
	{
		this.movements[index * STRIDE_MOV + i] = vec.data[i];
	}
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

	_o1 = new BitVec(STRIDE_OBJ);
	_o2 = new BitVec(STRIDE_OBJ);
	_o2_5 = new BitVec(STRIDE_OBJ);
	_o3 = new BitVec(STRIDE_OBJ);
	_o4 = new BitVec(STRIDE_OBJ);
	_o5 = new BitVec(STRIDE_OBJ);
	_o6 = new BitVec(STRIDE_OBJ);
	_o7 = new BitVec(STRIDE_OBJ);
	_o8 = new BitVec(STRIDE_OBJ);
	_o9 = new BitVec(STRIDE_OBJ);
	_o10 = new BitVec(STRIDE_OBJ);
	_o11 = new BitVec(STRIDE_OBJ);
	_m1 = new BitVec(STRIDE_MOV);
	_m2 = new BitVec(STRIDE_MOV);
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

Level.prototype.restore = function(lev)
{
	oldflickscreendat = lev.oldflickscreendat.concat([]);

	this.objects = new Int32Array(lev.dat);

	if (this.width !== lev.width || this.height !== lev.height) {
		this.width = lev.width;
		this.height = lev.height;
		this.n_tiles = lev.width * lev.height;
		this.rebuildArrays();
		//regenerate all other stride-related stuff
	}
	else 
	{
	// layercount doesn't change

		for (var i=0;i<this.n_tiles;i++) {
			this.movements[i]=0;
			this.rigidMovementAppliedMask[i]=0;
			this.rigidGroupIndexMask[i]=0;
		}	

		for (var i=0;i<this.height;i++) {
			this.rowCellContents[i].setZero();
		}
		for (var i=0;i<this.width;i++) {
			this.colCellContents[i].setZero();
		}
	}

	againing=false;
	this.commandQueue=[];
	this.commandQueueSourceRules=[];
}
