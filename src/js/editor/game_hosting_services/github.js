// The client ID of a GitHub OAuth app registered at https://github.com/settings/developers.
// The “callback URL” of that app points to https://www.puzzlescript.net/auth.html.
// If you’re running from another host name, sharing might not work.


function GistHostingManager() {}

GistHostingManager.prototype = {

tryLoadSource: function(id_string)
{
	tryLoadGist( id_string.replace(/[\\\/]/, '') )
},

updateInterfaceForDirtyness: function(is_dirty)
{
	const saveOnGithubLink = document.getElementById('cloudSaveClickLink')
	if ( ! saveOnGithubLink )
		return
	const update_gist_id = new URL(window.location).searchParams.get('hack') // null if no such URL parameter
	saveOnGithubLink.innerHTML = (update_gist_id === null) ? 'SAVE ON CLOUD' :
								 (is_dirty ? 'UPDATE CLOUD' : 'SAVED ON CLOUD')
},

}

const gist_manager = new GistHostingManager()
hosting_managers.push( ['hack', gist_manager] )

function tryLoadGist(id)
{
	const githubURL = 'https://api.github.com/gists/'+id

	consolePrint("Contacting GitHub", true)
	var githubHTTPClient = new XMLHttpRequest()
	githubHTTPClient.open('GET', githubURL)
	if (storage_has('oauth_access_token'))
	{
		const oauthAccessToken = storage_get('oauth_access_token')
		if (typeof oauthAccessToken === 'string')
		{
			githubHTTPClient.setRequestHeader('Authorization', 'token '+oauthAccessToken)
		}
	}
	githubHTTPClient.onreadystatechange = function() {
	
		if(githubHTTPClient.readyState != 4)
			return

		if (githubHTTPClient.responseText === '')
		{
			consoleError("GitHub request returned nothing.  A connection fault, maybe?")
		}

		const result = JSON.parse(githubHTTPClient.responseText)
		if ([401, 403].includes(githubHTTPClient.status)) // 401=unauthorized
		{
			consoleError(result.message)
		}
		else if (githubHTTPClient.status !== 200 && githubHTTPClient.status !== 201)
		{
			consoleError("HTTP Error "+ githubHTTPClient.status + ' - ' + githubHTTPClient.statusText);
		}
		else
		{
			const files = result['files']
			if (files['script.txt'] !== undefined)
				loadGameFromDict( ({code: files['script.txt'].content, meta: {}}) )
			else
			{
				// WIP TODO: We also need the version of the engine that was used to generate the files to decode them.
				loadGameFromDict( {
					code: files['code.txt'].content,
					meta: JSON.parse(files['meta.txt'].content),
					palettes: JSON.parse(files['palettes.txt'].content),
					sprites: JSON.parse(files['sprites.txt'].content),
				} )
			}
			editor_tabmanager.editor.clearHistory()
			gist_manager.updateInterfaceForDirtyness(false)
		}
	}
	githubHTTPClient.setRequestHeader('Content-type', 'application/vnd.github+json')
	githubHTTPClient.send()
}


function shareClick()
{
	return shareOnGitHub(true)
}

function cloudSaveClick()
{
	return shareOnGitHub(false)
}


