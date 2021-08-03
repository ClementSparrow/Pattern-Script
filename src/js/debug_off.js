// from console.js

function addErrorMessage(str)
{
	var errorText = document.getElementById("errormessage")

	var div = document.createElement("div");
	div.innerHTML = str;
	str = div.textContent || div.innerText || "";

	errorText.innerHTML += str + "<br>"
}

function consolePrint(str, urgent) { /* addErrorMessage(str) */ }

function consolePrintFromRule(str, rule, urgent) { /* addErrorMessage(str) */ }

function consoleCacheDump(str) { }

function consoleError(str, lineNumber) { addErrorMessage(str) }



// from debug.js

var canSetHTMLColors=true;
var canDump=false;
var canYoutube=true;
var IDE=false;

function clearInputHistory() { }
function pushInput(inp) { }