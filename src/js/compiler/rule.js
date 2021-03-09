
//	======= CLONING RULES =======

function deepCloneCellRow(cellrow)
{
	return cellrow.map(
		cell =>  cell.map( ([dir, object_index]) => [dir, object_index] )
	);
}

function deepCloneHS(HS)
{
	return HS.map( deepCloneCellRow );
}

function deepCloneRule(rule)
{
	return {
		lineNumber: rule.lineNumber,
		groupNumber: rule.groupNumber,
		direction: rule.direction,
		tag_classes: rule.tag_classes,
		tag_classes_replacements: rule.tag_classes_replacements,
		parameter_properties: rule.parameter_properties,
		parameter_properties_replacements: rule.parameter_properties_replacements,
		late: rule.late,
		rigid: rule.rigid,
		randomRule:rule.randomRule,
		lhs: deepCloneHS(rule.lhs),
		rhs: deepCloneHS(rule.rhs),
		commands: rule.commands, // should be deepCloned too?
		is_directional: rule.is_directional
	};
}



//	======= PRINTING RULES =======

function printCell(identifiers, cell)
{
	var result = '';
	for (const [direction, identifier_index] of cell)
	{
		result += direction + " ";
		if (direction !== "...")
		{
			result += identifiers.names[identifier_index]+" ";
		}
	}
	return result;
}

function printCellRow(identifiers, cellRow)
{
	return '[ ' + cellRow.map(c => printCell(identifiers,c)).join('| ') + '] ';
}

function cacheRuleStringRep(identifiers, rule)
{
	var result='('+makeLinkToLine(rule.lineNumber, rule.lineNumber)+') '+ rule.direction.toString().toUpperCase()+ ' ';
	if (rule.tag_classes.length > 0)
	{
		result += rule.tag_classes.map( (tc_ii, i) => (identifiers.names[tc_ii].toUpperCase()+'='+identifiers.names[rule.tag_classes_replacements[i]]) ).join(', ') + ' '
	}
	if (rule.parameter_properties.length > 0)
	{
		result += rule.tag_classes.map( (pp_ii, i) => (identifiers.names[pp_ii].toUpperCase()+'='+identifiers.names[rule.parameter_properties_replacements[i]]) ).join(', ') + ' '
	}
	if (rule.rigid) {
		result = "RIGID "+result+" ";
	}
	if (rule.randomRule) {
		result = "RANDOM "+result+" ";
	}
	if (rule.late) {
		result = "LATE "+result+" ";
	}
	for (const cellRow of rule.lhs) {
		result = result + printCellRow(identifiers, cellRow);
	}
	result = result + "-> ";
	for (const cellRow of rule.rhs) {
		result = result + printCellRow(identifiers, cellRow);
	}
	for (const command of rule.commands)
	{
		if (command.length===1) {
			result = result + command[0].toString();
		} else {
			result = result + '('+command[0].toString()+", "+command[1].toString()+') ';			
		}
	}
	//print commands next
	rule.stringRep = result;
}

function cacheAllRuleNames(state)
{
	for (const rule of state.rules)
	{
		cacheRuleStringRep(state.identifiers, rule);
	}
}

function printRules(state)
{
	var output = "";
	var loopIndex = 0;
	var loopEnd = -1;
	var discardcount = 0;
	for (const rule of state.rules)
	{
		if (loopIndex < state.loops.length)
		{
			if (state.loops[loopIndex][0] < rule.lineNumber)
			{
				output += "STARTLOOP<br>";
				loopIndex++;
				if (loopIndex < state.loops.length) { // don't die with mismatched loops
					loopEnd = state.loops[loopIndex][0];
					loopIndex++;
				}
			}
		}
		if (loopEnd !== -1 && loopEnd < rule.lineNumber) {
			output += "ENDLOOP<br>";
			loopEnd = -1;
		}
		if (rule.hasOwnProperty('discard'))
		{
			discardcount++;
		} else {
			output += rule.stringRep +"<br>";
 		}
	}
	if (loopEnd !== -1) {	// no more rules after loop end
		output += "ENDLOOP<br>";
	}
	output+="===========<br>";
	output= "<br>Rule Assembly : ("+ (state.rules.length-discardcount) +" rules)<br>===========<br>"+output;
	consolePrint(output);
}
