var ellipsisPattern = ['ellipsis'];

function Rule(rule, string_representation)
{
	this.direction = rule[0]; 		/* direction rule scans in */
	this.patterns = rule[1];		/* lists of CellPatterns to match */
	this.hasReplacements = rule[2];
	this.lineNumber = rule[3];		/* rule source for debugging */
	this.isEllipsis = rule[4];		/* true if pattern has ellipsis */
	this.groupNumber = rule[5];		/* execution group number of rule */
	this.isRigid = rule[6];
	this.commands = rule[7];		/* cancel, restart, sfx, etc */
	this.isRandom = rule[8];
	this.parameter_expansion_string = rule[9]
	this.cellRowMasks = this.patterns.map( p => computePatternMask(p) )
	this.cellRowMatches = this.patterns.map( (p,i) => this.generateCellRowMatchesFunction(p, this.isEllipsis[i]) )
	this.ruleMask = this.cellRowMasks.reduce( (acc, m) => { acc.ior(m); return acc }, new BitVec(STRIDE_OBJ) )
	/* TODO: eliminate isRigid, groupNumber, isRandom
	from this class by moving them up into a RuleGroup class */
	this.string_representation = string_representation
	this.makeRigidMask()
}

function computePatternMask(cellRow)
{
	var rowMask = new BitVec(STRIDE_OBJ)
	for (const cell of cellRow)
	{
		if (cell === ellipsisPattern)
			continue
		rowMask.ior(cell.objectsPresent)
	}
	return rowMask
}

// See notes on generation in engine/generate_matches.js

Rule.prototype.generateCellRowMatchesFunction = function(cellRow, hasEllipsis)
{
	const cr_l = cellRow.length
	var fn = ''
	if (hasEllipsis === false)
	{
		var mul = STRIDE_OBJ === 1 ? '' : '*'+STRIDE_OBJ;	
		for (var i = 0; i < STRIDE_OBJ; ++i) {
			fn += 'var cellObjects' + i + ' = objects[i' + mul + (i ? '+'+i : '') + '];\n';
		}
		mul = STRIDE_MOV === 1 ? '' : '*'+STRIDE_MOV;
		for (var i = 0; i < STRIDE_MOV; ++i) {
			fn += 'var cellMovements' + i + ' = movements[i' + mul + (i ? '+'+i : '') + '];\n';
		}
		/*
		hard substitute in the first one - if I substitute in all of them, firefox chokes.
		*/
		fn += "return "+cellRow[0].generateMatchString('0_');// cellRow[0].matches(i)";
		for (var cellIndex=1; cellIndex<cr_l; cellIndex++)
		{
			fn+="&&cellRow["+cellIndex+"].matches(i+"+cellIndex+"*d, objects, movements)";
		}
		fn+=";";

		if (fn in matchCache) {
			return matchCache[fn];
		}
		//console.log(fn.replace(/\s+/g, ' '));
		return matchCache[fn] = new Function('cellRow', 'i', 'd', 'objects', 'movements', fn)
	}
	else
	{
		fn += "var result = [];\n"
		fn += "if(cellRow[0].matches(i, objects, movements)";
		var cellIndex=1;
		for (;cellRow[cellIndex]!==ellipsisPattern;cellIndex++) {
			fn+="&&cellRow["+cellIndex+"].matches(i+"+cellIndex+"*d, objects, movements)";
		}
		cellIndex++;
		fn+=") {\n";
		fn+="\tfor (var k=kmin;k<kmax;k++) {\n"
		fn+="\t\tif(cellRow["+cellIndex+"].matches(i+d*(k+"+(cellIndex-1)+"), objects, movements)";
		cellIndex++;
		for (;cellIndex<cr_l;cellIndex++) {
			fn+="&&cellRow["+cellIndex+"].matches(i+d*(k+"+(cellIndex-1)+"), objects, movements)";			
		}
		fn+="){\n";
		fn+="\t\t\tresult.push([i,k]);\n";
		fn+="\t\t}\n"
		fn+="\t}\n";				
		fn+="}\n";		
		fn+="return result;"


		if (fn in matchCache) {
			return matchCache[fn];
		}
		//console.log(fn.replace(/\s+/g, ' '));
		return matchCache[fn] = new Function('cellRow', 'i', 'kmax', 'kmin', 'd', 'objects', 'movements', fn)
	}	

}


