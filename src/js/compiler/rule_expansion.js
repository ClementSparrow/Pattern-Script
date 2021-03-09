

function* generateDirections(directions)
{
	for (const dirword of directions)
	{
		for (const dir of (dirword in directionaggregates) ? directionaggregates[dirword] : [dirword])
		{
			yield dir;
		}
	}
}


function* cartesian_product(head, ...tail)
{
	const remainder = tail.length > 0 ? cartesian_product(...tail) : [[]];
	for (let r of remainder)
		for (let h of head)
			yield [h, ...r];
}

function* generateRulesExpansions(identifiers, rules)
{
	for (const rule of rules)
	{
		const directions = new Set( generateDirections(rule.directions) );
		const parameter_sets = Array.from(
			[...rule.tag_classes, ...rule.parameter_properties],
			identifier_index => Array.from(identifiers.object_set[identifier_index])
		);
		for (const parameters of cartesian_product(directions, ...parameter_sets))
		{
			yield [rule, ...parameters];
		}
	}
}

function expandRule(identifiers, original_rule, dir, ...parameters)
{
	var rule = deepCloneRule(original_rule);
	// Also clone the non-directional rule parameters (shallow copy because they should not be modified)
	rule.tag_classes = original_rule.tag_classes
	rule.parameter_properties = original_rule.parameter_properties

	rule.direction = dir; // we have rule.directions (plural) before this loop, but rule.direction (singular) after the loop.
	rule.tag_classes_replacements = parameters.slice(0, rule.tag_classes.size);
	rule.parameter_properties_replacements = parameters.slice(rule.tag_classes.size);

//	Remove relative directions
	convertRelativeDirsToAbsolute(rule);
//	Optional: replace up/left rules with their down/right equivalents
	rewriteUpLeftRules(rule);
//	Replace mappings of the parameters with what they map to.
	applyRuleParamatersMappings(identifiers, rule);
//	Replace aggregates and synonyms with what they mean
	atomizeAggregatesAndSynonyms(identifiers, rule);
	return rule;
}

function applyRuleParamatersMappings(identifiers, rule)
{
	for (const hs of [rule.lhs, rule.rhs])
	{
		for (const cellrow of hs)
		{
			for (const cell of cellrow)
			{
				for (var objcond of cell)
				{
					var identifier_index = objcond[1]
					if (identifier_index === '...')
						continue
					for (var tag_position=1; tag_position < identifiers.tag_mappings[identifier_index].length; tag_position++)
					{
						const mapping_index = identifiers.tag_mappings[identifier_index][tag_position]
						if (mapping_index === null)
							continue
						const mapping = identifiers.mappings[mapping_index]
						const tagclass_parameter_index = rule.tag_classes.indexOf(mapping.from)
						if (tagclass_parameter_index < 0)
							continue;
						const replaced_tag = rule.tag_classes_replacements[tagclass_parameter_index]
						identifier_index = mapping.toset[ mapping.fromset.indexOf(replaced_tag) ]
					}
					const property_parameter_index = rule.parameter_properties.indexOf(identifier_index)
					if (property_parameter_index >= 0)
					{
						identifier_index = rule.parameter_properties_replacements[property_parameter_index]
					}
					objcond[1] = identifier_index;
				}
			}
		}
	}
}

function rulesToArray(state)
{
	var oldrules = state.rules;
	var rules = [];
	var loops = [];
	for (const oldrule of oldrules)
	{
		var lineNumber = oldrule[1];
		var newrule = parseRuleString(oldrule, state, rules);
		if (newrule === null)
			continue;
		if (newrule.bracket !== undefined)
		{
			loops.push( [lineNumber, newrule.bracket] );
			continue;
		}
		rules.push(newrule);
	}
	state.loops = loops;

	//now expand out rules with multiple directions
	const rules2 = Array.from( generateRulesExpansions(state.identifiers, rules), rule_expansion => expandRule(state.identifiers, ...rule_expansion) );

	var rules3 = [];
	//expand property rules
	for (const rule of rules2)
	{
		rules3 = rules3.concat(concretizeMovingRule(rule, rule.lineNumber));
	}

	var rules4 = [];
	for (const rule of rules3)
	{
		rules4 = rules4.concat(concretizePropertyRule(state, rule, rule.lineNumber));
	}

	state.rules = rules4;
}

