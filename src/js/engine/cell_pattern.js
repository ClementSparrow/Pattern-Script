
var STRIDE_OBJ = 1;
var STRIDE_MOV = 1;

function CellPattern(row) {
	this.objectsPresent = row[0];
	this.objectsMissing = row[1];
	this.anyObjectsPresent = row[2];
	this.movementsPresent = row[3];
	this.movementsMissing = row[4];
	this.replacement = null
	this.matches = this.generateMatchFunction()
};

function CellReplacement(row)
{
	[ this.objectsClear, this.objectsSet, this.movementsClear, this.movementsSet, this.movementsLayerMask, this.randomEntityMask, this.randomDirMask ] = row
}

CellReplacement.prototype.cloneInto = function(dest)
{
	this.objectsClear.cloneInto(dest.objectsClear)
	this.objectsSet  .cloneInto(dest.objectsSet)

	this.movementsClear.cloneInto(dest.movementsClear)
	this.movementsSet  .cloneInto(dest.movementsSet)
	dest.movementsLayerMask = this.movementsLayerMask

	dest.randomEntityMask = this.randomEntityMask
	dest.randomDirMask    = this.randomDirMask
}

CellReplacement.prototype.applyRandoms = function()
{
	// replace random entities
	if ( ! this.randomEntityMask.iszero() )
	{
		var choices=[]
		for (var i=0; i<32*STRIDE_OBJ; i++)
		{
			if (this.randomEntityMask.get(i))
			{
				choices.push(i)
			}
		}
		const rand = choices[Math.floor(RandomGen.uniform() * choices.length)]
		const layer = state.identifiers.objects[state.idDict[rand]].layer
		this.objectsSet.ibitset(rand)
		this.objectsClear.ior(state.layerMasks[layer])
		this.movementsClear.ishiftor(0x1f, 5*layer)
	}
	
	// replace random dirs
	for (const layerIndex of this.randomDirMask)
	{
		this.movementsSet.ibitset(Math.floor(RandomGen.uniform()*4) + 5*layerIndex)
	}
}

var make_static_CellReplacement = () => new CellReplacement(Array.from(([1,1,0,0,0,1,0]), (x,i) => (i==6) ? [] : new BitVec(x ? STRIDE_OBJ : STRIDE_MOV) ))
var static_CellReplacement = make_static_CellReplacement()



var matchCache = {};



CellPattern.prototype.generateMatchString = function()
{
	var fn = '(true'
	for (var i = 0; i < Math.max(STRIDE_OBJ, STRIDE_MOV); ++i)
	{
		var co = 'cellObjects' + i
		var cm = 'cellMovements' + i
		var op = this.objectsPresent.data[i]
		var om = this.objectsMissing.data[i]
		var mp = this.movementsPresent.data[i]
		var mm = this.movementsMissing.data[i]
		if (op)
		{ // test that all bits set in op (objects present) are also set in co (cell's objects), i.e. the cell contains all the objects requested
			if (op&(op-1)) // true if op has more than one bit set
				fn += '\t\t&& ((' + co + '&' + op + ')===' + op + ')\n';
			else
				fn += '\t\t&& (' + co + '&' + op + ')\n';
		}
		if (om) // test that 'co & om == 0', i.e. the cell does not contain any of the objects missing (or rather, forbidden objects)
			fn += '\t\t&& !(' + co + '&' + om + ')\n';
		if (mp) {
			if (mp&(mp-1))
				fn += '\t\t&& ((' + cm + '&' + mp + ')===' + mp + ')\n';
			else
				fn += '\t\t&& (' + cm + '&' + mp + ')\n';
		}
		if (mm)
			fn += '\t\t&& !(' + cm + '&' + mm + ')\n';
	}
	// for each set of objects in anyObjectsPresent, test that the cell contains at least one object of the set. That's for properties in a single layer.
	for (const anyObjectPresent of this.anyObjectsPresent)
	{
		fn += "\t\t&& (0";
		for (var i = 0; i < STRIDE_OBJ; ++i) {
			var aop = anyObjectPresent.data[i];
			if (aop)
				fn += "|(cellObjects" + i + "&" + aop + ")";
		}
		fn += ")";
	}
	fn += '\t)';
	return fn;
}

