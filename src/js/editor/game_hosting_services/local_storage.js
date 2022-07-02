// This file must be the last hosting manager loaded!!

function dateToReadable(saved_date)
{
	const time = new Date(saved_date)
	const year = time.getFullYear()
	var month = time.getMonth()+1
	var date1 = time.getDate()
	var hour = time.getHours()
	var minutes = time.getMinutes()
	var seconds = time.getSeconds()

	if (month < 10) {
    	month = "0"+month
	}
	if (date1 < 10) {
		date1 = "0"+date1
	}
	if (hour < 10) {
		hour = "0"+hour
	}
	if (minutes < 10) {
		minutes = "0"+minutes
	}
	if (seconds < 10) {
		seconds = "0"+seconds
	}

	return hour+":"+minutes+" "+year + "-" + month+"-"+date1+" "
}


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
	const index = (date === null) ? saves.length-1 : saves.findIndex( sd => (dateToReadable(sd.date)+sd.title == date) )

	if (index == -1)
	{
		consolePrint("Eek, trying to load a save, but couldn't find it. :(", true)
		return
	}

	document.getElementById('loadDropDown').selectedIndex = 0
	const save = saves[index]
	loadGameFromDict( (save.text !== undefined) ? ({code:save.text, meta: {}}) : save.game )
},

updateInterfaceForDirtyness: function(is_dirty)
{
	const saveLink = document.getElementById('saveClickLink')
	if (saveLink)
	{
		saveLink.innerHTML = is_dirty ? 'SAVE*' : 'SAVE'
	}
},

}


const localhosting_manager = new localHostingManager()
hosting_managers.push( [null, localhosting_manager] )

const SAVED_FILES_CAPACITY = 30

function saveClick()
{
	const saveDat = {
		title: (game_def.title !== undefined) ? game_def.title : 'Untitled',
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
	    const key = dateToReadable(sd.date) + sd.title
	    optn.text = key
	    optn.value = key
	    loadDropdown.options.add(optn)
	}
	loadDropdown.selectedIndex = 0;
}
