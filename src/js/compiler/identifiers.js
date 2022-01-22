
//	======= TYPES OF IDENTIFIERS =======

// Aggregates are "obj1 and obj2" that can appear in the definition of a legend character.
// Properties are "obj1 or obj2".
// Synonyms are "new_obj = old_obj" and can therefore be used either as Properties or Aggregates.

var identifier_type_as_text = [ 'an object', 'an object synonym', 'an aggregate', 'a property', 'a tag', 'a tag class', 'a mapping' ];
const [
	identifier_type_object, identifier_type_synonym, identifier_type_aggregate, identifier_type_property,
	identifier_type_tag, identifier_type_tagset,
	identifier_type_mapping
] = identifier_type_as_text.keys();



//	======= DIRECTIONS AND DIRECTION MAPPINGS =======

const absolutedirs = ['up', 'right', 'down', 'left'];
const relativeDirs = ['^','>','v','<','parallel','perpendicular'];//used to index the following
const relativeDict = {
	'up': ['left', 'up', 'right', 'down', 'vertical', 'horizontal'],
	'right': ['up', 'right', 'down', 'left', 'horizontal', 'vertical'],
	'down': ['right', 'down', 'left', 'up', 'vertical', 'horizontal'],
	'left': ['down', 'left', 'up', 'right', 'horizontal', 'vertical']
}


// ======= CONSTRUCTORS =======

function Identifiers()
{
	this.objects = []
	this.mappings = []

//	Information about the identifiers (struct of array rather than array of struct)
	this.names = [] // all the identifiers defined in the game.
	this.deftype = [] // their type when defined
	this.comptype = [] // their type in the end (synonyms have identifier_type_synonym for deftype but the comptype of the thing they are synonym of)
	this.lineNumbers = [] // the number of the line in which the identifier is first defined
	this.implicit = [] // 0 if the identifier has been explicitely defined, 1 if defined because of the definition of a tag class, 2 if defined because used.
	this.original_case_names = [] // retains the original case of an identifier so that the editor can suggest it as autocompletion.

//	Data for specific types of identifiers
	this.object_set = [] // the objects that the identifier can represent, as a set of indexes in this.objects (or in this.identifiers, for tag sets).
	this.tag_mappings = [] // an array of positions in this.mappings (or null), one mapping for the basename (if it's declared as a mapping) and one mapping for each tag.
	                     // the structure thus also allow to iterate on tags and know their domain of possible values (as the mapping's fromset).

//	Register predefined direction tags
	for (const [i, dirname] of absolutedirs.entries())
	{
		this.registerNewIdentifier(dirname, dirname, identifier_type_tag, identifier_type_tag, new Set([i]), [], 0, -1)
	}
	this.registerNewIdentifier('horizontal', 'horizontal', identifier_type_tagset, identifier_type_tagset, new Set([1,3]), [null], 0, -1) // 4
	this.registerNewIdentifier('vertical', 'vertical', identifier_type_tagset, identifier_type_tagset, new Set([0,2]), [null], 0, -1) // 5
	this.registerNewIdentifier('directions', 'directions', identifier_type_tagset, identifier_type_tagset, new Set([0,1,2,3]), [null], 0, -1) // 6

//	Register predefined direction mappings
	// note that by doing so, we forbid the use of > < v ^ as legend characters to use in levels, which is accepted in vanilla PuzzleScript. But I
	// have no problem with that because I think the whole LEGEND section should be redesigned. The definition of properties and aggregates should have its own section
	// and the definition of legend symbols should only accept aggregates, and be case-sensitive and more unicode-friendly.
	for (const [i, dirname] of relativeDirs.entries())
	{
		this.registerNewMapping(dirname, dirname, 6, new Set(), 0, -1)
		this.mappings[i].fromset = Array.from(absolutedirs, ad => this.names.indexOf(ad) )
		this.mappings[i].toset = Array.from(absolutedirs, ad => this.names.indexOf(relativeDict[ad][i]) )
	}
	
}

