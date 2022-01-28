

// TODO: the only role of this function is to convert the format for rules used during compilation into a Rule object, which has almost the same structure.
// the function could thus probably be removed if we used Rule objects sooner in the pipeline.
function collapseRules(groups)
{
	for (var rules of groups)
	{
		for (const [i, oldrule] of rules.entries())
		{
			var newrule = [0, [], oldrule.rhs.length>0, oldrule.lineNumber/*ellipses,group number,rigid,commands,randomrule,[cellrowmasks]*/]
			var ellipses = Array(oldrule.lhs.length).fill(false)

			newrule[0] = dirMasks[oldrule.direction]
			newrule[1] = Array.from(oldrule.lhs)
			for (const [j, cellrow_l] of oldrule.lhs.entries())
			{
				for (const cell of cellrow_l)
				{
					if (cell === ellipsisPattern)
					{
						if (ellipses[j])
						{
							logError(['more_than_one_ellipses_in_cellrow'], oldrule.lineNumber)
						} 
						ellipses[j] = true
					}
				}
			}
			newrule.push(ellipses, oldrule.groupNumber, oldrule.rigid, oldrule.commands, oldrule.randomRule, oldrule.parameter_expansion_string)
			rules[i] = new Rule(newrule, oldrule.stringRep)
		}
	}
	matchCache = {}; // clear match cache so we don't slowly leak memory
}

// remove from a group the rules that have a 'discard' field. We could display the error message as soon as ruleToMask, but we want to factorize the same error messages
// created by different expansions of a same original rule. Normally this is done by the console's deletion of repeated messages, but here the example can be different
// for the different expansions.
// See https://github.com/increpare/PuzzleScript/issues/512 and https://github.com/increpare/PuzzleScript/issues/605
function ruleGroupDiscardOverlappingTest(ruleGroup)
{
	var firstLineNumber = ruleGroup[0].lineNumber;
	var allbad = true;
	var example = null;
	for (var i=0; i<ruleGroup.length; i++)
	{
		const rule = ruleGroup[i]
		if (rule.hasOwnProperty('discard'))
		{
			example = rule['discard']
			ruleGroup.splice(i, 1)
			i--
		} else {
			allbad = false;
		}
	}
	if (allbad)
	{
		logError(['overlapping_objects_in_cell', ...example], firstLineNumber)
	}
}

function arrangeRulesByGroupNumberAux(target)
{
	var result = [];
	for (const groupNumber in target)
	{
		if (target.hasOwnProperty(groupNumber))
		{
			var ruleGroup = target[groupNumber];
			ruleGroupDiscardOverlappingTest(ruleGroup);
			if (ruleGroup.length > 0)
			{
				result.push(ruleGroup);
			}
		}
	}
	return result;
}

function arrangeRulesByGroupNumber(state)
{
	var aggregates = {};
	var aggregates_late = {};
	for (const rule of state.rules)
	{
		var targetArray = rule.late ? aggregates_late : aggregates;

		if (targetArray[rule.groupNumber] === undefined)
		{
			targetArray[rule.groupNumber] = []
		}
		targetArray[rule.groupNumber].push(rule);
	}

	const result = arrangeRulesByGroupNumberAux(aggregates);
	const result_late = arrangeRulesByGroupNumberAux(aggregates_late);

	state.rules = result;

	//check that there're no late movements with direction requirements on the lhs
	state.lateRules = result_late;
}

function generateRigidGroupList(state)
{
	var rigidGroupIndex_to_GroupIndex = []
	var groupIndex_to_RigidGroupIndex = []
	var groupNumber_to_GroupIndex = []
	var rigidGroups = []
	for (const [i, ruleset] of state.rules.entries())
	{
		const rigidFound = rigidGroups[i] = ruleset.some( rule => rule.isRigid )
		if ( ! rigidFound )
			continue
		const groupNumber = ruleset[0].groupNumber
		groupNumber_to_GroupIndex[groupNumber] = i
		const rigid_group_index = rigidGroupIndex_to_GroupIndex.length
		groupIndex_to_RigidGroupIndex[i] = rigid_group_index
		ruleset.forEach( rule => rule.makeRigidMask(state.collisionLayers.length, state.STRIDE_MOV, rigid_group_index + 1) ) //don't forget to -1 it when decoding :O
		rigidGroupIndex_to_GroupIndex.push(i)
	}
	if (rigidGroupIndex_to_GroupIndex.length>30)
	{
		logError("There can't be more than 30 rigid groups (rule groups containing rigid members).", rules[0][0][3]);
	}

	state.rigidGroups = rigidGroups;
	state.rigidGroupIndex_to_GroupIndex = rigidGroupIndex_to_GroupIndex;
	state.groupIndex_to_RigidGroupIndex = groupIndex_to_RigidGroupIndex;
}

function generateLoopPointsAux(loops, rules)
{
	var target = 0
	var loopPoint = {}
	var outside = true
	for (const loop of loops)
	{
		const i = rules.findIndex( ruleGroup => (ruleGroup[0].lineNumber >= loop[0]) ) // index of the first ruleGroup after the startloop/endloop instruction
		if (outside)
		{
			target = i
		}
		else if (target >= 0) // there was no rule after the startloop, which can happen for empty loops or loops that contain only late rules
		{
			loopPoint[ ((i<0) ? rules.length : i) - 1] = target
		}
		if (loop[1] === (outside ? -1 : 1) )
		{
			logError(['unbalanced_loop'])
		}
		outside = ! outside
	}
	return loopPoint
}


function generateLoopPoints(state)
{
	if (state.loops.length % 2 === 1)
	{
		logError("have to have matching number of  'startLoop' and 'endLoop' loop points.")
	}
	state.loopPoint = generateLoopPointsAux(state.loops, state.rules)
	state.lateLoopPoint = generateLoopPointsAux(state.loops, state.lateRules)
}
