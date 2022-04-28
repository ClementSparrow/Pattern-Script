// This file must be the last hosting manager loaded!!

function localHostingManager() {}

localHostingManager.prototype = {

tryLoadSource: function(date = null)
{
	const saveString = storage_get('saves')
	if ( (saveString === null) && (date !== null) )
	{
		consolePrint("Eek, trying to load a file, but there's no local storage found. Eek!", true)
		return
	} 

	const saves = (saveString === null) ? new Array() : JSON.parse(saveString)
	const index = (date === null) ? saves.length-1 : saves.findIndex( sd => (dateToReadable(sd.title, new Date(sd.date)) == date) )

	if (index == -1)
	{
		consolePrint("Eek, trying to load a save, but couldn't find it. :(", true)
		return
	}

	document.getElementById('loadDropDown').selectedIndex = 0
	const save = saves[index]
	loadGameFromDict( (save.text !== undefined) ? ({code:save.text}) : save.game )
},

updateInterfaceForDirtyness: function(is_dirty)
{
	const saveLink = document.getElementById('saveClickLink')
	if (saveLink)
	{
		saveLink.innerHTML = this.is_dirty ? 'SAVE*' : 'SAVE'
	}
},

}


const localhosting_manager = new localHostingManager()
hosting_managers.push( [null, localhosting_manager] )

const SAVED_FILES_CAPACITY = 30

function saveClick()
{
	const saveDat = {
		title: (state.metadata.title !== undefined) ? state.metadata.title : 'Untitled',
		game: tabs.getContent(),
		date: new Date()
	}

	var curSaveArray = storage_has('saves') ? JSON.parse(storage_get('saves')) : []

	if (curSaveArray.length > SAVED_FILES_CAPACITY)
	{
		curSaveArray.splice(0, 1)
	}
	curSaveArray.push(saveDat)
	storage_set('saves', JSON.stringify(curSaveArray))

	repopulateSaveDropdown(curSaveArray)

	document.getElementById('loadDropDown').selectedIndex = 0

	tabs.setClean()

	consolePrint("saved file to local storage", true)
	if (curSaveArray.length == SAVED_FILES_CAPACITY)
	{
		consolePrint('WARNING: your <i>locally saved file list</i> has reached its maximum capacity of '+SAVED_FILES_CAPACITY+' files - older saved files will be deleted when you save in future. You should consider using the "SHARE ON CLOUD" button!', true)
	}
}

function loadDropDownChange()
{
	if ( ! tabs.canExit() )
	{
 		this.selectedIndex = 0
 		return
 	}
 	localhosting_manager.tryLoadSource(this.value)
}


function repopulateSaveDropdown(saves)
{
	var loadDropdown = document.getElementById('loadDropDown')
	loadDropdown.options.length = 0

	if (saves === undefined)
	{
		try
		{
			if ( ! storage_has('saves') )
				return
			saves = JSON.parse(storage_get('saves'))
		}
		catch (ex) // TODO: we should probably do something here?
		{
			return
		}
	}

    var optn = document.createElement("OPTION")
    optn.text = 'Load'
    optn.value = 'Load'
    loadDropdown.options.add(optn)

	for (var i=saves.length-1; i >= 0; i--)
	{
		const sd = saves[i]
	    var optn = document.createElement("OPTION")
	    const key = dateToReadable(sd.title, new Date(sd.date))
	    optn.text = key
	    optn.value = key
	    loadDropdown.options.add(optn)
	}
	loadDropdown.selectedIndex = 0;
}
