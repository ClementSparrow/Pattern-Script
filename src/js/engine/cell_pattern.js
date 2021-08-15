
var STRIDE_OBJ = 1;
var STRIDE_MOV = 1;

function CellPattern(row) {
	this.objectsPresent = row[0];
	this.objectsMissing = row[1];
	this.anyObjectsPresent = row[2];
	this.movementsPresent = row[3];
	this.movementsMissing = row[4];
	this.replacement = null
	this.matches = this.generateMatchFunction();
};

function CellReplacement(row) {
	[ this.objectsClear, this.objectsSet, this.movementsClear, this.movementsSet, this.movementsLayerMask, this.randomEntityMask, this.randomDirMask ] = row
};

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
	if ( ! this.randomDirMask.iszero() )
	{
		for (var layerIndex=0; layerIndex<level.layerCount; layerIndex++)
		{
			if (this.randomDirMask.get(5*layerIndex))
			{
				const randomDir = Math.floor(RandomGen.uniform()*4)
				this.movementsSet.ibitset(randomDir + 5*layerIndex)
			}
		}
	}
}

var make_static_CellReplacement = () => new CellReplacement(Array.from(([1,1,0,0,0,1,0]), x => new BitVec(x ? STRIDE_OBJ : STRIDE_MOV) ))
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
		fn += '\tvar cellObjects' + i + ' = level.objects[i' + mul + (i ? '+'+i : '') + '];\n'
	}
	mul = STRIDE_MOV === 1 ? '' : '*'+STRIDE_MOV
	for (var i = 0; i < STRIDE_MOV; ++i)
	{
		fn += '\tvar cellMovements' + i + ' = level.movements[i' + mul + (i ? '+'+i: '') + '];\n';
	}
	fn += 'return ' + this.generateMatchString()+';';
	if (fn in matchCache)
		return matchCache[fn]
	// console.log(fn.replace(/\s+/g, ' '));
	return matchCache[fn] = new Function('i', fn);
}

CellPattern.prototype.toJSON = function() {
	return [
		this.movementMask, this.cellMask, this.nonExistenceMask,
		this.moveNonExistenceMask, this.moveStationaryMask, this.randomDirOrEntityMask,
		this.movementsToRemove
	];
};

function replaceRigid(rule, level, cell_index, replacementMovementLayerMask)
{
	if ( ! rule.isRigid )
		return false

	var rigidGroupIndex = state.groupNumber_to_RigidGroupIndex[rule.groupNumber] // TODO pass that as function parameter instead of rule (null if rule is not rigid)
	rigidGroupIndex++;//don't forget to -- it when decoding :O

	// write the rigidGroupIndex in all layers identified by replacementMovementLayerMask
	var rigidMask = new BitVec(STRIDE_MOV); // TODO: use a static variable
	for (var layer = 0; layer < level.layerCount; layer++) {
		rigidMask.ishiftor(rigidGroupIndex, layer * 5);
	}
	rigidMask.iand(replacementMovementLayerMask)

	var curRigidGroupIndexMask = level.rigidGroupIndexMask[cell_index] || new BitVec(STRIDE_MOV); // TODO: use a static variable
	var curRigidMovementAppliedMask = level.rigidMovementAppliedMask[cell_index] || new BitVec(STRIDE_MOV); // TODO: use a static variable

	if ( rigidMask.bitsSetInArray(curRigidGroupIndexMask.data) || replacementMovementLayerMask.bitsSetInArray(curRigidMovementAppliedMask.data) )
		return false

	curRigidGroupIndexMask.ior(rigidMask);
	curRigidMovementAppliedMask.ior(replacementMovementLayerMask);
	level.rigidGroupIndexMask[cell_index] = curRigidGroupIndexMask;
	level.rigidMovementAppliedMask[cell_index] = curRigidMovementAppliedMask;
	return true
}

var _o2_5,_o3,_o4,_o5,_o6,_o7,_o8,_o9,_o10,_o11;
var _m3;

CellPattern.prototype.replace = function(rule, currentIndex)
{
	if (this.replacement === null)
		return false;

	this.replacement.cloneInto(static_CellReplacement)

	// Ensure the movements are cleared in layers from which an object is removed or some movement is set
	static_CellReplacement.movementsClear.ior(this.replacement.movementsLayerMask) // why is this not done directly at the creation of this.replacement?

	static_CellReplacement.applyRandoms()
	
	var curCellMask = level.getCellInto(currentIndex,_o2_5);
	var curMovementMask = level.getMovements(currentIndex);

	var oldCellMask = curCellMask.cloneInto(_o3);
	var oldMovementMask = curMovementMask.cloneInto(_m3);

	curCellMask.iclear(static_CellReplacement.objectsClear);
	curCellMask.ior(static_CellReplacement.objectsSet);

	curMovementMask.iclear(static_CellReplacement.movementsClear)
	curMovementMask.ior(static_CellReplacement.movementsSet);

	// Rigid + check if something changed
	if ( ( ! replaceRigid(rule, level, currentIndex, this.replacement.movementsLayerMask) ) && oldCellMask.equals(curCellMask) && oldMovementMask.equals(curMovementMask) )
		return false

	// Sfx
	var created = curCellMask.cloneInto(_o4);
	created.iclear(oldCellMask);
	sfxCreateMask.ior(created);
	var destroyed = oldCellMask.cloneInto(_o5);
	destroyed.iclear(curCellMask);
	sfxDestroyMask.ior(destroyed);

	// Update the level
	level.updateCellContent(currentIndex, curCellMask, curMovementMask)
	return true
}
