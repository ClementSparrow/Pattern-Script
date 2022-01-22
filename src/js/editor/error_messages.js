
const error_messages = { // actually also warning messages
	// identifiers.js
	// ==============

	identifier_name_is_keyword: (candname) => 'You named an object "' + candname.toUpperCase() + '", but this is a keyword. Don\'t do that!',
	identifier_already_defined: (candname, definition_string, l) => 'Object "' + candname.toUpperCase() + '" already defined' + definition_string + ' on ' + makeLinkToLine(l, 'line ' + l.toString()),

	// compiler.js
	// ===========

	// generateExtraMembers
	no_collision_layers: 'No collision layers defined.  All objects need to be in collision layers.',
	palette_not_found: val => 'Palette "'+val+'" not found, defaulting to arnecolors.',
	too_many_sprite_colors: 'A sprite cannot have more than 10 colors, since they are identified by digits in the sprite matrix.',
	invalid_color_for_object: (object_name, c) => 'Invalid color specified for object "' + object_name + '", namely "' + c + '".',
	no_palette_in_object: object_name => 'Colors not specified for object "' + object_name +'".',
	no_object: 'You need to have some objects defined',
	no_background: 'You have to define something to be the background',
	background_is_aggregate: "Background cannot be an aggregate (declared with 'and'), it has to be a simple type, or property (declared in terms of others using 'or').",

	// ruleToMask
	no_matching_ellipsis_in_RHS: 'An ellipsis on the left must be matched by one in the corresponding place on the right.',
	no_matching_ellipsis_in_LHS: 'An ellipsis on the right must be matched by one in the corresponding place on the left.',
	no_layer_for_object: object_name => 'Oops! ' +object_name.toUpperCase()+' not assigned to a layer.',
	rule_cannot_match_anything: 'This rule will never match anything, because it requires the presence of an entity that has been excluded by a NO.',
	spawn_aggregate: object_name => 'You want to spawn a random "' + object_name.toUpperCase() + '", but I don\'t know how to do that.',
	cant_overlap: (object_name1, object_name2) => 'Rule matches object types that can\'t overlap: "' + object_name1.toUpperCase() + '" and "' + object_name2.toUpperCase() + '".',

	// generateMasks
	no_player_defined: "Error, didn't find any object called player, either in the objects section, or the legends section. there must be a player!",

	// tokenizeWinConditionIdentifier
	unknown_object_in_wincondition: n => 'Unknown object name "' + n +'" found in win condition.',
	invalid_object_in_wincondition: (n, type) => 'Invalid object name found in win condition: ' + n + ' is ' + type + ', but win conditions objects have to be objects or properties (defined using "or", in terms of other properties)',

	// levelFromString
	unknown_symbol_in_level: ch => 'Error, symbol "' + ch + '", used in level map, not found. Do you need to add it to the legend, or define a new object?',
	property_symbol_in_level: ch => 'Error, symbol "' + ch + '" is defined using \'or\', and therefore ambiguous - it cannot be used in a map. Did you mean to define it in terms of \'and\'?',
	wrong_symbol_type_in_level: (ch, type) => 'Error, symbol "' + ch + '" is defined as ' + identifier_type_as_text[type] + '. It cannot be used in a map.',

	// generateSoundData
	incorrect_sound_declaration: 'Incorrect sound declaration.', // TODO: explain what is incorrect

	// compile
	no_level_found: 'No levels found. Add some levels!',

	// parser.js
	// =========

	// prelude:
	unknown_metadata: 'Unrecognised stuff in the prelude.',
	// objects:
	palette_too_small: (i,n,l) => 'Trying to access color number ' + i + ' from the color palette of sprite ' + n + ', but there are only ' + l + ' defined in it.',
	// sounds:
	unexpected_sound_token: candname => 'unexpected sound token "'+candname+'".',
	// collision layers:
	object_in_multiple_layers: object_name => 'Object "' + object_name.toUpperCase() + '" appears in multiple collision layers. I ignored it, but you should fix this!',
	// levels
	non_rectangular_level: 'Maps must be rectangular, yo (In a level, the length of each row must be the same).',

	// rule_parser.js
	// ==============

	// parseRuleDirections
	random_on_nonfirst_group_rule: 'A rule-group can only be marked random by the first rule.', // TODO: better explain why in the message.

	// parseRuleString
	direction_NO_object: 'Syntax error: "NO" cannot follow a direction in a rule.',
	directions_outside_cellrows: 'Invalid syntax. Directions should be placed at the start of a rule.',
	no_or_random_followed_by_direction: keyword => 'Invalid syntax. The keyword "'+keyword.toUpperCase()+'" must be followed by an object name.',
	random_in_LHS: keyword => keyword.toUpperCase()+' cannot be matched on the left-hand side, it can only appear on the right',
	movements_in_laterule: 'Setting movements in late rules does not make sense and I will simply ignore them, as late rules are applied after eveything has moved.',
	ellipses_not_alone: 'Ellipses shoud be alone in their own cell, like that: |...|',
	more_than_one_ellipses_in_cellrow: "You can't use two ellipses in a single cell match pattern.  If you really want to, please implement it yourself and send me a patch :)",
	rule_without_arrow: "A rule has to have an arrow in it.  There's no arrow here! Consider reading up about rules - you're clearly doing something weird",
	rule_arrow_in_cell: 'Encountered an unexpected "->" inside square brackets.  It\'s used to separate states, it has no place inside them.',
	rule_open_open_brackets:   "Multiple opening brackets without corresponding closing brackets.  Something fishy here.  Every '[' has to be closed by a ']', and you can't nest them.",
	rule_close_close_brackets: "Multiple closing brackets without corresponding opening brackets.  Something fishy here.  Every '[' has to be closed by a ']', and you can't nest them.",
	commands_in_cellrow: 'Commands must appear at the end of the rule, outside the cell rows (square brackety things).',
	different_nb_cellrows: 'Error, when specifying a rule, the number of matches (square bracketed bits) on the left hand side of the arrow must equal the number on the right',
	different_nb_cells: 'In a rule, each pattern to match on the left must have a corresponding pattern on the right of equal length (number of cells).',

	// rule_expansion.js
	// =================

	ambiguous_movement: w => 'This rule has an ambiguous movement on the right-hand side, \"'+ w + "\", that can't be inferred from the left-hand side. (Either for every ambiguous movement associated to an entity on the right there has to be a corresponding one on the left attached to the same entity, OR, if there's a single occurrence of a particular ambiguous movement on the left, all properties of the same movement attached to the same object on the right are assumed to be the same (or something like that)).",
	ambiguous_property: name => 'This rule has a property on the right-hand side, \"'+ name.toUpperCase() + "\", that can't be inferred from the left-hand side.  (either for every property on the right there has to be a corresponding one on the left in the same cell, OR, if there's a single occurrence of a particular property name on the left, all properties of the same name on the right are assumed to be the same).",

	// rule_groups.js
	// ==============

	// generateLoopPointsAux
	unbalanced_loop: "Need to have matching number of 'startLoop' and 'endLoop' loop points.",
	// ruleGroupDiscardOverlappingTest
	overlapping_objects_in_cell: (example1, example2) => example1 + ' and ' + example2 + ' can never overlap, but this rule requires that to happen.',	

	// message_screen.js
	// =================

	title_truncated: h => 'Game title is too long to fit on screen, truncating to '+h+' lines.',
}

function get_error_message(msg)
{
	if (typeof msg === 'string')
		return msg
	const f = error_messages[msg[0]]
	if (typeof f === 'string')
		return f
	return f( ...(msg.slice(1)) )
}

function error_message_equal(m1=null, m2=null)
{
	switch (typeof m1)
	{
		case 'object':
			if ( (m1 !== null) && (m2 !== null) )
				return ( (m1.length == m2.length) && m1.every( (x,i) => error_message_equal(x, m2[i])) )
		default: return (m1 === m2)
	}
}
