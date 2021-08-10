
/* THIS FILE IS NOT FOR EXECUTION !!!!
 * it is for documenting this complex part of the engine that is the generation of specific rule-matching functions
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

// Say cellRow has length 3
// CellRow Matches can be specialized to look something like:
function cellRowMatchesFunctionGenerate(direction,cellRow,i) {
	var delta = dirMasksDelta[direction];
	var d = delta[1]+delta[0]*level.height;
	return cellRow[0].matches(i)&&cellRow[1].matches((i+d)%level.n_tiles)&&cellRow[2].matches((i+2*d)%level.n_tiles);
}

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

// Say cellRow has length 3, with a split in the middle
function cellRowMatchesWildcardFunctionGenerate(direction, cellRow,i, maxk, mink)
{
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

// Say cellRow has length 5, with a split in the middle
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

