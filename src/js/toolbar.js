const HOSTPAGEURL = 'https://clementsparrow.github.io/Pattern-Script/src'

function runClick()
{
	clearConsole()
	compile(null)
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
	location.reload();
});



repopulateSaveDropdown();
var loadDropdown = document.getElementById('loadDropDown');
loadDropdown.selectedIndex=0;

function levelEditorClick_Fn()
{
	level_editor_screen.toggle()
	lastDownTarget = screen_layout.canvas
}

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

function rebuildClick()
{
	clearConsole()
	compile()
}

function exportClick()
{
	const sourceCode = editor_tabmanager.getContent()
	compile(null)
	buildStandalone(JSON.stringify(sourceCode));
}


function switchLightClick()
{
	const clicklink = document.getElementById('switchModeClickLink')
	tabs.setLightMode( ['DARK MODE', 'LIGHT MODE'].indexOf(clicklink.innerHTML) )
}
