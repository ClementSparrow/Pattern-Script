// The client ID of a GitHub OAuth app registered at https://github.com/settings/developers.
// The “callback URL” of that app points to https://www.puzzlescript.net/auth.html.
// If you’re running from another host name, sharing might not work.


function runClick()
{
	clearConsole();
	compile(["restart"]);
}

function dateToReadable(title, time)
{
	var year = time.getFullYear();
	var month = time.getMonth()+1;
	var date1 = time.getDate();
	var hour = time.getHours();
	var minutes = time.getMinutes();
	var seconds = time.getSeconds();

	if (month < 10) {
    	month = "0"+month;
	}
	if (date1 < 10) {
		date1 = "0"+date1;
	}
	if (hour < 10) {
		hour = "0"+hour;
	}
	if (minutes < 10) {
		minutes = "0"+minutes;
	}
	if (seconds < 10) {
		seconds = "0"+seconds;
	}

	var result = hour+":"+minutes+" "+year + "-" + month+"-"+date1+" "+title;
	return result;
}

function saveClick()
{
	const title = (state.metadata.title!==undefined) ? state.metadata.title : "Untitled";
	const text = editor.getValue();
	var saveDat = {
		title: title,
		text: text,
		date: new Date()
	}

	var curSaveArray = [];
	if (localStorage['saves']===undefined) {

	} else {
		var curSaveArray = JSON.parse(localStorage.saves);
	}

	if (curSaveArray.length>19) {
		curSaveArray.splice(0,1);
	}
	curSaveArray.push(saveDat);
	var savesDatStr = JSON.stringify(curSaveArray);
	localStorage['saves']=savesDatStr;

	repopulateSaveDropdown(curSaveArray);

	var loadDropdown = document.getElementById('loadDropDown');
	loadDropdown.selectedIndex=0;

	setEditorClean();

	consolePrint("saved file to local storage",true);
	// removeHackParam()
}

function removeHackParam()
{
	//clear parameters from url bar if any present
	if (window.location.href.indexOf("?hack") >= 0)
	{
		const currURL = window.location.href; 
		const afterDomain = currURL.substring(currURL.lastIndexOf('/') + 1);
		const params =  afterDomain.split("?");
		const beforeQueryString =params[0];  
 
		window.history.pushState({}, document.title, "./" + beforeQueryString);
		consolePrint('The game is now disconnected from the original saved on cloud.')
	}
}

window.addEventListener("pageshow", function (event)
{
	const historyTraversal = event.persisted || 
						   ( typeof window.performance != "undefined" && 
								window.performance.navigation.type === 2 );
	if ( historyTraversal )
	{
		// Handle page restore.
		window.location.reload();
	}
});

window.addEventListener("popstate", function(event)
{
	console.log("hey");
	location.reload();
});

function loadDropDownChange()
{
	if ( ! canExit() )
	{
 		this.selectedIndex = 0;
 		return;
 	}

	const saveString = localStorage['saves'];
	if (saveString === undefined)
	{
		consolePrint("Eek, trying to load a file, but there's no local storage found. Eek!",true);
	} 

	saves = JSON.parse(saveString);
	
	for (const sd of saves)
	{
	    var key = dateToReadable(sd.title, new Date(sd.date));
	    if (key == this.value)
	    {
	    	const saveText = sd.text;
			editor.setValue(saveText);
			setEditorClean();
			document.getElementById('loadDropDown').selectedIndex = 0;
			unloadGame();
			compile(["restart"]);
			return;
	    }
	}		

	consolePrint("Eek, trying to load a save, but couldn't find it. :(",true);
}


function repopulateSaveDropdown(saves)
{
	var loadDropdown = document.getElementById('loadDropDown');
	loadDropdown.options.length = 0;

	if (saves === undefined)
	{
		try
		{
			if (localStorage['saves'] === undefined)
				return;
			saves = JSON.parse(localStorage["saves"]);
		}
		catch (ex)
		{
			return;
		}
	}

    var optn = document.createElement("OPTION");
    optn.text = "Load";
    optn.value = "Load";
    loadDropdown.options.add(optn);  

	for (var i=saves.length-1; i >= 0; i--)
	{
		const sd = saves[i];
	    var optn = document.createElement("OPTION");
	    const key = dateToReadable(sd.title, new Date(sd.date));
	    optn.text = key;
	    optn.value = key;
	    loadDropdown.options.add(optn);  
	}
	loadDropdown.selectedIndex = 0;
}

repopulateSaveDropdown();
var loadDropdown = document.getElementById('loadDropDown');
loadDropdown.selectedIndex=0;

function levelEditorClick_Fn()
{
	if (textMode || state.levels.length === 0)
	{
		compile(["loadLevel",0]);
		levelEditorOpened = true;
	} else {
		levelEditorOpened = !levelEditorOpened;
	}
	forceRegenImages = true
	canvasResize();
	lastDownTarget = canvas;	
}

const HOSTPAGEURL = "https://clementsparrow.github.io/Pattern-Script/src"
const PSFORKNAME = "Pattern:Script"

/* I don't want to setup the required server for an OAuth App, so for now we will use a slightly more complex method for the user,
   which is to create a personal identification token. */
function getAuthURL()
{
	return './auth_pat.html';
}

function printUnauthorized()
{
	const authUrl = getAuthURL();
	consolePrint(
		"<br>"+PSFORKNAME+" needs permission to share/save games through GitHub:<br><ul><li><a target=\"_blank\" href=\"" + authUrl + "\">Give "+PSFORKNAME+" permission</a></li></ul>",
		true
	);
}

