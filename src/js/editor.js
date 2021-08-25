
// see https://codemirror.net/doc/manual.html#modeapi
window.CodeMirror.defineMode('puzzle', function()
	{
		'use strict';
		return {
			copyState: function(state) { return state.copy(); },
			blankLine: function(state) { state.blankLine(); },
			token: function(stream, state) { return state.token(stream); },
			startState: function() { return new PuzzleScriptParser(); }
		};
	}
);


var code = document.getElementById('code')
var _editorDirty = false
var _editorCleanState = ''

const fileToOpen = getParameterByName('demo')
if ( (fileToOpen !== null) && (fileToOpen.length > 0) )
{
	tryLoadFile(fileToOpen)
	code.value = 'loading...'
}
else
{
	const gistToLoad = getParameterByName('hack')
	if ( (gistToLoad !== null) && (gistToLoad.length > 0) )
	{
		var id = gistToLoad.replace(/[\\\/]/,"")
		tryLoadGist(id)
		code.value = 'loading...'
	}
	else
	{
		try {
			if (storage_has('saves'))
			{
				const curSaveArray = JSON.parse(storage_get('saves'))
				code.value = curSaveArray[curSaveArray.length-1].text
				document.getElementById('loadDropDown').selectedIndex = 0
			}
		} catch(ex) { }
	}
}

moveSelectedLines = function(cm, dir)
{
	var selected_line_ranges = cm.listSelections().map( range => [ Math.min(range.anchor.line, range.head.line), Math.max(range.head.line, range.anchor.line) ] )
	// fuse ranges
	var i=1
	while (i<selected_line_ranges.length)
	{
		if (selected_line_ranges[i][0] <= selected_line_ranges[i-1][1] + 1)
		{
			selected_line_ranges[i-1][1] = selected_line_ranges[i][1]
			selected_line_ranges.splice(i, 1)
		}
		else i++
	}
	// extend document if needed
	if (selected_line_ranges[selected_line_ranges.length-1][1] >= cm.lastLine() )
	{
		// console.log('Adding new line at the end of the document')
		const initial_selections = cm.listSelections() // by default, CodeMirror would extend the selection to include the new line
		cm.replaceRange('\n', CodeMirror.Pos(cm.lastLine()+1), null, '+swapLine')
		cm.setSelections(initial_selections, undefined, '+swapLine')
	}
	if (selected_line_ranges[0][0] + dir < cm.firstLine())
	{
		// console.log('Adding new line at the beginning of the document')
		cm.replaceRange('\n', CodeMirror.Pos(cm.firstLine(), 0), null, '+swapLine')
		selected_line_ranges = selected_line_ranges.map( ([f,t]) => [f+1, t+1])
	}
	// perform all cut/paste operations as a single operation for the editor
	cm.operation(function()
	{
		for (const [start, end] of selected_line_ranges)
		{
			const [from, to] = (dir<0) ? [start-1, end] : [end+1, start]
			// cut the line before/after the range
			const line = cm.getLine(from)
			cm.replaceRange('', CodeMirror.Pos(from, 0), CodeMirror.Pos(from+1, 0), '+swapLine')
			// and past it after/before the range
			cm.replaceRange(line + '\n', CodeMirror.Pos(to, 0), null, '+swapLine')
		}
		cm.scrollIntoView()
	})
}

CodeMirror.commands.moveSelectedLinesUp = function(cm)
{
	moveSelectedLines(cm, -1)
}

CodeMirror.commands.moveSelectedLinesDown = function(cm)
{
	moveSelectedLines(cm, 1)
}

CodeMirror.commands.selectLine = function(cm)
{
	cm.setSelections( cm.listSelections().map( function(range) {
		return {
			anchor: CodeMirror.Pos(range.from().line, 0),
			head: CodeMirror.Pos(range.to().line + 1, 0)
		}
	}))
}


var editor = window.CodeMirror.fromTextArea(code, {
//	viewportMargin: Infinity,
	lineWrapping: true,
	lineNumbers: true,
	styleActiveLine: true,
	extraKeys: {
		'Ctrl-/': 'toggleComment',
		'Cmd-/': 'toggleComment',
		'Esc': CodeMirror.commands.clearSearch,
		'Shift-Ctrl-Up': 'moveSelectedLinesUp',
		// 'Shift-Cmd-Up':  'moveSelectedLinesUp', // conflicts with "select to the beginning/end of the document", and Ctrl works on mac.
		'Shift-Ctrl-Down': 'moveSelectedLinesDown',
		// 'Shift-Cmd-Down':  'moveSelectedLinesDown',
		// 'Ctrl-L': 'selectLine', // shortcut conflicts with URL bar activation in many browsers.
		// 'Cmd-L': 'selectLine',
	}
})
	
editor.on('mousedown', function(cm, event)
{
	if (event.target.className == 'cm-SOUND')
	{
		playSound( parseInt(event.target.innerHTML) )
	}
	else if (event.target.className == 'cm-LEVEL')
	{
		if (event.ctrlKey || event.metaKey)
		{
			document.activeElement.blur()  // unfocus code panel
			editor.display.input.blur()
			prevent(event)         // prevent refocus
			const targetLine = cm.posFromMouse(event).line
			compile(
				function(levels)
				{
					for (var i=levels.length-1; i>=0; i--)
					{
						if (levels[i].lineNumber <= targetLine+1)
							return i
					}
					return undefined
				}
			)
		}
	}
})

_editorCleanState = editor.getValue();