function containsEllipsis(rule)
{
	return rule.lhs.some( cellrow => cellrow.some( cell => cell[1] === '...' ) );
}

function rewriteUpLeftRules(rule)
{
	if (containsEllipsis(rule)) // TODO: What's wrong with reversing a rule that contains ellipses?
		return;

	if (rule.direction == 'up')
	{
		rule.direction = 'down';
	}
	else if (rule.direction == 'left')
	{
		rule.direction = 'right';
	}
	else
	{
		return;
	}

	for (var cellrow of rule.lhs)
	{
		cellrow.reverse();
	}
	if (rule.rhs.length === 0) // TODO: I guess reversing an empty array works well, so this test should not be necessary
		return
	for (var cellrow of rule.rhs)
	{
		cellrow.reverse();
	}
}

function getPropertiesFromCell(identifiers, cell)
{
	var result = [];
	for (const [dir, identifier_index] of cell)
	{
		if (dir == "random")
			continue;
		if (identifiers.comptype[identifier_index] === identifier_type_property)
		{
			result.push(identifier_index);
		}
	}
	return result;
}

//returns you a list of object names in that cell that're moving -> actually, it only returns those moving with a directionaggregate...
function getMovings(cell)
{
	return cell.filter( ([dir, identifier_index]) => (dir in directionaggregates) );
}

function concretizePropertyInCell(cell, property, concreteType)
{
	for (var objcond of cell)
	{
		if (objcond[1] === property && objcond[0]!=="random")
		{
			objcond[1] = concreteType;
		}
	}
}

function concretizeMovingInCell(cell, ambiguousMovement, idToMove, concreteDirection)
{
	for (var objcond of cell)
	{
		if (objcond[0] === ambiguousMovement && objcond[1] === idToMove)
		{
			objcond[0] = concreteDirection;
		}
	}
}

function concretizeMovingInCellByAmbiguousMovementName(cell, ambiguousMovement, concreteDirection)
{
	for (var objcond of cell)
	{
		if (objcond[0] === ambiguousMovement)
		{
			objcond[0] = concreteDirection;
		}
	}
}

// TODO: this function does something very similar to what atomizeCellAggregatesAndSynonyms does, so the two functions should be merged
function expandNoPrefixedProperties(identifiers, cell)
{
	var expanded = [];
	for (const [dir, identifier_index] of cell)
	{
		if ( (dir === 'no') && (identifiers.comptype[identifier_index] === identifier_type_property) )
		{
			expanded.push(...Array.from(identifiers.getObjectsForIdentifier(identifier_index), object_index => [dir, identifiers.objects[object_index].identifier_index] ) );
		}
		else
		{
			expanded.push( [dir, identifier_index] );
		} 
	}
	return expanded;
}

function expandNoPrefixedPropertiesForCellRow(identifiers, cellrows)
{
	for (const [i, cur_cellrow] of cellrows.entries())
	{
		cellrows[i] = cur_cellrow.map( cur_cell => expandNoPrefixedProperties(identifiers, cur_cell) )
	}
}

// TODO: this function and concretizeMovingRule have a very similar structure and should probably be merged.
/* Expands the properties on the LHS of a rule and disambiguates those on the RHS.
 * The rules for the expansion on the LHS are:
 * - properties prefixed by "no" are replaced by the set of objects they can be, all prefixed by "no".
 *   (De Morgan's law: no (A or B or C) = (no A) and (no B) and (no C).)
 * - new rules are created for every possible object each property can be.
 *   (i.e., the cartesian product of the sets of objects for each occurance of a property).
 * The disambiguation rules are:
 * - if the property has a single occurence in the LHS, its concrete remplacement will be used for all the
 *   occurences of this property in the RHS.
 * - if a property appearing in a cell of the RHS appears also in the same cell of the LHS, then the concrete
 *   replacement of the latter will be used for the former.
 */
