
//	======= TYPES OF IDENTIFIERS =======

var identifier_type_as_text = [ 'an object', 'an object synonym', 'an aggregate', 'a property', 'a tag', 'a tag class', 'a mapping' ];
const [
	identifier_type_object, identifier_type_synonym, identifier_type_aggregate, identifier_type_property,
	identifier_type_tag, identifier_type_tagset,
	identifier_type_mapping
] = identifier_type_as_text.keys();



// ======= CONSTRUCTORS =======

function Identifiers()
{
	this.objects = []

	// struct of array rather than array of struct
	this.names = [] // all the identifiers defined in the game.
	this.deftype = [] // their type when defined
	this.comptype = [] // their type in the end (synonyms have identifier_type_synonym for deftype but the comptype of the thing they are synonym of)
	this.lineNumbers = [] // the number of the line in which the identifier is first defined
	this.implicit = [] // 0 if the identifier has been explicitely defined, 1 if defined because of the definition of a tag class, 2 if defined because used.
	this.original_case_names = [] // retains the original case of an identifier so that the editor can suggest it as autocompletion.
	this.object_set = [] // the objects that the identifier can represent, as a set of indexes in this.objects (or in this.identifiers, for tag sets).
}

Identifiers.prototype.copy = function()
{
	result = new Identifiers();

	result.objects = this.objects.map( (o) => ({
			name: o.name,
			identifier_index: o.identifier_index,
			colors: o.colors.concat([]),
			// lineNumber : o.lineNumber,
			spritematrix: o.spritematrix.concat([]),
			layer: o.layer
		}))

	result.names = Array.from(this.names)
	result.deftype = Array.from(this.deftype)
	result.comptype = Array.from(this.comptype)
	result.lineNumbers = Array.from(this.lineNumbers)
	result.implicit = Array.from(this.implicit)
	result.original_case_names = Array.from(this.original_case_names)
	result.object_set = this.object_set.map( objects => (objects instanceof Set) ? new Set(objects) : Array.from(objects) )

	return result;
}




//  ======= ACCESS THE DATA =======

Identifiers.prototype.getObjectsForIdentifier = function(identifier_index)
{
	return this.object_set[identifier_index];
}

Identifiers.prototype.getObjectsAnIdentifierCanBe = function(identifier, log)
{
	const identifier_index = this.checkKnownIdentifier(identifier, log);
	return this.getObjectsForIdentifier(identifier_index);
}







//	======= REGISTER IDENTIFIERS =======


Identifiers.prototype.registerNewIdentifier = function(identifier, original_case, deftype, comptype, objects, implicit, lineNumber)
{
	const result = this.names.length;
	this.original_case_names.push( original_case );
	this.names.push( identifier )
	this.deftype.push( deftype )
	this.comptype.push( comptype)
	this.object_set.push( objects )
	this.lineNumbers.push( lineNumber )
	this.implicit.push( implicit )
	return result;
}

Identifiers.prototype.registerNewObject = function(identifier, original_case, implicit, lineNumber)
{
	const object_id = this.objects.length
	this.objects.push( {
		name: identifier,
		identifier_index: this.names.length,
		colors: [],
		spritematrix: []
	});
	return this.registerNewIdentifier(identifier, original_case, identifier_type_object, identifier_type_object, new Set([object_id]), implicit, lineNumber)
}

Identifiers.prototype.registerNewSynonym = function(identifier, original_case, old_identifier_index, lineNumber)
{
	return this.registerNewIdentifier(
		identifier,
		original_case,
		identifier_type_synonym,
		this.comptype[old_identifier_index],
		new Set(this.object_set[old_identifier_index]),
		0,
		lineNumber
	);
}

Identifiers.prototype.registerNewLegend = function(new_identifier, original_case, objects, type, implicit, lineNumber) // type should be 2 for aggregates and 3 for properties
{
	return this.registerNewIdentifier(new_identifier, original_case, type, type, objects, implicit, lineNumber);
}









//	======= CHECK TAGS =======

Identifiers.prototype.checkKnownTagClass = function(identifier)
{
	const identifier_index = this.names.indexOf(identifier);
	return (identifier_index >= 0) && (this.comptype[identifier_index] == identifier_type_tagset);
}









//	======= CHECK IDENTIFIERS =======

function* cartesian_product(head, ...tail)
{
	const remainder = tail.length > 0 ? cartesian_product(...tail) : [[]];
	for (let r of remainder)
		for (let h of head)
			yield [h, ...r];
}

