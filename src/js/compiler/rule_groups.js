
function collapseRules(groups)
{
	for (var gn = 0; gn < groups.length; gn++)
	{
		var rules = groups[gn];
		for (var i = 0; i < rules.length; i++)
		{
			const oldrule = rules[i];
			var newrule = [0, [], oldrule.rhs.length>0, oldrule.lineNumber/*ellipses,group number,rigid,commands,randomrule,[cellrowmasks]*/];
			var ellipses = Array(oldrule.lhs.length).fill(false);

			newrule[0] = dirMasks[oldrule.direction];
			for (var j=0; j<oldrule.lhs.length; j++)
			{
				var cellrow_l = oldrule.lhs[j];
				for (const cell of cellrow_l)
				{
					if (cell === ellipsisPattern)
					{
						if (ellipses[j])
						{
							logError("You can't use two ellipses in a single cell match pattern.  If you really want to, please implement it yourself and send me a patch :) ", oldrule.lineNumber);
						} 
						ellipses[j] = true;
					}
				}
				newrule[1][j] = cellrow_l;
			}
			newrule.push(ellipses);
			newrule.push(oldrule.groupNumber);
			newrule.push(oldrule.rigid);
			newrule.push(oldrule.commands);
			newrule.push(oldrule.randomRule);
			newrule.push(cellRowMasks(newrule));
			rules[i] = new Rule(newrule);
		}
	}
	matchCache = {}; // clear match cache so we don't slowly leak memory
}

// test that in a rule group the only random rules are the ones defined by the first rule of the group
// TODO: this is a syntaxic issue that should/could be dealt with much sooner?
function ruleGroupRandomnessTest(ruleGroup)
{
	const firstLineNumber = ruleGroup[0].lineNumber;
	for (var i=1;i<ruleGroup.length;i++)
	{
		var rule=ruleGroup[i];
		if (rule.lineNumber === firstLineNumber) // random [A | B] gets turned into 4 rules, skip
			continue;
		if (rule.randomRule)
		{
			logError("A rule-group can only be marked random by the first rule", rule.lineNumber);
		}
	}
}

function ruleGroupDiscardOverlappingTest(ruleGroup)
{
	var firstLineNumber = ruleGroup[0].lineNumber;
	var allbad = true;
	var example = null;
	for (var i=0; i<ruleGroup.length; i++)
	{
		var rule = ruleGroup[i];
		if (rule.hasOwnProperty('discard'))
		{
			example = rule['discard'];
			ruleGroup.splice(i,1);
			i--;
		} else {
			allbad = false;
		}
	}
	if (allbad)
	{
		logError(example[0] +' and '+example[1]+' can never overlap, but this rule requires that to happen.', firstLineNumber);
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
			ruleGroupRandomnessTest(ruleGroup);
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

		if (targetArray[rule.groupNumber] == undefined)
		{
			targetArray[rule.groupNumber] = [];
		}
		targetArray[rule.groupNumber].push(rule);
	}

	const result = arrangeRulesByGroupNumberAux(aggregates);
	const result_late = arrangeRulesByGroupNumberAux(aggregates_late);

	state.rules = result;

	//check that there're no late movements with direction requirements on the lhs
	state.lateRules = result_late;
}


// TODO: can't this been checked much earlier? Also it would be better to list all the rules that have the issue...
function checkNoLateRulesHaveMoves(state)
{
	for (const lateGroup of state.lateRules)
	{
		for (const rule of lateGroup)
		{
			for (const cellRow_l of rule.patterns)
			{
				for (const cellPattern of cellRow_l)
				{
					if (cellPattern === ellipsisPattern)
						continue;

					var moveMissing = cellPattern.movementsMissing;
					var movePresent = cellPattern.movementsPresent;
					if (!moveMissing.iszero() || !movePresent.iszero())
					{
						logError("Movements cannot appear in late rules.", rule.lineNumber);
						return;
					}

					if (cellPattern.replacement != null)
					{
						var movementsClear = cellPattern.replacement.movementsClear;
						var movementsSet = cellPattern.replacement.movementsSet;

						if (!movementsClear.iszero() || !movementsSet.iszero())
						{
							logError("Movements cannot appear in late rules.",rule.lineNumber);
							return;
						}
					}				
				}
			}
		}
	}
}

function generateRigidGroupList(state)
{
	var rigidGroupIndex_to_GroupIndex = [];
	var groupIndex_to_RigidGroupIndex = [];
	var groupNumber_to_GroupIndex = [];
	var groupNumber_to_RigidGroupIndex = [];
	var rigidGroups = [];
	for (var i=0; i<state.rules.length; i++)
	{
		const ruleset = state.rules[i];
		const rigidFound = ruleset.some( rule => rule.isRigid );
		rigidGroups[i] = rigidFound;
		if (rigidFound)
		{
			var groupNumber = ruleset[0].groupNumber;
			groupNumber_to_GroupIndex[groupNumber] = i;
			var rigid_group_index = rigidGroupIndex_to_GroupIndex.length;
			groupIndex_to_RigidGroupIndex[i] = rigid_group_index;
			groupNumber_to_RigidGroupIndex[groupNumber] = rigid_group_index;
			rigidGroupIndex_to_GroupIndex.push(i);
		}
	}
	if (rigidGroupIndex_to_GroupIndex.length>30)
	{
		logError("There can't be more than 30 rigid groups (rule groups containing rigid members).", rules[0][0][3]);
	}

	state.rigidGroups = rigidGroups;
	state.rigidGroupIndex_to_GroupIndex = rigidGroupIndex_to_GroupIndex;
	state.groupNumber_to_RigidGroupIndex = groupNumber_to_RigidGroupIndex;
	state.groupIndex_to_RigidGroupIndex = groupIndex_to_RigidGroupIndex;
}


function generateLoopPoints(state)
{
	if (state.loops.length % 2 === 1)
	{
		logErrorNoLine("have to have matching number of  'startLoop' and 'endLoop' loop points.");
	}

	var loopPointIndex = 0;
	var source = 0;
	var target = 0;

	// TODO: we're doing this twice -> make an auxillary function.
	var loopPoint = {};
	var outside = true;
	for (const loop of state.loops)
	{
		for (const [i, ruleGroup] of state.rules.entries())
		{
			if (ruleGroup[0].lineNumber < loop[0])
				continue;

			if (outside)
			{
				target = i;
			}
			else
			{
				source = i-1;
				loopPoint[source] = target;
			}
			if (loop[1] === (outside ? -1 : 1) )
			{
				logErrorNoLine("Need to have matching number of 'startLoop' and 'endLoop' loop points.");
			}
			outside = ! outside;
			break;
		}
	}
	if (outside === false)
	{
		var source = state.rules.length;
		loopPoint[source] = target;
	}
	state.loopPoint = loopPoint;

	loopPoint = {};
	outside = true;
	for (const loop of state.loops)
	{
		for (const [i, ruleGroup] of state.lateRules.entries())
		{
			if (ruleGroup[0].lineNumber < loop[0])
				continue;

			if (outside)
			{
				target = i;
			}
			else
			{
				source = i-1;
				loopPoint[source] = target;
			}
			if (loop[1] === (outside ? -1 : 1) )
			{
				logErrorNoLine("Need to have matching number of 'startLoop' and 'endLoop' loop points.");
			}
			outside = ! outside;
			break;
		}
	}
	if (outside === false)
	{
		var source = state.lateRules.length;
		loopPoint[source] = target;
	}
	state.lateLoopPoint=loopPoint;
}