Rule.prototype.toJSON = function() {
	/* match construction order for easy deserialization */
	return [
		this.direction, this.patterns, this.hasReplacements, this.lineNumber, this.isEllipsis,
		this.groupNumber, this.isRigid, this.commands, this.isRandom, this.cellRowMasks
	];
}



function matchCellRow(level, direction, cellRowMatch, cellRow, cellRowMask, d)
{
	const len = cellRow.length - 1

	var xmin = (direction === 4) ? len : 0
	var xmax = level.width - ((direction === 8) ? len : 0)
	var ymin = (direction === 1) ? len : 0
	var ymax = level.height - ((direction === 2) ? len : 0)

	var result = []
	
	if (direction>2)
	{ // horizontal

		for (var y=ymin; y<ymax; y++)
		{
			if ( ! cellRowMask.bitsSetInArray(level.rowCellContents[y].data) )
				continue

			for (var x=xmin; x<xmax; x++)
			// for (const x of possible_xs)
			{
				const i = x*level.height + y
				if (cellRowMatch(cellRow, i, d, level.objects, level.movements))
				{
					result.push(i)
				}
			}
		}
	}
	else
	{
		for (var x=xmin; x<xmax; x++)
		{
			if ( ! cellRowMask.bitsSetInArray(level.colCellContents[x].data) )
				continue

			for (var y=ymin; y<ymax; y++)
			{
				const i = x*level.height + y
				if (cellRowMatch(cellRow, i, d, level.objects, level.movements))
				{
					result.push(i)
				}
			}
		}		
	}
	return result
}


function matchCellRowWildCard(level, direction, cellRowMatch, cellRow, cellRowMask, d)
{
	const len = cellRow.length - 2//remove one to deal with wildcard (it takes one cell in cellRow, but can be entirely skipped)

	const xmin = (direction === 4) ? len : 0
	const xmax = level.width - ((direction === 8) ? len : 0)
	const ymin = (direction === 1) ? len : 0
	const ymax = level.height - ((direction === 2) ? len : 0)

	var result = []

	if (direction > 2)
	{ // horizontal
		for (var y=ymin; y<ymax; y++)
		{
			if ( ! cellRowMask.bitsSetInArray(level.rowCellContents[y].data) )
				continue

			for (var x=xmin; x<xmax; x++)
			{
				const kmax = (direction === 4) ? 1+x-xmin : (xmax-x)
				result.push.apply(result, cellRowMatch(cellRow, x*level.height + y, kmax, 0, d, level.objects, level.movements))
			}
		}
	}
	else
	{
		for (var x=xmin; x<xmax; x++)
		{
			if ( ! cellRowMask.bitsSetInArray(level.colCellContents[x].data) )
				continue

			for (var y=ymin; y<ymax; y++)
			{
				const kmax = (direction === 2) ? ymax-y : (1+y-ymin)
				result.push.apply(result, cellRowMatch(cellRow, x*level.height + y, kmax, 0, d, level.objects, level.movements))
			}
		}		
	}

	return result
}

Rule.prototype.findMatches = function(level)
{
	if ( ! this.ruleMask.bitsSetInArray(level.mapCellContents.data) )
		return []

	const d = level.delta_index(this.direction)

	var matches = []
	const cellRowMasks = this.cellRowMasks
	for (const [cellRowIndex, cellRow] of this.patterns.entries())
	{
		const cellRowMask = cellRowMasks[cellRowIndex]

		const matchFunction = this.cellRowMatches[cellRowIndex];
		if (this.isEllipsis[cellRowIndex])
		{
			var match = matchCellRowWildCard(level, this.direction, matchFunction, cellRow, cellRowMask, d)
		} else {
			var match = matchCellRow(level, this.direction, matchFunction, cellRow, cellRowMask, d)
		}
		if (match.length === 0)
			return match
		matches.push(match)
	}
	return matches
}

