function jumpToLine(i)
{
    editor_tabmanager.jumpToLine(i)
}

// Selectable text in console
// ==========================

var selectableint = 0
function makeSelectableText(text, ctrl_callback = '')
{
	selectableint++
	const tag = 'selectable' + selectableint
	return '<span id="' + tag + '" onmousedown="selectText(\'' + tag + '\', event, ' + ctrl_callback + ')" oncontextmenu="return false">' + text + '</span>'
}

function selectText(containerid, e, ctrl_callback = null)
{
	e = e || window.event
	var myspan = document.getElementById(containerid)
	// select level text
	if (document.selection)
	{
		var range = document.body.createTextRange()
		range.moveToElementText(myspan)
		range.select()
	}
	else if (window.getSelection)
	{
		var selection = window.getSelection()
		selection.removeAllRanges() // why removeAllRanges? https://stackoverflow.com/a/43443101 whatever…
		var range = document.createRange()
		range.selectNode(myspan)
		selection.addRange(range)
	}
	// load in level editor with Ctrl/Meta
	if ( (ctrl_callback !== null) && e && (e.ctrlKey || e.metaKey) )
	{
		ctrl_callback(myspan.innerText.split('\n'))
	}
	// Copy in clipboard with Shift
	if ( e && e.shiftKey )
	{
		navigator.clipboard.writeText( myspan.innerText.split('<br>').join('\n') )
	}
	return e.preventDefault()
}

// Console cache
// =============

var consolecache = []


const dirMaskName = {
	 1:'up',
	 2:'down',
	 4:'left',
	 8:'right',
}

function consolePrintFromRule(text, rule, urgent)
{
	consolePrint('<font color="green">Rule ' + makeLinkToLine(rule.lineNumber) + ' ' + dirMaskName[rule.direction] + ": "  + text + '</font>', urgent)
}

function consolePrint(text, urgent = ! cache_console_messages)
{
	if (urgent)
	{
		consoleCacheDump()
		addToConsole(text)
	}
	else
	{
		consolecache.push(text)
	}
}


var cache_n = 0;

function addToConsole(text) {
	cache = document.createElement("div");
	cache.id = "cache" + cache_n;
	cache.innerHTML = text;
	cache_n++;
	
	var code = document.getElementById('consoletextarea');
	code.appendChild(cache);
	consolecache=[];
	var objDiv = document.getElementById('lowerarea');
	objDiv.scrollTop = objDiv.scrollHeight;
}

function consoleCacheDump()
{
	if (cache_console_messages === false)
		return
	
	var lastline = "";
	var times_repeated = 0;
	var summarised_message = "<br>";
	for (var i = 0; i < consolecache.length; i++) {
		if (consolecache[i] == lastline) {
			times_repeated++;
		} else {
			lastline = consolecache[i];
			if (times_repeated > 0) {
				summarised_message = summarised_message + " (x" + (times_repeated + 1) + ")";
			}
			summarised_message += "<br>"
			summarised_message += lastline;
			times_repeated = 0;
		}
	}

	if (times_repeated > 0) {
		summarised_message = summarised_message + " (x" + (times_repeated + 1) + ")";
	}

	addToConsole(summarised_message);
}

function consoleError(text) {	
        var errorString = '<span class="errorText">' + text + '</span>';
        consolePrint(errorString,true);
}
function clearConsole() {
	document.getElementById('consoletextarea').innerHTML = ''
	var objDiv = document.getElementById('lowerarea');
	objDiv.scrollTop = objDiv.scrollHeight;
}


// Verbose logging
// ===============

function verboseToggle()
{
	verbose_logging = ! verbose_logging
	consolePrint('Verbose logging is now ' + (verbose_logging ? 'ENABLED' : 'DISABLED'), true)
}


var highlighted_cell = null;
function highlightCell(coords)
{
	highlighted_cell = coords;
	redraw()
}


function debugRulesClick()
{
	if ( (state === undefined) || (state.rules === undefined) )
		compile()
	if (state.rules === undefined)
		consolePrint('There\'s no rule to show.')
	else
		consolePrint(print_ruleset(state.rules) + '\n\nLATE RULES\n\n' + print_ruleset(state.lateRules))
}