CellPattern.prototype.generateMatchFunction = function()
{
	var i
	var fn = ''
	var mul = STRIDE_OBJ === 1 ? '' : '*'+STRIDE_OBJ
	for (var i = 0; i < STRIDE_OBJ; ++i)
	{
		fn += '\tvar cellObjects' + i + ' = objects[i' + mul + (i ? '+'+i : '') + '];\n'
	}
	mul = STRIDE_MOV === 1 ? '' : '*'+STRIDE_MOV
	for (var i = 0; i < STRIDE_MOV; ++i)
	{
		fn += '\tvar cellMovements' + i + ' = movements[i' + mul + (i ? '+'+i: '') + '];\n';
	}
	fn += 'return ' + this.generateMatchString()+';';
	if (fn in matchCache)
		return matchCache[fn]
	// console.log(fn.replace(/\s+/g, ' '));
	return matchCache[fn] = new Function('i', 'objects', 'movements', fn);
}

CellPattern.prototype.toJSON = function() {
	return [
		this.movementMask, this.cellMask, this.nonExistenceMask,
		this.moveNonExistenceMask, this.moveStationaryMask, this.randomDirOrEntityMask,
		this.movementsToRemove
	];
};

CellPattern.prototype.replaceRigid = function(rule, level, cell_index)
{
	if (this.rigidMask === undefined)
		return false

	const replacementMovementLayerMask = this.replacement.movementsLayerMask

	var curRigidGroupIndexMask = level.rigidGroupIndexMask[cell_index] || new BitVec(STRIDE_MOV)
	var curRigidMovementAppliedMask = level.rigidMovementAppliedMask[cell_index] || new BitVec(STRIDE_MOV)

	// if level.rigidGroupIndexMask[cell_index] is undefined, we take a blank BitVec, so the test bellow will only succeed if rigidMask is zero. Which can only be true if
	// replacementMovementLayerMask is zero. But in that case, the content of the cell will not change, so we could simply not do replaceRigid in that case. And once
	// we have eliminated this possibility we know that if level.rigidGroupIndexMask[cell_index] is undefined, the test bellow will fail
	if ( this.rigidMask.bitsSetInArray(curRigidGroupIndexMask.data) || replacementMovementLayerMask.bitsSetInArray(curRigidMovementAppliedMask.data) )
		return false

	curRigidGroupIndexMask.ior(this.rigidMask)
	level.rigidGroupIndexMask[cell_index] = curRigidGroupIndexMask
	curRigidMovementAppliedMask.ior(replacementMovementLayerMask)
	level.rigidMovementAppliedMask[cell_index] = curRigidMovementAppliedMask
	return true
}

CellPattern.prototype.makeRigidMask = function(rule_rigidMask)
{
	if (this.replacement === null)
		return

	var replacementMovementLayerMask = this.replacement.movementsLayerMask.clone()
	replacementMovementLayerMask.iand(rule_rigidMask)
	if ( replacementMovementLayerMask.iszero() )
		return
	this.rigidMask = replacementMovementLayerMask
}

var _o2_5,_o3,_o6,_o7,_o8,_o9,_o10,_o11;
var _m3;

CellPattern.prototype.replace = function(rule, level, currentIndex)
{
	if (this.replacement === null)
		return false;

	this.replacement.cloneInto(static_CellReplacement)

	// Ensure the movements are cleared in layers from which an object is removed or some movement is set
	static_CellReplacement.movementsClear.ior(this.replacement.movementsLayerMask) // why is this not done directly at the creation of this.replacement?

	static_CellReplacement.applyRandoms()
	
	var oldCellMask = level.getCellInto(currentIndex, _o3)
	var oldMovementMask = level.getMovements(currentIndex)
	
	var curCellMask = oldCellMask.iClearAddInto(static_CellReplacement.objectsClear, static_CellReplacement.objectsSet, _o2_5)
	var curMovementMask = oldMovementMask.iClearAddInto(static_CellReplacement.movementsClear, static_CellReplacement.movementsSet, _m3)

	// Rigid + check if something changed
	if ( ( ! this.replaceRigid(rule, level, currentIndex) ) && oldCellMask.equals(curCellMask) && oldMovementMask.equals(curMovementMask) )
		return false

	// Sfx
	sfxCreateMask .iAddBut(curCellMask, oldCellMask)
	sfxDestroyMask.iAddBut(oldCellMask, curCellMask)

	// Update the level
	level.updateCellContent(currentIndex, curCellMask, curMovementMask)
	return true
}