function concretizePropertyRule(state, rule, lineNumber)
{	
	//step 1, rephrase rule to change "no flying" to "no cat no bat"
	expandNoPrefixedPropertiesForCellRow(state.identifiers, rule.lhs);
	expandNoPrefixedPropertiesForCellRow(state.identifiers, rule.rhs);

	//are there any properties we could avoid processing?
	// e.g. [> player | movable] -> [> player | > movable],
	// 		doesn't need to be split up (assuming single-layer player/block aggregates)

	// we can't manage this if they're being used to disambiguate
	var ambiguousProperties = {}; // properties that appear in the RHS but not in the same cell of the LHS.

	for (var j = 0; j < rule.rhs.length; j++)
	{
		var row_l = rule.lhs[j];
		var row_r = rule.rhs[j];
		for (var k = 0; k < row_r.length; k++)
		{
			const properties_l = getPropertiesFromCell(state.identifiers, row_l[k]);
			const properties_r = getPropertiesFromCell(state.identifiers, row_r[k]);
			for (const property of properties_r)
			{
				if (properties_l.indexOf(property) == -1)
				{
					ambiguousProperties[property] = true;
				}
			}
		}
	}

	var result = [rule];

	var shouldremove;
	var modified = true;
	while (modified)
	{
		modified = false;
		for (var i = 0; i < result.length; i++)
		{
			//only need to iterate through lhs
			const cur_rule = result[i];
			shouldremove = false;
			for (var j = 0; j < cur_rule.lhs.length && !shouldremove; j++)
			{
				const cur_rulerow = cur_rule.lhs[j];
				for (var k = 0; k < cur_rulerow.length && !shouldremove; k++)
				{
					for (const property of getPropertiesFromCell(state.identifiers, cur_rulerow[k]))
					{
						// ambiguousProperties[property] !== true means that either the property does not appear on the RHS
						// or it will be disambiguated because whenever it appears in the RHS it also appears in the matching
						// cell of the RHS.
						if ( (state.single_layer_property[property] >= 0) && (ambiguousProperties[property] !== true) )
							continue; // we don't need to explode this property

						shouldremove = true;
						modified = true;

						//just do the base property, let future iterations take care of the others
						// TODO: we currently replace a property by all the objects it can be, but if instead we replaced it by the properties/objects appearing in its
						// definition, it would allow to stop the replacements when one of the replacement is a single-layer property, creating less rules.
						// an alternative would be to split each property into its single-layer subsets, but that could introduce new bugs easily. -- ClementSparrow
						const aliases = Array.from(state.identifiers.getObjectsForIdentifier(property), object_index => state.identifiers.objects[object_index].identifier_index );
						for (const concreteType of aliases)
						{
							var newrule = deepCloneRule(cur_rule);

							// also clone the propertyReplacements of the rule
							newrule.propertyReplacement = (cur_rule.propertyReplacement === undefined) ? [] : cur_rule.propertyReplacement.map( x => Array.from(x) );

							concretizePropertyInCell(newrule.lhs[j][k], property, concreteType);
							if (newrule.rhs.length > 0)
							{
								// this disambiguates the property appearing in the same cell of the RHS, if any
								concretizePropertyInCell(newrule.rhs[j][k], property, concreteType);//do for the corresponding rhs cell as well
							}
							// note that after that, the property and the concreteType can still appear in other cells
							
							if (newrule.propertyReplacement[property] === undefined)
							{
								newrule.propertyReplacement[property] = [concreteType, 1];
							}
							else
							{
								newrule.propertyReplacement[property][1] += 1;
							}

							result.push(newrule);
						}

						break;
					}
				}
			}
			if (shouldremove)
			{
				result.splice(i, 1);
				i--;
			}
		}
	}

	
	for (var cur_rule of result)
	{
		//for each rule
		if (cur_rule.propertyReplacement === undefined)
			continue;
		
		//for each property replacement in that rule
		for (const [property, propDat] of cur_rule.propertyReplacement.entries())
		{
			if (propDat !== undefined)
			{
				const [concreteType, occurrenceCount] = propDat;

				if (occurrenceCount === 1) // the property appears only once on the LHS, so it can be used to disambiguate all the occurences of the property on the RHS.
				{
					//do the replacement
					for (var cellRow_rhs of cur_rule.rhs)
					{
						for (var cell of cellRow_rhs)
						{
							concretizePropertyInCell(cell, property, concreteType);
						}
					}
					// TODO: we could also remove the property from ambiguousProperties now, since it has
					// just been disambiguated. It would allow to just test that ambiguousProperties is
					// empty instead of doing the loop below.
				}
			}
		}
		delete cur_rule.propertyReplacement; // not used anymore
	}

	// if any properties remain on the RHSes, bleep loudly
	// TODO: why only log the last one found and not all of them?
	var rhsPropertyRemains = '';
	for (const cur_rule of result)
	{
		for (const cur_rulerow of cur_rule.rhs)
		{
			for (const cur_cell of cur_rulerow)
			{
				for (const prop of getPropertiesFromCell(state.identifiers, cur_cell))
				{
					if (ambiguousProperties.hasOwnProperty(prop))
					{
						rhsPropertyRemains = prop;
					}
				}
			}
		}
	}


	if (rhsPropertyRemains.length > 0)
	{
		logError('This rule has a property on the right-hand side, \"'+ state.identifiers.names[rhsPropertyRemains].toUpperCase() + "\", that can't be inferred from the left-hand side.  (either for every property on the right there has to be a corresponding one on the left in the same cell, OR, if there's a single occurrence of a particular property name on the left, all properties of the same name on the right are assumed to be the same).",lineNumber);
	}

	return result;
}


