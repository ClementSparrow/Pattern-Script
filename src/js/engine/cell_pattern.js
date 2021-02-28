
var STRIDE_OBJ = 1;
var STRIDE_MOV = 1;

function CellPattern(row) {
	this.objectsPresent = row[0];
	this.objectsMissing = row[1];
	this.anyObjectsPresent = row[2];
	this.movementsPresent = row[3];
	this.movementsMissing = row[4];
	this.matches = this.generateMatchFunction();
	this.replacement = row[5];
};

function CellReplacement(row) {
	this.objectsClear = row[0];
	this.objectsSet = row[1];
	this.movementsClear = row[2];
	this.movementsSet = row[3];
	this.movementsLayerMask = row[4];
	this.randomEntityMask = row[5];
	this.randomDirMask = row[6];
};


var matchCache = {};



CellPattern.prototype.generateMatchString = function()
{
	var fn = "(true";
	for (var i = 0; i < Math.max(STRIDE_OBJ, STRIDE_MOV); ++i)
	{
		var co = 'cellObjects' + i;
		var cm = 'cellMovements' + i;
		var op = this.objectsPresent.data[i];
		var om = this.objectsMissing.data[i];
		var mp = this.movementsPresent.data[i];
		var mm = this.movementsMissing.data[i];
		if (op)
		{
			if (op&(op-1))
				fn += '\t\t&& ((' + co + '&' + op + ')===' + op + ')\n';
			else
				fn += '\t\t&& (' + co + '&' + op + ')\n';
		}
		if (om)
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

CellPattern.prototype.generateMatchFunction = function() {
	var i;
	var fn = '';
	var mul = STRIDE_OBJ === 1 ? '' : '*'+STRIDE_OBJ;	
	for (var i = 0; i < STRIDE_OBJ; ++i) {
		fn += '\tvar cellObjects' + i + ' = level.objects[i' + mul + (i ? '+'+i: '') + '];\n';
	}
	mul = STRIDE_MOV === 1 ? '' : '*'+STRIDE_MOV;
	for (var i = 0; i < STRIDE_MOV; ++i) {
		fn += '\tvar cellMovements' + i + ' = level.movements[i' + mul + (i ? '+'+i: '') + '];\n';
	}
	fn += "return " + this.generateMatchString()+';';
	if (fn in matchCache) {
		return matchCache[fn];
	}
	// console.log(fn.replace(/\s+/g, ' '));
	return matchCache[fn] = new Function("i",fn);
}

CellPattern.prototype.toJSON = function() {
	return [
		this.movementMask, this.cellMask, this.nonExistenceMask,
		this.moveNonExistenceMask, this.moveStationaryMask, this.randomDirOrEntityMask,
		this.movementsToRemove
	];
};

var _o1,_o2,_o2_5,_o3,_o4,_o5,_o6,_o7,_o8,_o9,_o10,_o11,_o12;
var _m1,_m2,_m3;

CellPattern.prototype.replace = function(rule, currentIndex) {
	var replace = this.replacement;

	if (replace === null) {
		return false;
	}

	const replace_RandomEntityMask = replace.randomEntityMask;
	const replace_RandomDirMask = replace.randomDirMask;

	var objectsSet = replace.objectsSet.cloneInto(_o1);
	var objectsClear = replace.objectsClear.cloneInto(_o2);

	var movementsSet = replace.movementsSet.cloneInto(_m1);
	var movementsClear = replace.movementsClear.cloneInto(_m2);
	movementsClear.ior(replace.movementsLayerMask);

	if (!replace_RandomEntityMask.iszero()) {
		var choices=[];
		for (var i=0;i<32*STRIDE_OBJ;i++) {
			if (replace_RandomEntityMask.get(i)) {
				choices.push(i);
			}
		}
		const rand = choices[Math.floor(RandomGen.uniform() * choices.length)];
		const layer = state.identifiers.objects[state.idDict[rand]].layer;
		objectsSet.ibitset(rand);
		objectsClear.ior(state.layerMasks[layer]);
		movementsClear.ishiftor(0x1f, 5 * layer);
	}
	if (!replace_RandomDirMask.iszero()) {
		for (var layerIndex=0;layerIndex<level.layerCount;layerIndex++){
			if (replace_RandomDirMask.get(5*layerIndex)) {
				var randomDir = Math.floor(RandomGen.uniform()*4);
				movementsSet.ibitset(randomDir + 5 * layerIndex);
			}
		}
	}
	
	var curCellMask = level.getCellInto(currentIndex,_o2_5);
	var curMovementMask = level.getMovements(currentIndex);

	var oldCellMask = curCellMask.cloneInto(_o3);
	var oldMovementMask = curMovementMask.cloneInto(_m3);

	curCellMask.iclear(objectsClear);
	curCellMask.ior(objectsSet);

	curMovementMask.iclear(movementsClear);
	curMovementMask.ior(movementsSet);

	var rigidchange=false;
	var curRigidGroupIndexMask =0;
	var curRigidMovementAppliedMask =0;
	if (rule.isRigid) {
		var rigidGroupIndex = state.groupNumber_to_RigidGroupIndex[rule.groupNumber];
		rigidGroupIndex++;//don't forget to -- it when decoding :O
		var rigidMask = new BitVec(STRIDE_MOV);
		for (var layer = 0; layer < level.layerCount; layer++) {
			rigidMask.ishiftor(rigidGroupIndex, layer * 5);
		}
		rigidMask.iand(replace.movementsLayerMask);
		curRigidGroupIndexMask = level.rigidGroupIndexMask[currentIndex] || new BitVec(STRIDE_MOV);
		curRigidMovementAppliedMask = level.rigidMovementAppliedMask[currentIndex] || new BitVec(STRIDE_MOV);

		if (!rigidMask.bitsSetInArray(curRigidGroupIndexMask.data) &&
			!replace.movementsLayerMask.bitsSetInArray(curRigidMovementAppliedMask.data) ) {
			curRigidGroupIndexMask.ior(rigidMask);
			curRigidMovementAppliedMask.ior(replace.movementsLayerMask);
			rigidchange=true;

		}
	}

	var result = false;

	//check if it's changed
	if (!oldCellMask.equals(curCellMask) || !oldMovementMask.equals(curMovementMask) || rigidchange) { 
		result=true;
		if (rigidchange) {
			level.rigidGroupIndexMask[currentIndex] = curRigidGroupIndexMask;
			level.rigidMovementAppliedMask[currentIndex] = curRigidMovementAppliedMask;
		}

		var created = curCellMask.cloneInto(_o4);
		created.iclear(oldCellMask);
		sfxCreateMask.ior(created);
		var destroyed = oldCellMask.cloneInto(_o5);
		destroyed.iclear(curCellMask);
		sfxDestroyMask.ior(destroyed);

		level.setCell(currentIndex, curCellMask);
		level.setMovements(currentIndex, curMovementMask);

		var colIndex=(currentIndex/level.height)|0;
		var rowIndex=(currentIndex%level.height);
		level.colCellContents[colIndex].ior(curCellMask);
		level.rowCellContents[rowIndex].ior(curCellMask);
		level.mapCellContents.ior(curCellMask);
	}

	return result;
}