// check that an object name with tags is well formed and return its parts
Identifiers.prototype.identifierIsWellFormed = function(identifier, log)
{
//	Extract tags
	const [identifier_base, ...identifier_tags] = identifier.split(':');
	if ( (identifier_tags.length === 0) || (identifier_base.length === 0) )
		return [0, identifier_base, []];

//	These tags must be known
	const tags = identifier_tags.map( tagname => [this.names.indexOf(tagname), tagname] );
	const unknown_tags = tags.filter( ([tag_index, tn]) => (tag_index < 0) );
	if ( unknown_tags.length > 0 )
	{
		const unknown_tagnames = unknown_tags.map( ([ti, tn]) => tn.toUpperCase() );
		log.logError('Unknown tag' + ((unknown_tags.length>1) ? 's ('+ unknown_tagnames.join(', ')+')' : ' '+unknown_tagnames[0]) + ' used in object name.');
		return [-1, identifier_base, tags];
	}

//	And they must be tag values or tag classes
	const invalid_tags = tags.filter( ([tag_index, tn]) => !([identifier_type_tag, identifier_type_tagset].includes(this.comptype[tag_index])) );
	if ( invalid_tags.length > 0 )
	{
		const invalid_tagnames = invalid_tags.map( ([ti, tn]) => tn.toUpperCase() );
		log.logError('Invalid object name containing tags that have not been declared as tag values or tag sets: ' + invalid_tagnames.join(', ') + '.');
		return [-2, identifier_base, tags];
	}
	return [0, identifier_base, tags];
}

// Function used when declaring objects in the OBJECTS section and synonyms/properties/aggregates in the LEGEND section
Identifiers.prototype.checkIfNewIdentifierIsValid = function(candname, accept_implicit, log)
{
	// Check if this name is already used
	const identifier_index = this.names.indexOf(candname);
	if (identifier_index >= 0)
	{
		// Is it OK to redefine it if it has been implicitly defined earlier?
		if ( accept_implicit && (this.implicit[identifier_index] > 0) )
			return true;
		const type = this.deftype[identifier_index]
		const definition_string = (type !== identifier_type_object) ? ' as ' + identifier_type_as_text[type] : '';
		const l = this.lineNumbers[identifier_index];
		log.logError('Object "' + candname.toUpperCase() + '" already defined' + definition_string + ' on ' + makeLinkToLine(l, 'line ' + l.toString()));
		return false;
	}

	// Check that the tags exist
	const [error_code, identifier_base, tags] = this.identifierIsWellFormed(candname, log);
	if ( (error_code < 0) && (identifier_base.length > 0) ) // it's OK to have an identifier starting with a semicolon or being just a semicolon
		return false;

	// Warn if the name is a keyword
	if (keyword_array.indexOf(candname) >= 0)
	{
		log.logWarning('You named an object "' + candname.toUpperCase() + '", but this is a keyword. Don\'t do that!');
	}
	return true;
}

// check if an identifier used somewhere is a known object or property.
// This function should be used instead of this.identifiers.names.indexOf(identifier) whenever there is a possibility that identifier contains tags.
Identifiers.prototype.checkKnownIdentifier = function(identifier, log)
{
//	First, check if we have that name registered
	const result = this.names.indexOf(identifier);
	if (result >= 0)
		return result;

//	If not, it must contain tags
	const [error_code, identifier_base, tags] = this.identifierIsWellFormed(identifier, log);
	if (tags.length === 0 || error_code<0)
		return error_code - 1;
	return this.checkTagSetExpansion(identifier, identifier_base, tags, log);
}

Identifiers.prototype.checkTagSetExpansion = function(identifier, identifier_base, tags, log) // tags must contain only tag values or tag classes, not tag mappings.
{
//	For all possible combinations of tag values in these tag classes, the corresponding object must have been defined (as an object).
	const tag_values = tags.map( ([tag_index,tag_name]) => this.object_set[tag_index] );
	var all_found = true;
	var objects = new Set();
	for (const tagvalue_identifier_indexes of cartesian_product(...tag_values))
	{
		const new_identifier = identifier_base+':'+tagvalue_identifier_indexes.map(i => this.names[i] ).join(':');
		const new_identifier_index = this.names.indexOf(new_identifier);
		if (new_identifier_index < 0)
		{
			log.logError('Unknown combination of tags for an object: '+new_identifier.toUpperCase()+'.');
			all_found = false;
			continue;
		}
		// TODO: check type.
		this.object_set[new_identifier_index].forEach( x => objects.add(x) );
	}
	if (!all_found)
		return -4;
	
//	Register the identifier as a property to avoid redoing all this again.
	var result = this.names.indexOf(identifier)
	if (result < 0)
	{
		result = this.names.length;
		const new_original_case = identifier_base+':'+tags.map( ([tag_index,tag_name]) => this.original_case_names[tag_index] ).join(':'); // TODO: get original case of identifier_base.
		this.registerNewLegend(identifier, new_original_case, objects, identifier_type_property, 2, log.lineNumber);
	}
	return result;
}