Identifiers.prototype.copy = function()
{
	result = new Identifiers();

	result.objects = this.objects.map( (o) => ({
			name: o.name,
			identifier_index: o.identifier_index,
			colors: o.colors.concat([]),
			spritematrix: o.spritematrix.concat([]),
			sprite_offset: Array.from(o.sprite_offset),
			layer: o.layer
		}))
	result.mappings = Array.from(this.mappings, (m) => ({
		from: m.from,
		identifier_index: m.identifier_index,
		fromset: Array.from(m.fromset),
		toset: Array.from(m.toset)
	}));

	result.names = Array.from(this.names)
	result.deftype = Array.from(this.deftype)
	result.comptype = Array.from(this.comptype)
	result.lineNumbers = Array.from(this.lineNumbers)
	result.implicit = Array.from(this.implicit)
	result.original_case_names = Array.from(this.original_case_names)

	result.object_set = this.object_set.map( objects => new Set(objects) )
	result.tag_mappings = Array.from(this.tag_mappings, mappings => Array.from(mappings))

	return result;
}






//  ======= ACCESS THE DATA =======

// Use this when you know there is a single object associated to that identifier, or you just want the first of the objects.
Identifiers.prototype.getObjectFromIdentifier = function(identifier_index)
{
	return this.object_set[identifier_index].values().next().value;
}

Identifiers.prototype.getObjectsForIdentifier = function(identifier_index)
{
	return this.object_set[identifier_index];
}







//	======= REGISTER IDENTIFIERS =======


Identifiers.prototype.registerNewIdentifier = function(identifier, original_case, deftype, comptype, objects, tag_mappings, implicit, lineNumber)
{
	const result = this.names.length;
	this.original_case_names.push( original_case );
	this.names.push( identifier )
	this.deftype.push( deftype )
	this.comptype.push( comptype)
	this.object_set.push( objects )
	this.lineNumbers.push( lineNumber )
	this.implicit.push( implicit )
	this.tag_mappings.push( tag_mappings )
	return result;
}

Identifiers.prototype.registerNewObject = function(identifier, original_case, implicit, lineNumber)
{
	const object_id = this.objects.length
	this.objects.push( {
		name: identifier,
		identifier_index: this.names.length,
		colors: [],
		spritematrix: [],
		sprite_offset: [0, 0]
	});
	return this.registerNewIdentifier(identifier, original_case, identifier_type_object, identifier_type_object, new Set([object_id]), [], implicit, lineNumber)
}

Identifiers.prototype.registerNewSynonym = function(identifier, original_case, old_identifier_index, tag_mappings, lineNumber)
{
	return this.registerNewIdentifier(
		identifier,
		original_case,
		identifier_type_synonym,
		this.comptype[old_identifier_index],
		new Set(this.object_set[old_identifier_index]),
		tag_mappings,
		0,
		lineNumber
	);
}

Identifiers.prototype.registerNewLegend = function(new_identifier, original_case, objects, tag_mappings, type, implicit, lineNumber) // type should be identifier_type_{aggregate,property}
{
	return this.registerNewIdentifier(new_identifier, original_case, type, type, objects, tag_mappings, implicit, lineNumber);
}


Identifiers.prototype.registerNewMapping = function(identifier, original_case, fromset_identifier_index, objects, implicit, lineNumber)
{
	const mapping_index = this.mappings.length;
	result = this.registerNewIdentifier(identifier, original_case, identifier_type_mapping, identifier_type_mapping, objects, [mapping_index], implicit, lineNumber);
	this.mappings.push({
		from: fromset_identifier_index,
		identifier_index: result,
		fromset: [],
		toset: []
	});
	return result;
}






//	======= EXPAND TAGS AND VISIT EXPANDED OBJECTS ======

/* The methods in this section visit all possible ways to expand a tagged identifier when some of its tags are tag classes or tag mappings.
 * callback functions can be applied to the visited objects, but the visit itself does not check anything about the expanded tagged identifiers,
 * and notably they don't check the identifiers have been registered.
 */

