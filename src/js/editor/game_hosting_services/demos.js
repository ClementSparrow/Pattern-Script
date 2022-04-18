function tryLoadFile(fileName)
{
	var fileOpenClient = new XMLHttpRequest()
	fileOpenClient.open('GET', 'demo/'+fileName+".txt")
	fileOpenClient.onreadystatechange = function()
	{		
		if(fileOpenClient.readyState == 4)
			loadText(fileOpenClient.responseText)
	}
	fileOpenClient.send()
}

function dropdownChange()
{
	if( ! tabs.canExit() )
	{
 		this.selectedIndex = 0
 		return
 	}

	tryLoadFile(this.value)
	this.selectedIndex = 0
}