
function PatternScriptEditorTabsManager() // Provides the logic for editor tabs, but not the UI.
{
	this.is_dirty = false
	this.clean_states = []
	this.tabs = []
}

PatternScriptEditorTabsManager.prototype = {

addTab: function(tab_manager)
{
	this.tabs.push(tab_manager)
	this.clean_states.push(tab_manager.getValue())
},

checkDirty: function()
{
	this.is_dirty = this.tabs.some(
		(tab_manager, tab_index) => (this.clean_states[tab_index] !== tab_manager.getValue())
	)

	const saveLink = document.getElementById('saveClickLink')
	if (saveLink)
	{
		saveLink.innerHTML = this.is_dirty ? 'SAVE*' : 'SAVE'
	}

	const saveOnGithubLink = document.getElementById('cloudSaveClickLink')
	if (saveOnGithubLink)
	{
		const update_gist_id = new URL(window.location).searchParams.get("hack"); // null if no such URL parameter
		if (update_gist_id === null)
		{
			saveOnGithubLink.innerHTML = 'SAVE ON CLOUD'
		}
		else
		{
			saveOnGithubLink.innerHTML = this.is_dirty ? 'UPDATE CLOUD' : 'SAVED ON CLOUD';
		}
	}
},

canExit: function()
{
 	return ( ! this.is_dirty ) || confirm("You haven't saved your game! Are you sure you want to lose your unsaved changes?")
},


setCleanForGithub: function() // called after a game has been loaded in the editor from GitHub or after it has been saved on GitHub
{
	const saveOnGithubLink = document.getElementById('cloudSaveClickLink')
	if (saveOnGithubLink)
	{
		const update_gist_id = new URL(window.location).searchParams.get("hack") // null if no such URL parameter
		saveOnGithubLink.innerHTML = (update_gist_id === null) ? 'SAVE ON CLOUD' : 'SAVED ON CLOUD'
	}
},

setClean: function() // called after a game has been loaded in the editor or after it has been saved (locally or on cloud)
{
	this.clean_states = this.tabs.map( tab_manager => tab_manager.getValue() )
	if (this.is_dirty === true)
	{
		var saveLink = document.getElementById('saveClickLink')
		if(saveLink)
		{
			saveLink.innerHTML = 'SAVE'
		}
		this.is_dirty = false
	}
},

setLightMode: function(new_mode) // 0 for dark, 1 for light. Call once all tabs have been added
{
	console.log('setting light mode to:', new_mode)
	const mode = (new_mode === null) ? 0 : parseInt(new_mode)
	storage_set('light_mode', mode)
	this.tabs.map( tab_manager => tab_manager.setLightMode(mode) )
	document.body.classList.remove((['light_mode', 'dark_mode'])[mode])
	document.body.classList.add((['dark_mode', 'light_mode'])[mode])
	document.getElementById('switchModeClickLink').innerHTML = (['LIGHT MODE', 'DARK MODE'])[mode]
},

}

var tabs = new PatternScriptEditorTabsManager()
