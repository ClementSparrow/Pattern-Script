
function PatternScriptEditorTabsManager() // Provides the logic for editor tabs, but not the UI.
{
	this.is_dirty = false
	this.clean_states = []
	this.tabs = []
	this.tab_names = []
}

PatternScriptEditorTabsManager.prototype = {

addTab: function(tab_name, tab_manager)
{
	this.tabs.push(tab_manager)
	this.tab_names.push(tab_name)
	this.clean_states.push(tab_manager.getContent())
},

getContent: function() {
	return Object.fromEntries(
		Array.from(this.tab_names, (tab_name, i) => [tab_name, this.tabs[i].getContent()])
	)
},

// no 'setContent', functions with that name have to be called directly on the tab managers and uniquely when loading the game.

setLoading: function()
{
	this.tabs.map( tab_manager => tab_manager.setLoading() )
},

checkDirty: function()
{
	// WIP TODO: the should be hosting_managers.every( hosting_manager => this.tabs.some(...))
	this.is_dirty = this.tabs.some(
		(tab_manager, tab_index) => (tab_manager.checkDirty(this.clean_states[tab_index]))
	)

	hosting_managers.forEach( ([,hosting_manager]) => hosting_manager.updateInterfaceForDirtyness(this.is_dirty) )
},

canExit: function()
{
 	return ( ! this.is_dirty ) || confirm("You haven't saved your game! Are you sure you want to lose your unsaved changes?")
},


// WIP TODO: setClean should be functions of the game hosting services managers,
// which should also have their own clean_state field (but "is_dirty" should stay here).
setClean: function() // called after a game has been loaded in the editor or after it has been saved (locally or on cloud)
{
	this.clean_states = this.tabs.map( tab_manager => tab_manager.getContent() )
	if (this.is_dirty === true)
	{
		localhosting_manager.updateInterfaceForDirtyness(false)
		this.is_dirty = false
	}
},

removeFocus: function()
{
	this.tabs.forEach( tab_manager => tab_manager.removeFocus() )
},

setLightMode: function(new_mode) // 0 for dark, 1 for light. Call once all tabs have been added
{
	const mode = (new_mode === null) ? 0 : parseInt(new_mode)
	storage_set('light_mode', mode)
	this.tabs.map( tab_manager => tab_manager.setLightMode(mode) )
	document.body.classList.remove((['light_mode', 'dark_mode'])[mode])
	document.body.classList.add((['dark_mode', 'light_mode'])[mode])
	document.getElementById('switchModeClickLink').innerHTML = (['LIGHT MODE', 'DARK MODE'])[mode]
},

}

var tabs = new PatternScriptEditorTabsManager()