function concretizeMovingRule(rule, lineNumber) // a better name for this function would be concretizeDirectionAggregatesInRule?
{
	var result = [rule];

//	Generate rules in which "directionaggregate identifier" instances are replaced with concrete directions for all occurences of the same directionaggregate and identifier
	
	// Note that 'parallel' and 'perpendicular' have already been replaced by 'horizontal'/'vertical' in convertRelativeDirsToAbsolute,
	// so the directionaggregates here can only be 'horizontal', 'vertical', 'moving', or 'orthogonal'.
	// Similarly, identifiers that are aggregates or synonyms have already been replaced with objects in atomizeAggregatesAndSynonyms,
	// so the identifiers here can only be objects or properties.
	
	var shouldremove;
	var modified = true;
	while (modified)
	{
		modified = false;
		for (var i = 0; i < result.length; i++)
		{
			//only need to iterate through lhs
			var cur_rule = result[i];
			shouldremove = false;
			for (var j = 0; j < cur_rule.lhs.length; j++)
			{
				const cur_rulerow = cur_rule.lhs[j];
				for (var k = 0; k < cur_rulerow.length; k++)
				{
					var movings = getMovings(cur_rulerow[k]); // TODO: this seems an inneficient way to find a list of all movings just to change one...
					if (movings.length > 0)
					{
						shouldremove = true;
						modified = true;

						//just do the base directionaggregate, let future iterations take care of the others
						//(since all occurences of the base directionaggregate will be replaced by atomic directions, it will not reappear here)
						const [ambiguous_dir, identifier_index] = movings[0];
						for (const concreteDirection of directionaggregates[ambiguous_dir])
						{
							var newrule = deepCloneRule(cur_rule);

							// also clone the movingReplacements of the rule
							newrule.movingReplacement = (cur_rule.movingReplacement === undefined) ? [] : cur_rule.movingReplacement.map( x => Array.from(x) );

							concretizeMovingInCell(newrule.lhs[j][k], ambiguous_dir, identifier_index, concreteDirection);
							if (newrule.rhs.length > 0) // desambiguate a directionaggregate in the RHS if it also appears on the same identifier in the same LHS cell.
							{
								// note that there is no guaranty that the same [ambiguous_dir, identifier] appears in the same cell of the RHS...
								concretizeMovingInCell(newrule.rhs[j][k], ambiguous_dir, identifier_index, concreteDirection);//do for the corresponding rhs cell as well
							}
							
							if (newrule.movingReplacement[identifier_index] === undefined)
							{
								newrule.movingReplacement[identifier_index] = [concreteDirection, 1, ambiguous_dir];
							}
							else
							{
								newrule.movingReplacement[identifier_index][1] += 1; // counts how man different ambiguous_dir are used for this identifier in the rule
							}

							result.push(newrule);
						}
					}
				}
			}
			if (shouldremove)
			{
				result.splice(i, 1);
				i--;
			}
		}
	}

	for (var cur_rule of result)
	{
		//for each rule
		if (cur_rule.movingReplacement === undefined)
			continue;

		var ambiguous_movement_dict = {};
		//strict first - matches movement direction to objects
		//for each property replacement in that rule
		for (const [cand_index, movingDat] of cur_rule.movingReplacement.entries())
		{
			if (movingDat !== undefined)
			{
				const [concreteMovement, occurrenceCount, ambiguousMovement] = movingDat;

				// invalidates an ambiguous movement that appears multiple times in the LHS, whether it's used with different identifiers or multiple occurences of a same identifier.
				ambiguous_movement_dict[ambiguousMovement] = ( (ambiguousMovement in ambiguous_movement_dict) || (occurrenceCount !== 1) ) ? "INVALID" : concreteMovement;

				if (occurrenceCount === 1)
				{
					//do the replacement in the RHS
					// all the direction aggregates of the RHS with this identifier gets disambiguated.
					for (const cellRow_rhs of cur_rule.rhs)
					{
						for (var cell of cellRow_rhs)
						{
							concretizeMovingInCell(cell, ambiguousMovement, cand_index, concreteMovement);
						}
					}
				}
			}
		}
		delete cur_rule.movingReplacement; // not used anymore

		//for each ambiguous word, if there was a single occurence of it in the whole lhs, then replace it also everywhere it appears in the RHS (whatever the identifier)
		for(var ambiguousMovement in ambiguous_movement_dict)
		{
			if (ambiguous_movement_dict.hasOwnProperty(ambiguousMovement) && ambiguousMovement!=="INVALID")
			{
				const concreteMovement = ambiguous_movement_dict[ambiguousMovement];
				if (concreteMovement === "INVALID")
					continue;
				// the direction aggregate has been seen exactly once in the LHS
				for (var cellRow_rhs of cur_rule.rhs)
				{
					for (var cell of cellRow_rhs)
					{
						concretizeMovingInCellByAmbiguousMovementName(cell, ambiguousMovement, concreteMovement);
					}
				}
			}
		}
	}

	// if any direction aggregate remain on the RHSes, bleep loudly
	// TODO: why only log the last one found and not all of them?
	var rhsAmbiguousMovementsRemain = '';
	for (const cur_rule of result)
	{
		for (const cur_rulerow of cur_rule.rhs)
		{
			for (const cur_cell of cur_rulerow)
			{
				const movings = getMovings(cur_cell);
				if (movings.length > 0)
				{
					rhsAmbiguousMovementsRemain = movings[0][0];
				}
			}
		}
	}
	if (rhsAmbiguousMovementsRemain.length > 0)
	{
		logError('This rule has an ambiguous movement on the right-hand side, \"'+ rhsAmbiguousMovementsRemain + "\", that can't be inferred from the left-hand side.  (either for every ambiguous movement associated to an entity on the right there has to be a corresponding one on the left attached to the same entity, OR, if there's a single occurrence of a particular ambiguous movement on the left, all properties of the same movement attached to the same object on the right are assumed to be the same (or something like that)).",lineNumber);
	}

	return result;
}

