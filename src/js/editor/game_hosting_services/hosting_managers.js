var hosting_managers = []

function parseURLtoLoadGame()
{
	for (const [parameter_name, hosting_manager] of hosting_managers)
	{
		var parameter_value = null
		if (parameter_name !== null)
		{
			var regex = new RegExp("[\\?&]" + parameter_name + "=([^&#]*)")
			const results = regex.exec(location.search)
			if (results === null)
				continue
			parameter_value = decodeURIComponent(results[1].replace(/\+/g, ' '))
			if ( (parameter_value === null) || (parameter_value.length <= 0) )
				continue
		}
		tabs.setLoading()
		hosting_manager.tryLoadSource(parameter_value)
		return
	}
}

function loadGameFromDict(game_dict) // WIP TODO
{
	editor_tabmanager.setContent(game_dict.code)
	tabs.setClean()
	compile(null, game_dict.code)
}