// TODO: instead of having an 'accepts_mapping' parameter and check all possible values in the end set of the mapping, we should provide as argument the set of parameters
// that can be replaced. accepts_mapping is only true for checking rules and the first parameter of copy: in sprites definitions. In both cases we should know the expansion params.

Identifiers.prototype.visitTagExpansion = function(identifier, tagged_identifier, accepts_mapping, tag_operation, identifier_operation)
{
	const tag_identifier_indexes = tagged_identifier[3];
	const tag_mapping = Array.from(
		tag_identifier_indexes.entries(),
		([i, replaced_tag_index]) => this.visitExpandedTag(replaced_tag_index, i, tagged_identifier, accepts_mapping, tag_operation, identifier_operation)
	);
	return identifier_operation(identifier, tagged_identifier, tag_mapping);
}

Identifiers.prototype.visitExpandedTag = function(tag_identifier_index, tag_position, tagged_identifier, accepts_mapping, tag_operation, identifier_operation)
{
	var mapping_startset;
	var mapping_iterationset;
	var mapping_from;
	switch (this.comptype[tag_identifier_index])
	{
		case identifier_type_tagset:
			mapping_startset = Array.from(this.object_set[tag_identifier_index])
			mapping_iterationset = mapping_startset
			mapping_from = tag_identifier_index
			break;
		case identifier_type_mapping:
			if (accepts_mapping)
			{
				const mapping = this.mappings[this.tag_mappings[tag_identifier_index][0]];
				mapping_startset = mapping.fromset
				mapping_iterationset = mapping.toset
				mapping_from = mapping.from
				break;
			}
		case identifier_type_tag:
			return null;
	}
	const mapping_endset = mapping_iterationset.map(
		replacement_tag_ii => this.replaceTag(replacement_tag_ii, tag_position, tagged_identifier, accepts_mapping, tag_operation, identifier_operation)
	)
	return tag_operation(tag_identifier_index, tag_position, tagged_identifier, mapping_from, mapping_startset, mapping_endset);
}

Identifiers.prototype.replaceTag = function(replacement_tag_identifier_index, tag_position, tagged_identifier, ...visitor_params)
{
	const [identifier_base, identifier_base_original_case, tag_identifiers, tag_identifier_indexes, lineNumber] = tagged_identifier

//	Replace the tag name
	var new_tag_identifiers = Array.from(tag_identifiers)
	new_tag_identifiers[tag_position] = this.names[replacement_tag_identifier_index]

//	Replace the identifiers
	var new_tag_identifier_indexes = Array.from(tag_identifier_indexes)
	new_tag_identifier_indexes[tag_position] = replacement_tag_identifier_index

//	Make the new tagged identifier
	const new_identifier = identifier_base+':'+new_tag_identifiers.join(':');
	const new_tagged_identifier = [identifier_base, identifier_base_original_case, new_tag_identifiers, new_tag_identifier_indexes, lineNumber]

//	Recursively call the function
	return this.visitTagExpansion(new_identifier, new_tagged_identifier, ...visitor_params);
}







//	======= CHECK IDENTIFIERS ======

// forbidden_keywords cannot be used as tags or object names
const forbidden_keywords = ['checkpoint','tags','objects', 'collisionlayers', 'legend', 'sounds', 'rules', '...','winconditions', 'levels','|','[',']','late','rigid', 'no','randomdir','random', 'any', 'all', 'some', 'moving','stationary','action','message'];

Identifiers.prototype.checkIdentifierType = function(identifier_index, accepted_types, accepts_mapping)
{
	const type = this.comptype[identifier_index]
	if ( accepted_types.includes(type) )
		return true;
	if (accepts_mapping && (type === identifier_type_mapping))
		return this.mappings[this.tag_mappings[identifier_index][0]].toset.every( i => this.checkIdentifierType(i, accepted_types, true) )
	return false;
}




