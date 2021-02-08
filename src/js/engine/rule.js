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









Rule.prototype.findMatches = function() {
	var matches=[];
	var cellRowMasks=this.cellRowMasks;
	for (var cellRowIndex=0;cellRowIndex<this.patterns.length;cellRowIndex++) {
		var cellRow = this.patterns[cellRowIndex];
		var matchFunction = this.cellRowMatches[cellRowIndex];
		if (this.isEllipsis[cellRowIndex]) {//if ellipsis     
			var match = matchCellRowWildCard(this.direction,matchFunction,cellRow,cellRowMasks[cellRowIndex]);  
		} else {
			var match = matchCellRow(this.direction,matchFunction,cellRow,cellRowMasks[cellRowIndex]);               	
		}
		if (match.length===0) {
			return [];
		} else {
			matches.push(match);
		}
	}
	return matches;
};

Rule.prototype.directional = function(){
	//Check if other rules in its rulegroup with the same line number.
	for (var i=0;i<state.rules.length;i++){
		var rg = state.rules[i];
		var copyCount=0;
		for (var j=0;j<rg.length;j++){
			if (this.lineNumber===rg[j].lineNumber){
				copyCount++;
			}
			if (copyCount>1){
				return true;
			}
		}
	}

	return false;
}

Rule.prototype.applyAt = function(delta,tuple,check) {
	var rule = this;
	//have to double check they apply
	//Q: why?
	if (check) {
		var ruleMatches=true;                
		for (var cellRowIndex=0;cellRowIndex<rule.patterns.length;cellRowIndex++) {
			if (rule.isEllipsis[cellRowIndex]) {//if ellipsis
				if (DoesCellRowMatchWildCard(rule.direction,rule.patterns[cellRowIndex],tuple[cellRowIndex][0],
					tuple[cellRowIndex][1]+1, tuple[cellRowIndex][1])===false) { /* pass mink to specify */
					ruleMatches=false;
					break;
				}
			} else {
				if (DoesCellRowMatch(rule.direction,rule.patterns[cellRowIndex],tuple[cellRowIndex])===false) {
					ruleMatches=false;
					break;
				}
			}
		}
		if (ruleMatches === false ) {
			return false;
		}
	}
	var result=false;
	
	//APPLY THE RULE
	var d0 = delta[0]*level.height;
	var d1 = delta[1];
	for (var cellRowIndex=0;cellRowIndex<rule.patterns.length;cellRowIndex++) {
		var preRow = rule.patterns[cellRowIndex];
		
		var currentIndex = rule.isEllipsis[cellRowIndex] ? tuple[cellRowIndex][0] : tuple[cellRowIndex];
		for (var cellIndex=0;cellIndex<preRow.length;cellIndex++) {
			var preCell = preRow[cellIndex];

			if (preCell === ellipsisPattern) {
				var k = tuple[cellRowIndex][1];
				currentIndex = (currentIndex+(d1+d0)*k);
				continue;
			}

			result = preCell.replace(rule, currentIndex) || result;

			currentIndex = (currentIndex+d1+d0);
		}
	}

	if (verbose_logging && result){
		var ruleDirection = dirMaskName[rule.direction];
		if (!rule.directional()){
			ruleDirection="";
		}

		var logString = '<font color="green">Rule <a onclick="jumpToLine(' + rule.lineNumber + ');"  href="javascript:void(0);">' + rule.lineNumber + '</a> ' + 
			ruleDirection + ' applied.</font>';
		consolePrint(logString);
	}

	return result;
};

Rule.prototype.tryApply = function() {
	var delta = dirMasksDelta[this.direction];

	//get all cellrow matches
	var matches = this.findMatches();
	if (matches.length===0) {
		return false;
	}

	var result=false;	
	if (this.hasReplacements) {
		var tuples = generateTuples(matches);
		for (var tupleIndex=0;tupleIndex<tuples.length;tupleIndex++) {
			var tuple = tuples[tupleIndex];
			var shouldCheck=tupleIndex>0;
			var success = this.applyAt(delta,tuple,shouldCheck);
			result = success || result;
		}
	}

	if (matches.length>0) {
		this.queueCommands();
	}
	return result;
};

Rule.prototype.queueCommands = function() {
	var commands = this.commands;
	for(var i=0;i<commands.length;i++) {
		var command=commands[i];
		var already=false;
		if (level.commandQueue.indexOf(command[0])>=0) {
			continue;
		}
		level.commandQueue.push(command[0]);
		level.commandQueueSourceRules.push(this);

		if (verbose_logging){
			var lineNumber = this.lineNumber;
			var ruleDirection = dirMaskName[this.direction];
			var logString = '<font color="green">Rule <a onclick="jumpToLine(' + lineNumber.toString() + ');"  href="javascript:void(0);">' + lineNumber.toString() + '</a> triggers command '+command[0]+'.</font>';
			consolePrint(logString,true);
		}

		if (command[0]==='message') {			
			messagetext=command[1];
		}		
	}
};