function checkEditorDirty()
{
	_editorDirty = ( _editorCleanState !== editor.getValue() )

	var saveLink = document.getElementById('saveClickLink');
	if (saveLink)
	{
		saveLink.innerHTML = _editorDirty ? 'SAVE*' : 'SAVE';
	}

	var saveOnGitgubLink = document.getElementById('cloudSaveClickLink')
	if (saveOnGitgubLink)
	{
		const update_gist_id = new URL(window.location).searchParams.get("hack"); // null if no such URL parameter
		if (update_gist_id === null)
		{
			saveOnGitgubLink.innerHTML = 'SAVE ON CLOUD'
		}
		else
		{
			saveOnGitgubLink.innerHTML = _editorDirty ? 'UPDATE CLOUD' : 'SAVED ON CLOUD';
		}
	}
}


function setEditorCleanForGithub() // called after a game has been loaded in the editor from GitHub or after it has been saved on GitHub
{
	var saveOnGitgubLink = document.getElementById('cloudSaveClickLink')
	if (saveOnGitgubLink)
	{
		const update_gist_id = new URL(window.location).searchParams.get("hack"); // null if no such URL parameter
		saveOnGitgubLink.innerHTML = (update_gist_id === null) ? 'SAVE ON CLOUD' : 'SAVED ON CLOUD';
	}
}

function setEditorClean() // called after a game has been loaded in the editor or after it has been saved (locally or on cloud)
{
	_editorCleanState = editor.getValue();
	if (_editorDirty === true)
	{
		var saveLink = document.getElementById('saveClickLink');
		if(saveLink)
		{
			saveLink.innerHTML = 'SAVE';
		}
		_editorDirty = false;
	}
}


/* https://github.com/ndrake/PuzzleScript/commit/de4ac2a38865b74e66c1d711a25f0691079a290d */
editor.on('change', (cm, changeObj) => checkEditorDirty() );

var mapObj = {
   parallel:"&#8741;",
   perpendicular:"&#8869;"
};

/*
editor.on("beforeChange", function(instance, change) {
    var startline = 
    for (var i = 0; i < change.text.length; ++i)
      text.push(change.text[i].replace(/parallel|perpendicular/gi, function(matched){ 
        return mapObj[matched];
      }));

    change.update(null, null, text);
});*/

code.editorreference = editor;


function setEditorLightMode(new_mode) // 0 for dark, 1 for light
{
	const mode = (new_mode === null) ? 1 : parseInt(new_mode)
	storage_set('light_mode', mode)
	editor.setOption('theme', (['midnight', 'midday'])[mode]);
	document.getElementById('switchModeClickLink').innerHTML = (['LIGHT MODE', 'DARK MODE'])[mode]
}
setEditorLightMode(storage_get('light_mode'))


function getParameterByName(name)
{
    name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
        results = regex.exec(location.search);
    return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}

function tryLoadGist(id)
{
	const githubURL = 'https://api.github.com/gists/'+id

	consolePrint("Contacting GitHub", true)
	var githubHTTPClient = new XMLHttpRequest()
	githubHTTPClient.open('GET', githubURL)
	if (storage_has('oauth_access_token'))
	{
		var oauthAccessToken = storage_get('oauth_access_token')
		if (typeof oauthAccessToken === 'string')
		{
			githubHTTPClient.setRequestHeader('Authorization', 'token '+oauthAccessToken)
		}
	}
	githubHTTPClient.onreadystatechange = function() {
	
		if(githubHTTPClient.readyState != 4)
			return;

		if (githubHTTPClient.responseText==="") {
			consoleError("GitHub request returned nothing.  A connection fault, maybe?");
		}

		var result = JSON.parse(githubHTTPClient.responseText);
		if (githubHTTPClient.status === 403)
		{
			consoleError(result.message);
		}
		else if (githubHTTPClient.status !== 200 && githubHTTPClient.status !== 201)
		{
			consoleError("HTTP Error "+ githubHTTPClient.status + ' - ' + githubHTTPClient.statusText);
		}
		else
		{
			loadText( result["files"]["script.txt"]["content"] )
			editor.clearHistory();
			setEditorCleanForGithub()
		}
	}
	githubHTTPClient.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
	githubHTTPClient.send();
}

function loadText(txt)
{
	editor.setValue(txt)
	setEditorClean()
	state = introstate
	level = new Level(5, 5, new Int32Array(0))
	title_screen.makeTitle()
	compile(-1, txt)
	setPageTitle()
}

function tryLoadFile(fileName)
{
	var fileOpenClient = new XMLHttpRequest();
	fileOpenClient.open('GET', 'demo/'+fileName+".txt");
	fileOpenClient.onreadystatechange = function()
	{		
		if(fileOpenClient.readyState == 4)
			loadText(fileOpenClient.responseText)
	}
	fileOpenClient.send();
}

function canExit()
{
 	if( ! _editorDirty )
 		return true;
 	return confirm("You haven't saved your game! Are you sure you want to lose your unsaved changes?")
}
 
function dropdownChange() {
	if(!canExit()) {
 		this.selectedIndex = 0;
 		return;
 	}

	tryLoadFile(this.value);
	this.selectedIndex=0;
}

editor.on('keyup', function (editor, event) {
	if (!CodeMirror.ExcludedIntelliSenseTriggerKeys[(event.keyCode || event.which).toString()])
	{
		var dosuggest=true;
		// if (editor.doc.sel.ranges.length>0){
		// 	console.log(editor.getRange(editor.doc.sel.ranges[0].anchor, {line:53,ch:59}));
		// }

		if (dosuggest){
			CodeMirror.commands.autocomplete(editor, null, { completeSingle: false });
		}
	}
})

title_screen.makeTerminalScreen()
// TODO: This one should not play sound, but it does not matter because the sound has not been compiled yet.
title_screen.openMenu(null) // can't close the menu