Rule.prototype.applyAt = function(level, tuple, check, delta_index = level.delta_index(this.direction))
{
	// have to double check they apply because the first check only tested individual cell rows and called this function for all possible tuples,
	// but the application of one rule can invalidate the next ones.
	if (check)
	{
		for (var cellRowIndex=0; cellRowIndex<this.patterns.length; cellRowIndex++)
		{
			if (this.isEllipsis[cellRowIndex]) //if ellipsis
			{
				if ( this.cellRowMatches[cellRowIndex](this.patterns[cellRowIndex], tuple[cellRowIndex][0], tuple[cellRowIndex][1]+1, tuple[cellRowIndex][1], delta_index, level.objects, level.movements).length == 0 )
					return false
			}
			else if ( ! this.cellRowMatches[cellRowIndex](this.patterns[cellRowIndex], tuple[cellRowIndex], delta_index, level.objects, level.movements) )
				return false
		}
	}

	var result=false;
	
	//APPLY THE RULE
	for (var cellRowIndex=0; cellRowIndex<this.patterns.length; cellRowIndex++)
	{
		var preRow = this.patterns[cellRowIndex];
		
		var currentIndex = this.isEllipsis[cellRowIndex] ? tuple[cellRowIndex][0] : tuple[cellRowIndex];
		for (const preCell of preRow)
		{
			if (preCell === ellipsisPattern)
			{
				var k = tuple[cellRowIndex][1];
				currentIndex += delta_index*k
				continue;
			}
			result = preCell.replace(this, level, currentIndex) || result;
			currentIndex += delta_index
		}
	}

	if (verbose_logging && result)
	{
		const rule_expansion = (this.parameter_expansion_string.length > 0) ? ' '+this.parameter_expansion_string : ''
		const cell_positions = tuple.map( (x,i) => this.isEllipsis[i] ? x[0] : x ).map( i => level.cellCoord(i).map(c => c.toString()) )
		const position = cell_positions.map(([x,y]) => '<a class="cellhighlighter" onmouseleave="highlightCell(null);" onmouseenter="highlightCell(['+x+','+y+'])">('+x+';'+y+')</a>').join(', ')
		consolePrint('<font color="green">Rule ' + makeLinkToLine(this.lineNumber) + rule_expansion + ' applied at ' + position + '.</font>');
	}

	return result
}

Rule.prototype.tryApply = function(level)
{
	const delta = level.delta_index(this.direction)

	//get all cellrow matches
	const matches = this.findMatches(level)
	if (matches.length === 0)
		return false

	var result = false
	if (this.hasReplacements)
	{
		var chk = false
		for (const tuple of cartesian_product(...matches))
		{
			result = this.applyAt(level, tuple, chk, delta) || result
			chk = true
		}
	}

	this.queueCommands()
	return result
}

Rule.prototype.queueCommands = function()
{

	// priority cancel > restart > everything else + sfx and message commands allowed after a cancel / restart

	// if cancel is the queue from other rules, ignore everything
	const preexisting_cancel = execution_context.commandQueue.get(CommandsSet.command_keys.cancel)
	if (preexisting_cancel)
		return

	// if restart is in the queue from other rules, only apply if there's a cancel present here
	const preexisting_restart = execution_context.commandQueue.get(CommandsSet.command_keys.restart)
	const currule_cancel = this.commands.get(CommandsSet.command_keys.cancel)
	if ( preexisting_restart && ( ! currule_cancel ) )
		return

	//if you are writing a cancel or restart, clear the current queue
	if ( this.commands.get(CommandsSet.command_keys.restart) || currule_cancel )
	{
		this.commands.cloneInto(execution_context.commandQueue)
	}
	else
	{
		execution_context.commandQueue.ior(this.commands)
	}

	if (this.commands.message !== null)
	{
		messagetext = execution_context.commandQueue.message = this.commands.message
	}

	if (verbose_logging)
	{
		for(const command of CommandsSet.commandwords.filter( (k,i) => this.commands.get(i) ) )
		{
			consolePrint('<font color="green">Rule ' + makeLinkToLine(this.lineNumber) + ' triggers command ' + command + '.</font>', true)
			execution_context.commandQueue.sourceRules[CommandsSet.command_keys[command]] = this
		}
	}
}


Rule.prototype.makeRigidMask = function(nb_layers, STRIDE_MOV, rigidGroupIndex)
{
	if ( ! this.isRigid )
		return

	// write the rigidGroupIndex in all layers identified by replacementMovementLayerMask
	this.rigidMask = new BitVec(STRIDE_MOV)
	for (var layer = 0; layer < nb_layers; layer++)
	{
		this.rigidMask.ishiftor(rigidGroupIndex, layer * 5)
	}
	for (const pattern of this.patterns)
	{
		for (const cell_pattern of pattern)
		{
			cell_pattern.makeRigidMask(this.rigidMask)
		}
	}
}
