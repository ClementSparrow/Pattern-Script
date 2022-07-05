var hosting_managers = []

function parseURLtoLoadGame()
{
	for (const [parameter_name, hosting_manager] of hosting_managers)
	{
		let parameter_value = null
		if (parameter_name !== null)
		{
			const regex = new RegExp("[\\?&]" + parameter_name + "=([^&#]*)")
			const results = regex.exec(location.search)
			if (results === null)
				continue
			parameter_value = decodeURIComponent(results[1].replace(/\+/g, ' '))
			if ( (parameter_value === null) || (parameter_value.length <= 0) )
				continue
		}
		tabs.setLoading()
		hosting_manager.tryLoadSource(parameter_value)
		return // WIP TODO: if the local_storage manager cannot find a save,
		// we should continue without calling setLoading.
		// -> setLoading should be called in the hosting service manager's tryLoadSource.
	}
}

function loadGameFromDict(game_dict) // WIP TODO
{
	metadata_tabmanager.setContent(game_dict.meta)
	palettes_tabmanager.setContent(game_dict.palettes || [])
	sprites_tabmanager.setContent(game_dict.sprites || [])
	editor_tabmanager.setContent(game_dict.code)
	compile(null, game_dict.code)
	tabs.setClean() // we do it after the compile because it can remove lines from the code and set it dirty
}