//	======= CHECK IDENTIFIERS FOR TAGS =======

Identifiers.prototype.checkKnownTagClass = function(identifier)
{
	const identifier_index = this.names.indexOf(identifier);
	return (identifier_index >= 0) && (this.comptype[identifier_index] == identifier_type_tagset);
}



//	======= CHECK IDENTIFIERS FOR OBJECTS =======

// checks that an object name with tags is well formed and returns its parts
Identifiers.prototype.identifierIsWellFormed = function(identifier, accepts_mapping, log)
{
//	Extract tags
	const [identifier_base, ...identifier_tags] = identifier.split(':');
	if ( (identifier_tags.length === 0) || (identifier_base.length === 0) ) // it's OK to have an identifier starting with a semicolon or being just a semicolon
		return [0, identifier_base, []];

	const tags = identifier_tags.map( tagname => [this.names.indexOf(tagname), tagname] );

//	Tags must not be empty
	if (identifier_tags.some(x => (x.length === 0)))
	{
		log.logError('Empty tag used in object name. You cannot have :: in an object name!')
		return [-1, identifier_base, tags]
	}

//	These tags must be known
	const unknown_tags = tags.filter( ([tag_index, tn]) => (tag_index < 0) );
	if ( unknown_tags.length > 0 )
	{
		const unknown_tagnames = unknown_tags.map( ([ti, tn]) => tn.toUpperCase() );
		log.logError('Unknown tag' + ((unknown_tags.length>1) ? 's ('+ unknown_tagnames.join(', ')+')' : (' '+unknown_tagnames[0])) + ' used in object name.');
		return [-1, identifier_base, tags];
	}

//	And they must be tag values or tag classes
	const invalid_tags = tags.filter(
		([tag_index, tn]) => ! this.checkIdentifierType(tag_index, [identifier_type_tag, identifier_type_tagset], accepts_mapping)
	);
	if ( invalid_tags.length > 0 )
	{
		const invalid_tagnames = invalid_tags.map( ([ti, tn]) => tn.toUpperCase() );
		log.logError('Invalid object name containing tags that have not been declared as tag values or tag sets: ' + invalid_tagnames.join(', ') + '.');
		return [-2, identifier_base, tags];
	}
	return [0, identifier_base, tags];
}

// checks that it is a name that could be used for an object, but does not check if it has already been declared (it's already done by the callers).
Identifiers.prototype.canBeAnObjectName = function(candname, log)
{
//	Warn if the name is a keyword
	if (forbidden_keywords.indexOf(candname) >= 0)
	{
		log.logWarning(['identifier_name_is_keyword', candname])
		return [0, candname, []]; // yes, this is only a warning
	}
//	Check the tags
	return this.identifierIsWellFormed(candname, false, log);
}

// Function used when declaring objects in the OBJECTS section and synonyms/properties/aggregates in the LEGEND section
Identifiers.prototype.checkIfNewIdentifierIsValid = function(candname, accept_implicit, log)
{
//	Check if this name is already used
	const identifier_index = this.names.indexOf(candname);
	if (identifier_index >= 0)
	{
		// Is it OK to redefine it if it has been implicitly defined earlier?
		if (   accept_implicit
			&& (this.implicit[identifier_index] > 0)
			&& this.checkIdentifierType(identifier_index, [identifier_type_object, identifier_type_property, identifier_type_aggregate], false)
		)
			return true;
		const type = this.deftype[identifier_index]
		const definition_string = (type !== identifier_type_object) ? ' as ' + identifier_type_as_text[type] : '';
		const l = this.lineNumbers[identifier_index];
		if (l == -1)
		{
			log.logError(['identifier_name_is_keyword', candname]) // TODO: inconsitancy: it's an error here, but a warning in canBeAnObjectName.
		}
		else
		{
			log.logError(['identifier_already_defined', candname, definition_string, l])
		}
		return false;
	}

//	Check that the name can be used
	const [error_code, identifier_base, tags] = this.canBeAnObjectName(candname, log);
	return (error_code == 0);
}

