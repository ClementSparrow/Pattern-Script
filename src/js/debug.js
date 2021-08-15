var canSetHTMLColors=false;
var canDump=true;
var canYoutube=false;
var inputHistory=[];
var compiledText;
var IDE=true;
var recordingStartsFromLevel = 0 // for input recorder

function convertLevelToString()
{
	var out = '';
	var seenCells = {};
	var i = 0;
	for (var y = 0; y < level.height; y++)
	{
		for (var x = 0; x < level.width; x++)
		{
			const bitmask = level.getCell(x + y*level.width);
			var objs = [];
			for (var bit = 0; bit < 32 * STRIDE_OBJ; ++bit)
			{
				if (bitmask.get(bit))
				{
					objs.push(state.identifiers.objects[state.idDict[bit]].name)
				}
			}
			objs.sort();
			objs = objs.join(" ");
			/* replace repeated object combinations with numbers */
			if (!seenCells.hasOwnProperty(objs))
			{
				seenCells[objs] = i++;
				out += objs + ":";
			}
			out += seenCells[objs] + ",";
		}
		out += '\n';
	}
	return out;
}

function loadUnitTestStringLevel(str)
{
	const lines = str.split('\n')
	const height = lines.length
	const width = lines[0].split(',').length
	var lev = new Level(undefined, width, height, state.collisionLayers.length, new Int32Array(width * height * STRIDE_OBJ))
	var masks = []
	const backgroundLayerMask = state.layerMasks[state.backgroundlayer]
	const levelBackgroundMask = lev.calcBackgroundMask(state)
	for (const [y, line] of lines.entries())
	{
		for (const [x, cell_content] of line.split(',').entries())
		{
			if (cell_content.length == 0)
				continue
			var cell_parts = cell_content.split(':')
			if (cell_parts.length > 1)
			{
				const object_names = cell_parts[0].split(' ')
				const objects = object_names.map( object_name => state.identifiers.objects.find( o => (object_name === o.name) ) )
				console.log(object_names, objects)
				const mask = makeMaskFromGlyph( objects.map( o => o.id ) )
				if ( ! backgroundLayerMask.anyBitsInCommon(mask) )
				{
					mask.ior(levelBackgroundMask);
				}
				masks.push(mask)
			}
			const mask_id = parseInt(cell_parts[cell_parts.length - 1])
			console.log(mask_id, masks.length)
			const maskint = masks[mask_id]
			lev.setCell(x * height + y, maskint)
		}
	}
	loadLevelFromLevelDat(state, lev, null)
	canvasResize()
}


function stripHTMLTags(html_str)
{
	if (typeof html_str !== 'string')
		return html_str
	var div = document.createElement("div");
	div.innerHTML = html_str;
	var text = div.textContent || div.innerText || "";
	return text.trim();
}

function dumpTestCase()
{
	//compiler error data
	const levelDat = compiledText
	const resultstring = JSON.stringify( [levelDat, errorStrings.map(stripHTMLTags), warningStrings.map(stripHTMLTags)] )
	consolePrint("<br>Compilation error/warning data (for error message tests - errormessage_testdata.js):<br><br><br>"+resultstring+"<br><br><br>", true)
	
	//normal session recording data
	if (level !== undefined)
	{
		const resultstring = JSON.stringify( [levelDat, inputHistory.concat([]), convertLevelToString(), recordingStartsFromLevel, loadedLevelSeed] )
		consolePrint("<br>Recorded play session data (for play session tests - testdata.js):<br><br><br>"+resultstring+"<br><br><br>",true);
	}
}

function clearInputHistory()
{
	if (canDump === true)
	{
		inputHistory=[]
		recordingStartsFromLevel = curlevel
	}
}

function pushInput(inp) {
	if (canDump===true) {
		inputHistory.push(inp);
	}
}