// replaces aggregates and synonyms appearing in a rule by the list of all objects they are aggregates/synonyms of, i.e. objects they must be.
// each new objects has the same motion/action words than the replaced one.
// -> a possible generalization could be to use more qualifier words beyond motion/action words, and then replace the aggregate/synonym by a list, propagating the qualifier to the objects of the list that support them.
function atomizeAggregatesAndSynonyms(identifiers, rule)
{
	atomizeHSAggregatesAndSynonyms(identifiers, rule.lhs, rule.lineNumber)
	atomizeHSAggregatesAndSynonyms(identifiers, rule.rhs, rule.lineNumber)
}

function atomizeHSAggregatesAndSynonyms(identifiers, hs, lineNumber)
{
	for (const cellrow of hs)
	{
		for (const cell of cellrow)
		{
			atomizeCellAggregatesAndSynonyms(identifiers, cell, lineNumber);
		}
	}
}

function atomizeCellAggregatesAndSynonyms(identifiers, cell, lineNumber)
{
	for (var i = 0; i < cell.length; i += 1)
	{
		const [dir, c] = cell[i];

		if (dir === '...')
			continue;

		const identifier_comptype = identifiers.comptype[c];
		if (identifier_comptype != identifier_type_object) // not an object nor the synonym of an object
		{
			if (identifier_comptype != identifier_type_aggregate) // not an aggregate or the synonym of an aggregate
				continue;
			// aggregate or synonym of an aggregate
			if (dir === 'no')
			{
				logError("You cannot use 'no' to exclude the aggregate object " +c.toUpperCase()+" (defined using 'AND'), only regular objects, or properties (objects defined using 'OR').  If you want to do this, you'll have to write it out yourself the long way.", lineNumber);
			}
		}

		const equivs = Array.from( identifiers.getObjectsForIdentifier(c), p => [dir, identifiers.objects[p].identifier_index] );
		cell.splice(i, 1, ...equivs);
		i += equivs.length-1;
	}
}