// TODO: we should log an error if the identifier is not found, instead of letting the caller do that, so that we have uniform error messages.
// also we should define error functions for logging the messages, so that the caller can change the message or do something appropriate in case of error.
Identifiers.prototype.checkIdentifierIsKnownWithType = function(identifier, accepted_types, accepts_mapping, log)
{
	const result = this.names.indexOf(identifier);
	if (result < 0)
		return -2;
	if (this.checkIdentifierType(result, accepted_types, accepts_mapping))
		return result;
	log.logError('You cannot use '+identifier.toUpperCase()+' here because it is '+identifier_type_as_text[this.comptype[result]]+' but I was expecting '+accepted_types.map(t => identifier_type_as_text[t]).join(' or ')+(accepts_mapping ? ' or a mapping giving one.' : '.'))
	return -1;
}

// check if an identifier used somewhere is a known object or property.
// This function should be used instead of this.identifiers.names.indexOf(identifier) whenever there is a possibility the identifier contains tags.
Identifiers.prototype.checkKnownIdentifier = function(identifier, accepts_mapping, log)
{
//	First, check if we have that name registered
	const result = this.checkIdentifierIsKnownWithType(identifier, [identifier_type_object, identifier_type_property, identifier_type_aggregate], accepts_mapping, log);
	if (result !== -2)
		return result; // known identifier with an appropriate type or -1

//	If not, it must contain tags
	const [error_code, identifier_base, tags] = this.identifierIsWellFormed(identifier, accepts_mapping, log);
	if (tags.length === 0)
	{
		// log.logError('Unknown object '+identifier.toUpperCase()+'.')
		return -2;
	}
	if (error_code < 0)
		return error_code - 2;

	const tagged_identifier = [identifier_base, identifier_base, tags.map( ([,tag_name]) => tag_name ), tags.map( ([tag_index,]) => tag_index ), log.lineNumber]

//	For all possible combinations of tag values in these tag classes, the corresponding object must have been defined (as an object).
	if ( ! this.visitTagExpansion(identifier, tagged_identifier, accepts_mapping, this.checkTagMapping.bind(this), this.checkImplicitObjectIdentifier.bind(this, log)) )
		return -5;

//	Register the identifier as a property to avoid redoing all this again.
	return this.visitTagExpansion(identifier, tagged_identifier, accepts_mapping, this.registerTagMapping.bind(this), this.registerImplicitObjectIdentifier.bind(this));
}



// Functions to use with visitTagExpansion to check the expansion of tags creates only registered objects
Identifiers.prototype.checkImplicitObjectIdentifier = function(log, new_identifier, tagged_identifier, tag_mapping)
{
	if (tag_mapping.every( x => (x === null) ))
	{
		// no tag class in the tags: check that the object exists
		const result = this.names.indexOf(new_identifier) >= 0;
		if ( ! result )
		{
			log.logError('Unknown combination of tags for an object: '+new_identifier.toUpperCase()+'.');
		}
		return result;
	}
	// for all tags, check that every possible replacement of a tagclass tag is valid
	return tag_mapping.every( x => ((x === null) || (x === true)) );
}
Identifiers.prototype.checkTagMapping = function(tag_identifier_index, tag_position, tagged_identifier, mapping_from, mapping_startset, mapping_endset)
{
	return mapping_endset.every( x => x ); // all posible replacements of the tagclass tag must be valid!
}




