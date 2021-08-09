var ellipsisPattern = ['ellipsis'];

function Rule(rule) {
	this.direction = rule[0]; 		/* direction rule scans in */
	this.patterns = rule[1];		/* lists of CellPatterns to match */
	this.hasReplacements = rule[2];
	this.lineNumber = rule[3];		/* rule source for debugging */
	this.isEllipsis = rule[4];		/* true if pattern has ellipsis */
	this.groupNumber = rule[5];		/* execution group number of rule */
	this.isRigid = rule[6];
	this.commands = rule[7];		/* cancel, restart, sfx, etc */
	this.isRandom = rule[8];
	this.cellRowMasks = rule[9];
	this.parameter_expansion_string = rule[10]
	this.cellRowMatches = [];
	for (var i=0;i<this.patterns.length;i++) {
		this.cellRowMatches.push(this.generateCellRowMatchesFunction(this.patterns[i],this.isEllipsis[i]));
	}
	/* TODO: eliminate isRigid, groupNumber, isRandom
	from this class by moving them up into a RuleGroup class */
}


Rule.prototype.generateCellRowMatchesFunction = function(cellRow,hasEllipsis)  {
	if (hasEllipsis==false) {
		var delta = dirMasksDelta[this.direction];
		var d0 = delta[0];
		var d1 = delta[1];
		var cr_l = cellRow.length;

			/*
			hard substitute in the first one - if I substitute in all of them, firefox chokes.
			*/
		var fn = "var d = "+d1+"+"+d0+"*level.height;\n";
		var mul = STRIDE_OBJ === 1 ? '' : '*'+STRIDE_OBJ;	
		for (var i = 0; i < STRIDE_OBJ; ++i) {
			fn += 'var cellObjects' + i + ' = level.objects[i' + mul + (i ? '+'+i: '') + '];\n';
		}
		mul = STRIDE_MOV === 1 ? '' : '*'+STRIDE_MOV;
		for (var i = 0; i < STRIDE_MOV; ++i) {
			fn += 'var cellMovements' + i + ' = level.movements[i' + mul + (i ? '+'+i: '') + '];\n';
		}
		fn += "return "+cellRow[0].generateMatchString('0_');// cellRow[0].matches(i)";
		for (var cellIndex=1;cellIndex<cr_l;cellIndex++) {
			fn+="&&cellRow["+cellIndex+"].matches((i+"+cellIndex+"*d))";
		}
		fn+=";";

		if (fn in matchCache) {
			return matchCache[fn];
		}
		//console.log(fn.replace(/\s+/g, ' '));
		return matchCache[fn] = new Function("cellRow","i",fn);
	} else {
		var delta = dirMasksDelta[this.direction];
		var d0 = delta[0];
		var d1 = delta[1];
		var cr_l = cellRow.length;


		var fn = "var d = "+d1+"+"+d0+"*level.height;\n";
		fn += "var result = [];\n"
		fn += "if(cellRow[0].matches(i)";
		var cellIndex=1;
		for (;cellRow[cellIndex]!==ellipsisPattern;cellIndex++) {
			fn+="&&cellRow["+cellIndex+"].matches((i+"+cellIndex+"*d))";
		}
		cellIndex++;
		fn+=") {\n";
		fn+="\tfor (var k=kmin;k<kmax;k++) {\n"
		fn+="\t\tif(cellRow["+cellIndex+"].matches((i+d*(k+"+(cellIndex-1)+")))";
		cellIndex++;
		for (;cellIndex<cr_l;cellIndex++) {
			fn+="&&cellRow["+cellIndex+"].matches((i+d*(k+"+(cellIndex-1)+")))";			
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
		return matchCache[fn] = new Function("cellRow","i","kmax","kmin",fn);
	}
//say cellRow has length 3, with a split in the middle
/*
function cellRowMatchesWildcardFunctionGenerate(direction,cellRow,i, maxk, mink) {

	var result = [];
	var matchfirsthalf = cellRow[0].matches(i);
	if (matchfirsthalf) {
		for (var k=mink;k<maxk;k++) {
			if (cellRow[2].matches((i+d*(k+0)))) {
				result.push([i,k]);
			}
		}
	}
	return result;
}
*/
	

}


Rule.prototype.toJSON = function() {
	/* match construction order for easy deserialization */
	return [
		this.direction, this.patterns, this.hasReplacements, this.lineNumber, this.isEllipsis,
		this.groupNumber, this.isRigid, this.commands, this.isRandom, this.cellRowMasks
	];
};







function matchCellRow(direction, cellRowMatch, cellRow, cellRowMask)
{
	if ( ! cellRowMask.bitsSetInArray(level.mapCellContents.data) )
		return []

	const len = cellRow.length - 1

	const xmin = (direction === 4) ? len : 0
	const xmax = level.width - ((direction === 8) ? len : 0)
	const ymin = (direction === 1) ? len : 0
	const ymax = level.height - ((direction === 2) ? len : 0)

	var result = []
	
	if (direction>2)
	{ // horizontal
		for (var y=ymin; y<ymax; y++)
		{
			if ( ! cellRowMask.bitsSetInArray(level.rowCellContents[y].data) )
				continue

			for (var x=xmin; x<xmax; x++)
			{
				const i = x*level.height + y
				if (cellRowMatch(cellRow,i))
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
				if (cellRowMatch(cellRow,i))
				{
					result.push(i)
				}
			}
		}		
	}
	return result
}


function matchCellRowWildCard(direction, cellRowMatch, cellRow, cellRowMask)
{
	if ( ! cellRowMask.bitsSetInArray(level.mapCellContents.data) )
		return []

	const len = cellRow.length - 2//remove one to deal with wildcard

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
				result.push.apply(result, cellRowMatch(cellRow, x*level.height + y, kmax, 0))
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
				result.push.apply(result, cellRowMatch(cellRow, x*level.height + y, kmax, 0))
			}
		}		
	}

	return result
}