function shareOnGitHub(is_public, should_fork=false)
{
	const oauthAccessToken = storage_get('oauth_access_token')
	if (typeof oauthAccessToken !== "string")
	{
		// Generates 32 letters of random data, like "liVsr/e+luK9tC02fUob75zEKaL4VpQn".
		printUnauthorized()
		return
	}

	compile()

	const update_gist_id = new URL(window.location).searchParams.get('hack') // null if no such URL parameter

	const game_name = (game_def.title !== undefined) ? game_def.title : 'Untitled'
	const game_description_url = 'Play this game at ' + metadata_tabmanager.getContent().homepage + ' or edit it ' + (
		update_gist_id !== null
			? 'at '+HOSTPAGEURL+'/editor.html&hack='+update_gist_id
			: ("by pasting this gist's id at the end of this URL: "+HOSTPAGEURL+"/editor.html&hack=")
	)
	const gistToCreate = {
		description: game_name + ' ('+PSFORKNAME+' Game)',
		public: is_public,
		files: Object.fromEntries([
			['\''+game_name+'\'', { content: metadata_tabmanager.getContent().description + '\n\n' + game_description_url }],
			...Array.from( tabs.tabs, tab => [ tab.name+'.txt', {content: (tab.name == 'code') ? tab.getContent() : JSON.stringify(tab.getContent(), null, 2)} ] )
		])
	}

	consolePrint("<br>Sending code to github…", true)
	const githubURL = 'https://api.github.com/gists' + ( (update_gist_id !== null) ? '/'+update_gist_id+(should_fork ? '/forks' : '') : '' )
	var githubHTTPClient = new XMLHttpRequest();
	githubHTTPClient.open('POST', githubURL);
	githubHTTPClient.onreadystatechange = function()
	{
		if(githubHTTPClient.readyState != 4)
			return
		const result = JSON.parse(githubHTTPClient.responseText)
		if (githubHTTPClient.status === 403)
		{
			consoleError(result.message)
		}
		else if (githubHTTPClient.status !== 200 && githubHTTPClient.status !== 201)
		{
			if (githubHTTPClient.statusText === "Unauthorized")
			{
				consoleError("Authorization check failed.  You have to log back into GitHub (or give it permission again or something).")
				storage_remove('oauth_access_token')
			}
			else
			{
				consoleError("HTTP Error "+ githubHTTPClient.status + ' - ' + githubHTTPClient.statusText)
				consoleError("Try giving "+PSFORKNAME+" permission again, that might fix things...")
				if (update_gist_id !== null)
				{
					consoleError('Or are you trying to update a game created by someone else? In that case, you can <a onclick="removeHackParam()" href="javascript:void(0);">clear the connexion with that game</a> and continue your edits (please be sure to be allowed to do that and not violate any copyright).')
					// Unfortunately, forking gists into private ones is not supported by GitHub yet.
					// consoleError('Or are you trying to update a game created by someone else? In that case, you can either:')
					// consoleError('- <a onclick="shareOnGitHub(\''+update_gist_id+'\',true)" href="javascript:void(0);">fork it</a> (recommended), or')
					// consoleError('- <a onclick="removeHackParam()" href="javascript:void(0);">clear the connexion with that game</a> and continue your edits (not recommended, as some authors could consider you\'re stealing their game).')
				}
			}
			printUnauthorized()
		}
		else
		{
			const id = result.id
			const url = qualifyURL("play.html?p="+id)

			const editurl = qualifyURL("editor.html?hack="+id)
			const sourceCodeLink = "Link to source code:<br><a target=\"_blank\" href=\""+editurl+"\">"+editurl+"</a>"

			// Note: unfortunately, updating a gist does not return the id of the commit. So if we need to link against this specific version of the game, we need to
			// get the most recent commit SHA by GET /gists/{gist_id}/commits, which returns a list L, sort it by decreasing L[i].committed_at, and get L[0].version ...

			consolePrint('GitHub (<a onclick="githubLogOut();"  href="javascript:void(0);">log out</a>) submission successful.<br>', true)
			consolePrint('<br>'+sourceCodeLink, true)

			if (errorStrings.length > 0) {
				consolePrint("<br>Cannot link directly to playable game, because there are compiler errors.", true)
			} else {
				consolePrint("<br>The game can now be played at this url:<br><a target=\"_blank\" href=\""+url+"\">"+url+"</a>", true)
			}

			window.history.replaceState(null, null, "?hack="+id)
			tabs.setClean()
		}
	}
	githubHTTPClient.setRequestHeader('Content-type', 'application/vnd.github+json')
	githubHTTPClient.setRequestHeader('Authorization', 'token '+oauthAccessToken)
	githubHTTPClient.send(JSON.stringify(gistToCreate))
}

function githubLogOut()
{
	storage_remove('oauth_access_token')

	const authUrl = getAuthURL()
	consolePrint(
		"<br>Logged out of Github.<br>" +
		"<ul>" +
		"<li><a target=\"_blank\" href=\"" + authUrl + "\">Give "+PSFORKNAME+" permission</a></li>" +
		"</ul>"
		, true)
}