Identifiers.prototype.checkCompoundDefinition = function(identifiers, compound_name, compound_type, log)
{
	var ok = true;
	var objects = new Set()
	const forbidden_type = (compound_type == identifier_type_aggregate) ? identifier_type_property : identifier_type_aggregate;
	// TODO: change forbidden_type for accepted_type!
	for (const identifier of identifiers)
	{
		const identifier_index = this.checkKnownIdentifier(identifier, false, log);
		if (identifier_index < 0)
		{
			ok = false;
			const type_as_string = (compound_type == identifier_type_aggregate) ? 'aggregate ' : 'property ';
			log.logError('Unknown identifier "' + identifier.toUpperCase() + '" found in the definition of ' + type_as_string + compound_name.toUpperCase() + ', ignoring it.');
		}
		else
		{
			if (this.comptype[identifier_index] == forbidden_type)
			{
				if (compound_type == identifier_type_aggregate)
					log.logError("Cannot define an aggregate (using 'and') in terms of properties (something that uses 'or').");
				else
					log.logError("Cannot define a property (using 'or') in terms of aggregates (something that uses 'and').");
				ok = false;
			}
			else
			{
				this.getObjectsForIdentifier(identifier_index).forEach( o => objects.add(o) )
			}
		}
	}
	return [ok, objects];
}







//	======== REGISTER AND CHECK =======

Identifiers.prototype.checkAndRegisterNewTagValue = function(tagname, original_case, tagclass_identifier_index, log)
{

//	Create a new tag if it does not already exists
	const identifier_index = this.names.indexOf(tagname);
	if (identifier_index < 0)
	{
		const new_identifier_index = this.registerNewIdentifier(tagname, original_case, identifier_type_tag, identifier_type_tag, new Set([this.names.length]), [], 0, log.lineNumber)
		this.object_set[tagclass_identifier_index].add(new_identifier_index);
		return new_identifier_index;
	}

//	Avoid circular definitions
	if (identifier_index === tagclass_identifier_index)
	{
		log.logError('You cannot define tag class '+tagname.toUpperCase()+' as an element of itself. I will ignore that.');
		return -1;
	}

//	Reuse existing tag or tagset
	if ( [identifier_type_tag, identifier_type_tagset].includes(this.comptype[identifier_index]) )
	{
		this.object_set[identifier_index].forEach(x => this.object_set[tagclass_identifier_index].add(x));
		return identifier_index;
	}
	// TODO: should we allow direction keywords to appear here too?
	// If so, wouldn't it be easier to add them to this.names in the constructor or Identifiers with a lineNumber set to -1?

//	Existing identifier but not a tag!
	const l = this.lineNumbers[identifier_index]
	log.logError('You are trying to define a new tag named "'+tagname.toUpperCase()+'", but this name is already used for '+
		identifier_type_as_text[this.comptype[identifier_index]]+ ((l >= 0) ? ' defined '+makeLinkToLine(l, 'line ' + l.toString())+'.' : ' keyword.'));
	return -2;
}


// Functions to use with visitTagExpansion to implicitely register all the names resulting from a tag expansion
Identifiers.prototype.registerTagMapping = function(tag_identifier_index, tag_position, tagged_identifier, mapping_from, mapping_startset, mapping_endset)
{
	const result = this.mappings.length;
	this.mappings.push({
		identifier_index: tag_identifier_index,
		from: mapping_from,
		fromset: mapping_startset,
		toset: mapping_endset
	});
	return result;
}
Identifiers.prototype.registerImplicitObjectIdentifier = function(new_identifier, tagged_identifier, tag_mapping)
{
	const replaced_tags = tag_mapping.filter( x => (x !== null) )

	const [identifier_base, identifier_base_original_case, new_tag_identifiers, tag_identifier_indexes, lineNumber] = tagged_identifier
	const new_original_case = identifier_base_original_case+':'+tag_identifier_indexes.map(i => this.original_case_names[i] ).join(':');

	if (replaced_tags.length == 0) // Only tag values in the tags, no tag class => new_identifier is the name of an atomic object 
	{
		const result = this.names.indexOf(new_identifier);
		if (result >= 0) // the object been (implicitely) defined before
			return result;
		return this.registerNewObject(new_identifier, new_original_case, 1, tagged_identifier[4]); // TODO: pass the number we should use for implicit (1 or 2) as parameter?
	}

//	Compute the set objects covered by this identifier
	const objects = new Set()
	this.mappings[replaced_tags[0]].toset.forEach( ii => this.object_set[ii].forEach(oii => objects.add(oii) ) )

	if (objects.size > 1) // Register the identifier as a property to avoid redoing all this again.
		return this.registerNewLegend(new_identifier, new_original_case, objects, [null, ...tag_mapping], identifier_type_property, 1, lineNumber);

	// all tag classes have only one value => new synonym
	const old_identifier_index = this.objects[objects.values().next().value].identifier_index;
	return this.registerNewSynonym(new_identifier, new_original_case, old_identifier_index, [null, ...tag_mapping], lineNumber);
}