function shareClick()
{
	return shareOnGitHub(true);
}

function cloudSaveClick()
{
	return shareOnGitHub(false);
}


function shareOnGitHub(is_public, should_fork=false)
{
	const oauthAccessToken = window.localStorage.getItem("oauth_access_token");
	if (typeof oauthAccessToken !== "string")
	{
		// Generates 32 letters of random data, like "liVsr/e+luK9tC02fUob75zEKaL4VpQn".
		printUnauthorized();
		return;
	}

	compile(["rebuild"]);

	const title = (state.metadata.title !== undefined) ? state.metadata.title + " ("+PSFORKNAME+" Script)" : ("Untitled "+PSFORKNAME+" Script");
	const source = editor.getValue();

	var gistToCreate = {
		"description" : title,
		"public" : is_public,
		"files": {
			"readme.txt" : {
				"content": "Play this game by pasting the script in "+HOSTPAGEURL+"/editor.html"
			},
			"script.txt" : {
				"content": source
			}
		}
	};

	const update_gist_id = new URL(window.location).searchParams.get("hack"); // null if no such URL parameter

	consolePrint("<br>Sending code to github...", true)
	const githubURL = 'https://api.github.com/gists' + ( (update_gist_id !== null) ? '/'+update_gist_id+(should_fork ? '/forks' : '') : '' )
	var githubHTTPClient = new XMLHttpRequest();
	githubHTTPClient.open('POST', githubURL);
	githubHTTPClient.onreadystatechange = function()
	{
		if(githubHTTPClient.readyState != 4)
			return;
		var result = JSON.parse(githubHTTPClient.responseText);
		if (githubHTTPClient.status === 403)
		{
			consoleError(result.message);
		}
		else if (githubHTTPClient.status !== 200 && githubHTTPClient.status !== 201)
		{
			if (githubHTTPClient.statusText==="Unauthorized"){
				consoleError("Authorization check failed.  You have to log back into GitHub (or give it permission again or something).");
				window.localStorage.removeItem("oauth_access_token");
			} else {
				consoleError("HTTP Error "+ githubHTTPClient.status + ' - ' + githubHTTPClient.statusText);
				consoleError("Try giving "+PSFORKNAME+" permission again, that might fix things...");
				if (update_gist_id !== null)
				{
					consoleError('Or are you trying to update a game created by someone else? In that case, you can <a onclick="removeHackParam()" href="javascript:void(0);">clear the connexion with that game</a> and continue your edits (please be sure to be allowed to do that and not violate any copyright).')
					// Unfortunately, forking gists into private ones is not supported by GitHub yet.
					// consoleError('Or are you trying to update a game created by someone else? In that case, you can either:')
					// consoleError('- <a onclick="shareOnGitHub(\''+update_gist_id+'\',true)" href="javascript:void(0);">fork it</a> (recommended), or')
					// consoleError('- <a onclick="removeHackParam()" href="javascript:void(0);">clear the connexion with that game</a> and continue your edits (not recommended, as some authors could consider you\'re stealing their game).')
				}
			}
			printUnauthorized();
		}
		else
		{
			const id = result.id;
			const url = qualifyURL("play.html?p="+id);

			const editurl = qualifyURL("editor.html?hack="+id);
			const sourceCodeLink = "Link to source code:<br><a target=\"_blank\"  href=\""+editurl+"\">"+editurl+"</a>";

			// Note: unfortunately, updating a gist does not return the id of the commit. So if we need to link against this specific version of the game, we need to
			// get the most recent commit SHA by GET /gists/{gist_id}/commits, which returns a list L, sort it by decreasing L[i].committed_at, and get L[0].version ...


			consolePrint('GitHub (<a onclick="githubLogOut();"  href="javascript:void(0);">log out</a>) submission successful.<br>',true);

			consolePrint('<br>'+sourceCodeLink,true);


			if (errorCount>0) {
				consolePrint("<br>Cannot link directly to playable game, because there are compiler errors.",true);
			} else {
				consolePrint("<br>The game can now be played at this url:<br><a target=\"_blank\" href=\""+url+"\">"+url+"</a>",true);
			}

			window.history.replaceState(null, null, "?hack="+id);
			setEditorCleanForGithub()

		}
	}
	githubHTTPClient.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
	githubHTTPClient.setRequestHeader("Authorization", "token "+oauthAccessToken);
	const stringifiedGist = JSON.stringify(gistToCreate);
	githubHTTPClient.send(stringifiedGist);
    lastDownTarget=canvas;	
}

function githubLogOut()
{
	window.localStorage.removeItem("oauth_access_token");

	const authUrl = getAuthURL();
	consolePrint(
		"<br>Logged out of Github.<br>" +
		"<ul>" +
		"<li><a target=\"_blank\" href=\"" + authUrl + "\">Give "+PSFORKNAME+" permission</a></li>" +
		"</ul>"
				,true);
}

function rebuildClick()
{
	clearConsole();
	compile(["rebuild"]);
}

function exportClick()
{
	const sourceCode = editor.getValue();
	compile("restart");
	buildStandalone(JSON.stringify(sourceCode));
}


function switchLightClick()
{
	const clicklink = document.getElementById('switchModeClickLink')
	setEditorLightMode( ['DARK MODE', 'LIGHT MODE'].indexOf(clicklink.innerHTML) )
}
