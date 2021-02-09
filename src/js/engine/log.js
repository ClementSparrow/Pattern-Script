
// TODO: all these functions are very similar and should be factorized
// Also, consider merging with console.js
// And finally, there should be a standalone version of the engine/parser that do not depend on the editor.

var compiling = false;
var errorStrings = [];
var errorCount=0;

function logErrorCacheable(str, lineNumber,urgent)
{
	if (compiling||urgent)
	{
		if (lineNumber === undefined)
			return logErrorNoLine(str);
		var errorString = '<a onclick="jumpToLine(' + lineNumber.toString() + ');"  href="javascript:void(0);"><span class="errorTextLineNumber"> line ' + lineNumber.toString() + '</span></a> : ' + '<span class="errorText">' + str + '</span>';
		if (errorStrings.indexOf(errorString) >= 0 && !urgent) {
			//do nothing, duplicate error
		} else {
			consolePrint(errorString);
			errorStrings.push(errorString);
			errorCount++;
		}
	}
}

function logError(str, lineNumber,urgent)
{
	if (compiling||urgent)
	{
		if (lineNumber === undefined)
			return logErrorNoLine(str,urgent);
		var errorString = '<a onclick="jumpToLine(' + lineNumber.toString() + ');"  href="javascript:void(0);"><span class="errorTextLineNumber"> line ' + lineNumber.toString() + '</span></a> : ' + '<span class="errorText">' + str + '</span>';
		if (errorStrings.indexOf(errorString) >= 0 && !urgent) {
			//do nothing, duplicate error
		} else {
			consolePrint(errorString, true);
			errorStrings.push(errorString);
			errorCount++;
		}
	}
}

function logWarning(str, lineNumber,urgent)
{
	if (compiling||urgent)
	{
		if (lineNumber === undefined)
			return logErrorNoLine(str);
		var errorString = '<a onclick="jumpToLine(' + lineNumber.toString() + ');"  href="javascript:void(0);"><span class="errorTextLineNumber"> line ' + lineNumber.toString() + '</span></a> : ' + '<span class="warningText">' + str + '</span>';
		if (errorStrings.indexOf(errorString) >= 0 && !urgent) {
			//do nothing, duplicate error
		} else {
			consolePrint(errorString, true);
			errorStrings.push(errorString);
		}
	}
}
function logErrorNoLine(str,urgent)
{
	if (compiling||urgent)
	{
		var errorString = '<span class="errorText">' + str + '</span>';
		if (errorStrings.indexOf(errorString) >= 0 && !urgent) {
			//do nothing, duplicate error
		} else {
			consolePrint(errorString, true);
			errorStrings.push(errorString);
		}
		errorCount++;
	}
}


function logBetaMessage(str,urgent)
{
	if (compiling||urgent)
	{
		var errorString = '<span class="betaText">' + str + '</span>';
		if (errorStrings.indexOf(errorString) >= 0 && !urgent) {
			//do nothing, duplicate error
		} else {
			consoleError(errorString);
			errorStrings.push(errorString);
		}
	}  
}