// function called when declaring an object in the OBJECTS section
// returns the new identifier if it was OK, -1 otherwise
Identifiers.prototype.checkAndRegisterNewObjectIdentifier = function(candname, original_case, log)
{
//	Check if this name is already used
	const identifier_index = this.names.indexOf(candname);
	if (identifier_index >= 0)
	{
	//	If it was defined implicitly, we just have to mark it as explicitely defined.
		if (this.implicit[identifier_index] > 0)
		{
			this.implicit[identifier_index] = 0
			return identifier_index;
		}
		this.checkIfNewIdentifierIsValid(candname, true, log) // just to reuse the error message that it will trigger
		return -1;
	}

//	Check that the name can be used
	const [error_code, identifier_base, tags] = this.canBeAnObjectName(candname, log);
	if (error_code < 0)
		return -1;

	if (tags.length == 0) // no tag in identifier
		return this.registerNewObject(candname, original_case, 0, log.lineNumber)

	// const tag_values = tags.map( ([tag_index,tag_name]) => this.object_set[tag_index] );
	const identifier_base_original_case = original_case.split(':')[0]

	const tag_names = tags.map( ([tag_index, tag_name]) => tag_name )
	const tag_identifier_indexes = tags.map( ([tag_index, tag_name]) => tag_index )
	const tagged_identifier = [identifier_base, identifier_base_original_case, tag_names, tag_identifier_indexes, log.lineNumber]
	// const result = this.checkAndRegisterNewImplicitObjectIdentifier(candname, tagged_identifier);
	const result = this.visitTagExpansion(candname, tagged_identifier, false, this.registerTagMapping.bind(this), this.registerImplicitObjectIdentifier.bind(this));
	this.implicit[result] = 0; // now it's explicitly defined
	return result;
}





//	====== GENERATE EXPANSIONS FROM PARAMETERS ======

function* cartesian_product(head, ...tail)
{
	const remainder = tail.length > 0 ? cartesian_product(...tail) : [[]];
	for (let r of remainder)
		for (let h of head)
			yield [h, ...r];
}

Identifiers.prototype.make_expansion_parameter = function(identifiers_indexes)
{
	return Array.from(
		identifiers_indexes,
		identifier_index => Array.from(this.object_set[identifier_index])
	);
}

Identifiers.prototype.expand_parameters = function*(identifiers_indexes)
{
	for (const parameters of cartesian_product(...this.make_expansion_parameter(identifiers_indexes)))
	{
		yield parameters;
	}
}


Identifiers.prototype.has_directional_tag_mapping = function(identifier_index)
{
	return this.tag_mappings[identifier_index].slice(1).filter(x => x !== null).some(
		mapping_index => this.mappings[mapping_index].fromset.some( ii => absolutedirs.includes(this.names[ii]) )
	);
}

Identifiers.prototype.replace_directional_tag_mappings = function(direction, identifier_index)
{
//	Apply mappings appearing in the tags
	for (var tag_position=1; tag_position < this.tag_mappings[identifier_index].length; tag_position++)
	{
		const mapping_index = this.tag_mappings[identifier_index][tag_position]
		if (mapping_index === null) // no mapping in this tag
			continue;
		const mapping = this.mappings[mapping_index]

	//	Replace direction parameters only when the tag uses a directional mapping (not when the tag is 'directions' or a subset or superset of it)
		const direction_index = mapping.fromset.indexOf(this.names.indexOf(direction))
		if ( (direction_index < 0) || (mapping.identifier_index == mapping.from) ) // direction not included in tag, or not a tag mapping
			continue;
		identifier_index = mapping.toset[direction_index]
	}
	return identifier_index;
}