// check that an object name with tags is well formed and return its parts
// todo: this is almost the same thing as identifierIsWellFormed and the two should be merged
Identifiers.prototype.identifierOrFunctionIsWellFormed = function(identifier, log)
{
//	Extract tags
	const [identifier_base, ...identifier_tags] = identifier.split(':');
	if ( (identifier_tags.length === 0) || (identifier_base.length === 0) )
		return [0, identifier_base, []];

//	These tags must be known
	const tags = identifier_tags.map( tagname => [this.names.indexOf(tagname), tagname] );
	const unknown_tags = tags.filter( ([tag_index, tn]) => (tag_index < 0) );
	if ( unknown_tags.length > 0 )
	{
		const unknown_tagnames = unknown_tags.map( ([ti, tn]) => tn.toUpperCase() );
		log.logError('Unknown tag' + ((unknown_tags.length>1) ? 's ('+ unknown_tagnames.join(', ')+')' : ' '+unknown_tagnames[0]) + ' used in object name.');
		return [-1, identifier_base, tags];
	}

//	And they must be tag values or tag classes or functions that return tags or tag classes
	const invalid_tags = tags.filter(
		([tag_index, tn]) => ! (
			   [identifier_type_tag, identifier_type_tagset].includes(this.comptype[tag_index])
			|| ( (this.comptype[tag_index] === identifier_type_mapping) && this.object_set[tag_index][2].every( i => [identifier_type_tag, identifier_type_tagset].includes(this.comptype[i]) )
			)
		)
	);
	if ( invalid_tags.length > 0 )
	{
		const invalid_tagnames = invalid_tags.map( ([ti, tn]) => tn.toUpperCase() );
		log.logError('Invalid object name containing tags that have not been declared as tag values or tag sets: ' + invalid_tagnames.join(', ') + '.');
		return [-2, identifier_base, tags];
	}
	return [0, identifier_base, tags];
}


Identifiers.prototype.checkKnownIdentifierOrFunction = function(identifier, identifier_original_case, log)
{
//	First, check if we have that name registered (including object mappings)
	var result = this.names.indexOf(identifier);
	if (result >= 0)
	{
		const type = this.comptype[result]
		const accepted_types = [identifier_type_object, identifier_type_property, identifier_type_aggregate];
		if ( accepted_types.includes(type) )
			return result;
		if ( (type === identifier_type_mapping) && this.object_set[result][2].every( ii => accepted_types.includes(this.comptype[ii]) ) )
			return result;
		log.logError('I was expecting something that can resolve into an object, property or agregate, but I got '+identifier.toUpperCase()+', which is '+identifier_type_as_text[type]+'.')
		return -1;
	}

//	If not, it must contain tags
	const [error_code, identifier_base, tags] = this.identifierOrFunctionIsWellFormed(identifier, log);
	if (tags.length === 0 || error_code<0)
		return error_code - 1;

//	Extract mapping parameters
	var tag_values = tags.map( ([tag_index,tag_name]) => this.object_set[tag_index] )
	var mapping_parameters = [] // values of the parameters (identifier_indexes of tag classes or object properties)
	var functional_tags = []
	for (const [i, object_set] of tag_values.entries())
	{
		if (object_set instanceof Set)
			continue;
		const parameter_identifier_indexes = object_set[0];
		var new_parameter_identifier_indexes = [];
		for (const [j, parameter_identifier_index] of parameter_identifier_indexes.entries())
		{
			const parameter_index = mapping_parameters.indexOf(parameter_identifier_index);
			if (parameter_index >= 0)
			{
				new_parameter_identifier_indexes.push(parameter_index)
			}
			else
			{
				new_parameter_identifier_indexes.push(mapping_parameters.length)
				mapping_parameters.push(parameter_identifier_index)
			}
		}
		functional_tags.push( [i, new_parameter_identifier_indexes, object_set[1], object_set[2]] )
	}
	if (functional_tags.length === 0)
		return this.checkTagSetExpansion(identifier, identifier_base, tags, log);

//	For every possible combination of mapping parameters, check that it works
	const mapping_startset = [ ...cartesian_product(...mapping_parameters.map( ii => this.object_set[ii] )) ];
	var mapping_endset = []
	var all_found = true;
	for (const mapping_parameter_values of mapping_startset)
	{
		// console.log('in expansion of '+identifier+', for function parameters '+mapping_parameters+' ['+mapping_parameters.map(i=>this.names[i]).join(',')+'] => '+mapping_parameter_values+' ['+mapping_parameter_values.map(i=>this.names[i])+']');
		var new_tags = Array.from(tags);
		for (const [tag_pos, new_parameter_identifier_indexes, startset, endset] of functional_tags)
		{
			const replaced_mapping_parameters = new_parameter_identifier_indexes.map( i => mapping_parameter_values[i] )
			var index_in_startset = 0;
			while (startset[index_in_startset].some( (x,i) => (x !== replaced_mapping_parameters[i]) ))
				index_in_startset++;
			// console.log('   expansion of tag #'+tag_pos+' ('+tags[tag_pos][1]+') ', new_parameter_identifier_indexes, startset, endset, replaced_mapping_parameters, index_in_startset);
			const new_tag_identifier_index = endset[index_in_startset];
			new_tags[tag_pos] = [new_tag_identifier_index, this.names[new_tag_identifier_index]]
		}
		const new_identifier = identifier_base+':'+new_tags.map( ([ti,tn]) => tn ).join(':');
		const new_identifier_index = this.checkTagSetExpansion(new_identifier, identifier_base, new_tags, log);
		// todo: we also need to check if each of the resulting objects is an object mapping....
		if (new_identifier_index<0)
		{
			all_found = false;
			log.logError('Expansion of mapped tags in '+ientifier.toUpperCase()+' gave the unknown object '+new_identifier.toUpperCase()+'.');
			continue;
		}
		mapping_endset.push(new_identifier_index);
	}
	if (!all_found)
		return -5;
	result = this.names.length;
	this.registerNewIdentifier(identifier, identifier_original_case, identifier_type_mapping, identifier_type_mapping, [mapping_parameters, mapping_startset, mapping_endset], 2, log.lineNumber);
	return result;
}




