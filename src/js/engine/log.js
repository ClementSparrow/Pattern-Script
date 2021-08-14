
// TODO: all these functions are very similar and should be factorized
// Also, consider merging with console.js
// And finally, there should be a standalone version of the engine/parser that do not depend on the editor.

var compiling = false
var errorStrings = []
var warningStrings = []


function makeLinkToLine(lineNumber, anchor_text = null)
{
	const l = lineNumber.toString()
	return '<a onclick="jumpToLine(' + l + ');"  href="javascript:void(0);">' + ((anchor_text === null) ? l : anchor_text) + '</a>';
}

function logErrorCacheable(str, lineNumber, urgent)
{
	logErrorAux(str, lineNumber, urgent, 'errorText', errorStrings)
}

function logError(str, lineNumber, urgent)
{
	logErrorAux(str, lineNumber, urgent, 'errorText', errorStrings, true)
}

function logWarning(str, lineNumber, urgent)
{
	logErrorAux(str, lineNumber, urgent, 'warningText', warningStrings, true)
}

function logErrorAux(str, lineNumber, urgent = false, text_class, text_cache, print_immediately)
{
	if (compiling||urgent)
	{
		const txt = get_error_message(str)
		const lineString = (lineNumber !== undefined) ? makeLinkToLine(lineNumber, '<span class="errorTextLineNumber"> line ' + lineNumber.toString() + '</span>') + ': ' : ''
		const errorString = lineString + '<span class="'+text_class+'">' + txt + '</span>'
		const key = (typeof str === 'string') ? errorString : [str, lineNumber]
		if (text_cache.findIndex(x => error_message_equal(x, key)) < 0 || urgent)
		{
			// not a duplicate error, we need to log it
			consolePrint(errorString, print_immediately)
			text_cache.push(key)
		}
	}
}
