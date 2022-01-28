
//	======= CLONING RULES =======

function deepCloneCellRow(cellrow)
{
	return cellrow.map(
		cell =>  cell.map( oc => (oc === null) ? null : ({dir: oc.dir, ii: oc.ii, no: oc.no, random: oc.random})  )
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
		parameter_expansion_string: rule.parameter_expansion_string,
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
	for (const oc of cell)
	{
		if (oc === null)
		{
			result += '... '
		}
		else
		{
			if (oc.no)
				result += 'no '
			if (oc.random)
				result += 'random '
			result += oc.dir + ' '
			result += identifiers.names[oc.ii]+' '
		}
	}
	return result
}

function printCellRow(identifiers, cellRow)
{
	return '[ ' + cellRow.map(c => printCell(identifiers,c)).join('| ') + '] ';
}

function cacheRuleStringRep(identifiers, rule)
{
	var result='('+makeLinkToLine(rule.lineNumber)+') '+ rule.direction.toString().toUpperCase()+ ' ';
	if (rule.tag_classes.size > 0)
	{
		result += [...rule.tag_classes].map( (tc_ii, i) => (identifiers.names[tc_ii].toUpperCase()+'='+identifiers.names[rule.tag_classes_replacements[i]]) ).join(', ') + ' '
	}
	if (rule.parameter_properties.size > 0)
	{
		result += [...rule.parameter_properties].map( (pp_ii, i) => (identifiers.names[pp_ii].toUpperCase()+'='+identifiers.names[rule.parameter_properties_replacements[i]]) ).join(', ') + ' '
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
	result += rule.commands.get_representation()
	rule.stringRep = result
}

function cacheAllRuleNames(state)
{
	for (const rule of state.rules)
	{
		cacheRuleStringRep(state.identifiers, rule);
	}
}