Identifiers.prototype.checkCompoundDefinition = function(identifiers, compound_name, compound_type, log)
{
	var ok = true;
	var objects = new Set()
	const forbidden_type = (compound_type == identifier_type_aggregate) ? identifier_type_property : identifier_type_aggregate;
	for (const identifier of identifiers)
	{
		const identifier_index = this.checkKnownIdentifier(identifier, log);
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

// returns the new identifier if it was OK, -1 otherwise
Identifiers.prototype.checkAndRegisterNewObjectIdentifier = function(candname, original_case, accept_implicit, log)
{
	if ( ! this.checkIfNewIdentifierIsValid(candname, accept_implicit, log) )
		return -1;

	const [identifier_base, ...identifier_tags] = candname.split(':');

	if (identifier_tags.length == 0) // no tag in identifier
		return this.registerNewObject(candname, original_case, 0, log.lineNumber)

	const tags = identifier_tags.map( tagname => [this.names.indexOf(tagname), tagname] );
	const tag_values = tags.map( ([tag_index,tag_name]) => this.object_set[tag_index] );
	const identifier_base_original_case = original_case.split(':')[0]

//	For all possible combinations of tag values in these tag classes, define the corresponding object (as an object).
	var objects = new Set();
	for (const tagvalue_identifier_indexes of cartesian_product(...tag_values))
	{
		const new_identifier = identifier_base+':'+tagvalue_identifier_indexes.map(i => this.names[i] ).join(':');
		const new_identifier_index = this.names.indexOf(new_identifier);
		const new_original_case = identifier_base_original_case+':'+tagvalue_identifier_indexes.map(i => this.original_case_names[i] ).join(':');
		if (new_identifier_index < 0)
		{
			objects.add( this.objects.length );
			this.registerNewObject(new_identifier, new_original_case, 1, log.lineNumber)
		}
		else
		{
			this.object_set[new_identifier_index].forEach( x => objects.add(x) );
		}
	}

	if (objects.size > 1)
	{
	//	Register the identifier as a property to avoid redoing all this again.
		return this.registerNewLegend(candname, original_case, objects, identifier_type_property, 0, log.lineNumber);
	}
	if (tags.every( ([tag_index,tag_name]) => (this.comptype[tag_index] === identifier_type_tag) )) 
	{
	//	There are only tag values in the tags, no tag class => candname is the name of an atomic object that has not been explicitely defined before
		const result = this.names.indexOf(candname)
		this.implicit[result] = 0; // now it's explicitly defined
		return result;
	}
	// all tag classes have only one value => synonym, but we don't care (for now?)
	return this.names.length - 1; // latest identifier registered
}