Rule.prototype.findMatches = function()
{
	var matches = []
	const cellRowMasks = this.cellRowMasks
	for (const [cellRowIndex, cellRow] of this.patterns.entries())
	{
		const matchFunction = this.cellRowMatches[cellRowIndex];
		if (this.isEllipsis[cellRowIndex])
		{
			var match = matchCellRowWildCard(this.direction, matchFunction, cellRow, cellRowMasks[cellRowIndex])
		} else {
			var match = matchCellRow(this.direction, matchFunction, cellRow, cellRowMasks[cellRowIndex])
		}
		if (match.length === 0)
			return []
		matches.push(match)
	}
	return matches
}


//say cellRow has length 5, with a split in the middle
/*
function cellRowMatchesWildcardFunctionGenerate(direction,cellRow,i, maxk, mink) {

	var result = [];
	var matchfirsthalf = cellRow[0].matches(i)&&cellRow[1].matches((i+d)%level.n_tiles);
	if (matchfirsthalf) {
		for (var k=mink,kmaxk;k++) {
			if (cellRow[2].matches((i+d*(k+0))%level.n_tiles)&&cellRow[2].matches((i+d*(k+1))%level.n_tiles)) {
				result.push([i,k]);
			}
		}
	}
	return result;
}
*/

function DoesCellRowMatchWildCard(delta_index, cellRow, start_cell_index, maxk, mink=0)
{
	var targetIndex = start_cell_index

	for (var j=0; j<cellRow.length; j++)
	{

		var cellPattern = cellRow[j]
		if (cellPattern === ellipsisPattern)
		{
			//BAM inner loop time
			for (var k=mink; k<maxk; k++)
			{
				var targetIndex2 = (targetIndex + delta_index*k + level.n_tiles) % level.n_tiles
				for (var j2=j+1; j2<cellRow.length; j2++)
				{
					cellPattern = cellRow[j2];
					if ( ! cellPattern.matches(targetIndex2) )
						break;
					targetIndex2 += delta_index
				}

				if (j2 >= cellRow.length)
					return true
			}
			break
		}
		else if (!cellPattern.matches(targetIndex))
			break
		targetIndex += delta_index
	}
	return false
}

//say cellRow has length 3
/*
CellRow Matches can be specialized to look something like:
function cellRowMatchesFunctionGenerate(direction,cellRow,i) {
	var delta = dirMasksDelta[direction];
	var d = delta[1]+delta[0]*level.height;
	return cellRow[0].matches(i)&&cellRow[1].matches((i+d)%level.n_tiles)&&cellRow[2].matches((i+2*d)%level.n_tiles);
}
*/

function DoesCellRowMatch(delta_index, cellRow, start_cell_index)
{
	var targetIndex = start_cell_index
	for (const cellPattern of cellRow)
	{
		if ( ! cellPattern.matches(targetIndex) )
			return false
		targetIndex += delta_index
	}
	return true
}

Rule.prototype.applyAt = function(tuple, check, delta_index = level.delta_index(this.direction))
{
	//have to double check they apply because the first check only tested individual cell rows and called this function for all possible tuples, but the application of one rule can invalidate the next ones
	if (check)
	{
		for (var cellRowIndex=0; cellRowIndex<this.patterns.length; cellRowIndex++)
		{
			if (this.isEllipsis[cellRowIndex]) //if ellipsis
			{
				if (DoesCellRowMatchWildCard(delta_index, this.patterns[cellRowIndex], tuple[cellRowIndex][0],
						tuple[cellRowIndex][1]+1, tuple[cellRowIndex][1]) === false) /* pass mink to specify */
					return false
			}
			else if (DoesCellRowMatch(delta_index, this.patterns[cellRowIndex], tuple[cellRowIndex]) === false)
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
			result = preCell.replace(this, currentIndex) || result;
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

Rule.prototype.tryApply = function()
{
	const delta = level.delta_index(this.direction)

	//get all cellrow matches
	const matches = this.findMatches()
	if (matches.length === 0)
		return false

	var result = false
	if (this.hasReplacements)
	{
		var chk = false
		for (const tuple of cartesian_product(...matches))
		{
			result = this.applyAt(tuple, chk, delta) || result
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
	const preexisting_cancel = level.commandQueue.get(CommandsSet.command_keys.cancel)
	if (preexisting_cancel)
		return

	// if restart is in the queue from other rules, only apply if there's a cancel present here
	const preexisting_restart = level.commandQueue.get(CommandsSet.command_keys.restart)
	const currule_cancel = this.commands.get(CommandsSet.command_keys.cancel)
	if ( preexisting_restart && ( ! currule_cancel ) )
		return

	//if you are writing a cancel or restart, clear the current queue
	if ( this.commands.get(CommandsSet.command_keys.restart) || currule_cancel )
	{
		this.commands.cloneInto(level.commandQueue)
	}
	else
	{
		level.commandQueue.ior(this.commands)
	}

	if (this.commands.message !== null)
	{
		level.commandQueue.message = this.commands.message
	}

	if (verbose_logging)
	{
		for(const command of CommandsSet.commandwords.filter( (k,i) => this.commands.get(i) ) )
		{
			consolePrint('<font color="green">Rule ' + makeLinkToLine(this.lineNumber) + ' triggers command ' + command + '.</font>', true)
			level.commandQueue.sourceRules[CommandsSet.command_keys[command]] = this
		}
	}
}