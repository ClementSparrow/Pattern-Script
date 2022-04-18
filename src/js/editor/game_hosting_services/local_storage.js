
const SAVED_FILES_CAPACITY = 30

function saveClick()
{
	const title = (state.metadata.title!==undefined) ? state.metadata.title : "Untitled";
	const text = editor_tabmanager.getContent()
	var saveDat = {
		title: title,
		text: text,
		date: new Date()
	}

	var curSaveArray = [];
	if ( storage_has('saves'))
	{
		var curSaveArray = JSON.parse(storage_get('saves'))
	}

	if (curSaveArray.length > SAVED_FILES_CAPACITY)
	{
		curSaveArray.splice(0, 1)
	}
	curSaveArray.push(saveDat);
	var savesDatStr = JSON.stringify(curSaveArray);
	storage_set('saves', savesDatStr)

	repopulateSaveDropdown(curSaveArray);

	var loadDropdown = document.getElementById('loadDropDown');
	loadDropdown.selectedIndex=0;

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
 		this.selectedIndex = 0;
 		return;
 	}

	const saveString = storage_get('saves')
	if (saveString === null)
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
			document.getElementById('loadDropDown').selectedIndex = 0;
			loadText(saveText)
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
			if ( ! storage_has('saves') )
				return;
			saves = JSON.parse(storage_get('saves'))
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