// TODO: that's just applying a direction function and should probably be implemented as such.
// It means that each entry of relativeDirs should be a direction function, and
// that "const index = relativeDirs.indexOf(c)" should become "const ruledir_function = ruledir_function_names.indexOf(c)"
// and "cell[i] = relativeDict[forward][index]" should be replaced with "cell[i] = ruledir_functions[index][forward]"
// where each ruledir_function is a array giving the result of the function for each rule direction.
function convertRelativeDirsToAbsolute(rule)
{
	const forward = rule.direction;
	absolutifyRuleHS(rule.lhs, forward);
	absolutifyRuleHS(rule.rhs, forward);
}

function absolutifyRuleHS(hs, forward)
{
	for (const cellrow of hs)
	{
		for (const cell of cellrow)
		{
			absolutifyRuleCell(forward, cell);
		}
	}
}

var relativeDirs = ['^','v','<','>','parallel','perpendicular'];//used to index the following
var relativeDict = {
	'right': ['up', 'down', 'left', 'right','horizontal','vertical'],
	'up': ['left', 'right', 'down', 'up','vertical','horizontal'],
	'down': ['right', 'left', 'up', 'down','vertical','horizontal'],
	'left': ['down', 'up', 'right', 'left','horizontal','vertical']
};

function absolutifyRuleCell(forward, cell)
{
	for (var objcond of cell)
	{
		const index = relativeDirs.indexOf(objcond[0]);
		if (index >= 0)
		{
			objcond[0] = relativeDict[forward][index];
		}
	}
}
