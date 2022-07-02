
function demoHostingManager() {}

demoHostingManager.prototype = {

tryLoadSource: function(fileName)
{
	var fileOpenClient = new XMLHttpRequest()
	fileOpenClient.open('GET', 'demo/'+fileName)
	fileOpenClient.onreadystatechange = function()
	{		
		if(fileOpenClient.readyState != 4)
			return
		loadGameFromDict({ code: fileOpenClient.responseText, meta: {}}) // TODO: convert the demos as dicts
	}
	fileOpenClient.send()
},

updateInterfaceForDirtyness: function(is_dirty) { },

}

const demos_manager = new demoHostingManager()
hosting_managers.push( ['demo', demos_manager] )

function dropdownChange()
{
	if(tabs.canExit())
	{
		demos_manager.tryLoadSource(this.value)
	}
	this.selectedIndex = 0
}