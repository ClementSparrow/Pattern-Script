
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


var code = document.getElementById('code');
var _editorDirty = false;
var _editorCleanState = "";

var fileToOpen=getParameterByName("demo");
if (fileToOpen!==null&&fileToOpen.length>0) {
	tryLoadFile(fileToOpen);
	code.value = "loading...";
} else {
	var gistToLoad=getParameterByName("hack");
	if (gistToLoad!==null&&gistToLoad.length>0) {
		var id = gistToLoad.replace(/[\\\/]/,"");
		tryLoadGist(id);
		code.value = "loading...";
	} else {
		try {
			if (localStorage!==undefined && localStorage['saves']!==undefined) {
					var curSaveArray = JSON.parse(localStorage['saves']);
					var sd = curSaveArray[curSaveArray.length-1];
					code.value = sd.text;
					var loadDropdown = document.getElementById('loadDropDown');
					loadDropdown.selectedIndex=0;
			}
		} catch(ex) {
			
		}
	}
}


var editor = window.CodeMirror.fromTextArea(code, {
//	viewportMargin: Infinity,
	lineWrapping: true,
	lineNumbers: true,
	styleActiveLine: true,
	extraKeys: {
		"Ctrl-/": "toggleComment",
		"Cmd-/": "toggleComment",
		"Esc":CodeMirror.commands.clearSearch
		}
	});
	
editor.on('mousedown', function(cm, event) {
  if (event.target.className == 'cm-SOUND') {
    var seed = parseInt(event.target.innerHTML);
    playSound(seed);
  } else if (event.target.className == 'cm-LEVEL') {
    if (event.ctrlKey||event.metaKey) {
	  document.activeElement.blur();  // unfocus code panel
	  editor.display.input.blur();
      prevent(event);         // prevent refocus
      compile(["levelline",cm.posFromMouse(event).line]);
    }
  }
});

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



function setEditorLightMode(new_mode) // 0 for dark, 1 for light
{
	const mode = (new_mode === null) ? 1 : parseInt(new_mode)
	window.localStorage.setItem('light_mode', mode)
	editor.setOption('theme', (['midnight', 'midday'])[mode]);
	document.getElementById('switchModeClickLink').innerHTML = (['LIGHT MODE', 'DARK MODE'])[mode]
}

code.editorreference = editor;
setEditorLightMode(window.localStorage.getItem('light_mode'))


function getParameterByName(name)
{
    name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
        results = regex.exec(location.search);
    return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}

function tryLoadGist(id)
{
	var githubURL = 'https://api.github.com/gists/'+id;

	consolePrint("Contacting GitHub", true);
	var githubHTTPClient = new XMLHttpRequest();
	githubHTTPClient.open('GET', githubURL);
  if (window.localStorage!==undefined && localStorage['oauth_access_token']!==undefined)
  {
    var oauthAccessToken = window.localStorage.getItem("oauth_access_token");
    if (typeof oauthAccessToken === "string") {
      githubHTTPClient.setRequestHeader("Authorization","token "+oauthAccessToken);
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

function unloadGame()
{
	state = introstate
	level = new Level(0, 5, 5, 2, new Int32Array(0))
	menu_screen.makeTitle()
	canvasResize()
}

function loadText(txt)
{
	editor.setValue(txt)
	setEditorClean()
	unloadGame()
	compile(["restart"], txt)
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
});