Identifiers.prototype.replace_parameters = function(start_identifier_index, from_identifiers_indexes, replacements_identifier_indexes)
{
	var identifier_index = start_identifier_index
//	Apply mappings appearing in the tags
	for (var tag_position=1; tag_position < this.tag_mappings[identifier_index].length; tag_position++)
	{
		const mapping_index = this.tag_mappings[identifier_index][tag_position]
		if (mapping_index === null) // no mapping in this tag
			continue;
		const mapping = this.mappings[mapping_index]

	//	Replace tag class parameters when they appear directly as a tag or as the fromset of a tag mapping
		const tagclass_parameter_index = from_identifiers_indexes.indexOf(mapping.from)
		if (tagclass_parameter_index < 0)
			continue;
		// the tag mapping is compatible with a tag class parameter
		const replaced_tag = replacements_identifier_indexes[tagclass_parameter_index]
		identifier_index = mapping.toset[ mapping.fromset.indexOf(replaced_tag) ]
	}

//	Replace property parameters and apply object mappings
	const identifier_property = (this.comptype[identifier_index] === identifier_type_mapping) ? this.mappings[this.tag_mappings[identifier_index][0]].from : identifier_index
	const property_parameter_index = from_identifiers_indexes.indexOf(identifier_property)
	if (property_parameter_index >= 0)
	{
		identifier_index = replacements_identifier_indexes[property_parameter_index]
	}
	return identifier_index;
}


Identifiers.prototype.getTagClassesInIdentifier = function(identifier_index)
{
	return Array.from( this.tag_mappings[identifier_index].filter( x => (x !== null) ), mapping_index => this.mappings[mapping_index].from)
}


// A class to ease the creation of syntaxes/features that rely on expansion.
function ExpansionContext(params = [], expansion = [])
{
	this.parameters = params
	this.expansion = expansion // an array of pairs [expansion_result, parameter_values] where expansion_result is the result of each expansion (should be copyable by the default js copy function) and parameter_values is the array of the values taken by each expansion parameter in this expansion
}

ExpansionContext.prototype.copy = function()
{
	return new ExpansionContext(
		Array.from( this.parameters ),
		Array.from( this.expansion, ([target, parameter_values]) => [target, Array.from(parameter_values)] )
	)
}

// Filters some expansions based on the given function (removes the expansion for which the function returns false)
ExpansionContext.prototype.filter = function(test_func)
{
	this.expansion = this.expansion.filter( test_func )
}

// Create an expansion context from an identifier by using each of the tag classes its name contains as an expansion parameter.
Identifiers.prototype.expansion_context_from_identifier = function(identifier_index)
{
	if (identifier_index === undefined)
		return new ExpansionContext()

	const classes = this.getTagClassesInIdentifier(identifier_index)
	if (classes.length === 0)
		return new ExpansionContext(
			[],
			[ [ this.getObjectFromIdentifier(identifier_index), [] ] ]
		)

	return new ExpansionContext(
		classes,
		Array.from(
			this.expand_parameters(classes),
			(expansion, i) => [ this.getObjectFromIdentifier(this.replace_parameters(identifier_index, classes, expansion)), expansion]
		)
	)
}

// Create an expansion context from a list of expansion parameters, using the given function to generate the object attached to each expansion
Identifiers.prototype.expansion_context = function(parameter_list, default_object, func)
{
	if (parameter_list.length === 0)
		return new ExpansionContext(
			[],
			[ [ default_object, [] ] ]
		)

	return new ExpansionContext(
		parameter_list,
		Array.from(
			this.expand_parameters(parameter_list),
			(expansion, i) => [ func(expansion, i), expansion ]
		)
	)
}